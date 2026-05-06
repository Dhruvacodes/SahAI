"""Extract endpoint: orchestrates sanitize → vocab correct → trends → Haiku → risk → cost+audit log."""

from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Literal
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.extraction_service import extract_clinical_data
from app.services.demographics_service import extract_demographics
from app.services.vocab_correction import correct_transcript
from app.services.risk_engine import score_risk
from app.services.longitudinal import get_patient_trends
from app.services.consent_service import verify_consent_receipt
from app.services.audit import log_event
from app.services.cost_tracker import log_cost

router = APIRouter(tags=["extraction"])


class ConsentSnapshot(BaseModel):
    consentGranted: bool
    scopeAgreed: List[str]
    languageCode: str
    timestamp: str
    witnessPresent: bool
    patientId: str
    ashaId: str
    receiptHash: Optional[str] = None


class PatientProfile(BaseModel):
    isPregnant: bool = False
    gestationalWeekIfPregnant: Optional[int] = None
    isPostpartum: bool = False
    daysPostpartum: Optional[int] = None
    ageYears: Optional[int] = None


class ExtractRequest(BaseModel):
    transcriptText: str
    languageCode: str
    consent: ConsentSnapshot
    patientProfile: Optional[PatientProfile] = None
    visitTypeHint: Optional[str] = None


class ExtractResponse(BaseModel):
    visitType: str
    vitals: dict
    symptoms: List[str]
    chiefComplaint: str
    patientInstruction: str
    riskLevel: Literal["LOW", "MODERATE", "HIGH", "CRITICAL"]
    riskScore: float
    riskFlags: List[str]
    velocityWarnings: List[str]
    trendContext: str
    dataQuality: dict
    # Protocol-engine provenance (added in v4 / protocol-grounded overhaul).
    firedRules: List[dict] = []
    firstResponseActions: List[dict] = []
    catalogVersion: Optional[str] = None
    ttt_minutes: Optional[int] = None


@router.post("/extract", response_model=ExtractResponse)
async def extract(req: ExtractRequest, db: Session = Depends(get_db)):
    # 1. Verify consent
    if req.consent.receiptHash:
        verify_consent_receipt(db, req.consent.receiptHash)  # raises 403 if withdrawn

    # 2. Vocab correction (after STT, before Haiku)
    corrected_transcript = correct_transcript(req.transcriptText, req.languageCode)

    # 3. Patient profile
    profile_dict = {}
    if req.patientProfile:
        if hasattr(req.patientProfile, "model_dump"):
            profile_dict = req.patientProfile.model_dump()
        else:
            profile_dict = req.patientProfile.dict()

    # 4. Trend *context* for the LLM prompt — based on past visits only,
    #    since we haven't extracted the current vitals yet. The prompt only
    #    needs human-readable history, not numeric deltas.
    trend_context = get_patient_trends(
        db, req.consent.patientId,
        current_vitals={},
    )

    context = {
        "languageCode": req.languageCode,
        "visitTypeHint": req.visitTypeHint or "auto-detect",
        "patientProfile": profile_dict,
        "trendContext": trend_context["trend_context"],
        "velocityWarnings": trend_context["velocity_warnings"],
    }

    # 5. Haiku extraction (LLM produces observations only — no severity).
    extraction = await extract_clinical_data(corrected_transcript, context)

    # 6. NOW compute longitudinal trends *with* the freshly extracted vitals
    #    so velocity warnings (rapid BP rise, etc.) reflect real deltas.
    trends = get_patient_trends(
        db, req.consent.patientId,
        current_vitals=extraction.get("vitals", {}) or {},
    )

    # 7. Risk scoring via the protocol engine + legacy fallback.
    risk = score_risk(
        vitals=extraction["vitals"],
        symptoms=extraction["symptoms"],
        patient_profile=profile_dict,
        velocity_warnings=trends["velocity_warnings"],
    )
    
    # 8. Cost log
    meta = extraction.get("_meta", {})
    log_cost(db,
        endpoint="/api/extract",
        provider="anthropic",
        model=meta.get("model", "claude-haiku-4-5-20251001"),
        input_tokens=meta.get("input_tokens", 0),
        output_tokens=meta.get("output_tokens", 0),
        cached_input_tokens=meta.get("cached_input_tokens", 0),
    )
    
    # 9. Audit log (METADATA ONLY, never raw transcript)
    log_event(db,
        actor_id=req.consent.ashaId, actor_role="ASHA",
        event_type="EXTRACT",
        target_id=req.consent.patientId,
        payload_summary={
            "transcriptLength": len(corrected_transcript),
            "languageCode": req.languageCode,
            "visitType": extraction["visitType"],
            "riskLevel": risk["level"],
            "suspectedInjection": extraction["dataQuality"].get("suspectedInjection", False),
        },
    )
    
    return ExtractResponse(
        visitType=extraction["visitType"],
        vitals=extraction["vitals"],
        symptoms=extraction["symptoms"],
        chiefComplaint=extraction.get("chiefComplaint", ""),
        patientInstruction=extraction.get("patientInstruction", ""),
        riskLevel=risk["level"],
        riskScore=risk["score"],
        riskFlags=risk["flags"],
        velocityWarnings=trends["velocity_warnings"],
        trendContext=trends["trend_context"],
        dataQuality=extraction["dataQuality"],
        firedRules=risk.get("firedRules", []) or [],
        firstResponseActions=risk.get("firstResponseActions", []) or [],
        catalogVersion=risk.get("catalogVersion"),
        ttt_minutes=risk.get("ttt_minutes"),
    )


# ─── Demographics fallback ──────────────────────────────────────────────────

class DemographicsRequest(BaseModel):
    transcriptText: str
    languageCode: Optional[str] = None


class DemographicsResponse(BaseModel):
    name: Optional[str] = None
    nameLatin: Optional[str] = None
    ageYears: Optional[int] = None
    village: Optional[str] = None
    phone: Optional[str] = None
    isPregnant: Optional[bool] = None
    gestationalWeeks: Optional[int] = None


@router.post("/extract/demographics", response_model=DemographicsResponse)
async def extract_demographics_endpoint(req: DemographicsRequest) -> DemographicsResponse:
    """LLM fallback for parsing patient demographics from a free-form transcript.

    The mobile client only calls this when its on-device regex parser fails to
    recover at least a name/phone — so it stays cheap to operate (one short
    Claude Haiku call).
    """
    if not req.transcriptText or not req.transcriptText.strip():
        raise HTTPException(status_code=400, detail="transcriptText is required")

    parsed = await extract_demographics(req.transcriptText)
    return DemographicsResponse(**parsed)
