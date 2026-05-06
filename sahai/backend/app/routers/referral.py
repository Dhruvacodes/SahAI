"""API routes for generating referral notes — protocol-engine driven with optional Haiku polish."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.referral_service import generate_referral
from app.services.cost_tracker import log_cost
from app.services.audit import log_event

router = APIRouter(tags=["referral"])


class ReferralRequest(BaseModel):
    """Request body for generating a referral from extraction + risk."""
    extraction: dict
    riskResult: Optional[dict] = None
    languageCode: str = "hi"
    ashaFacilityInfo: Optional[dict] = None


class ReferralResponse(BaseModel):
    referralText: str
    patientInstruction: str
    urgency: str
    facility: Optional[str] = None
    facilityType: Optional[str] = None
    followUpPlan: Optional[dict] = None
    firstResponseActions: Optional[List[str]] = None
    # Phase 4: rule-citation provenance and ANM-facing one-line summary.
    firedRuleIds: Optional[List[str]] = None
    clinicalSummary: Optional[str] = None
    generatedAt: str


@router.post("/referral/generate", response_model=ReferralResponse)
async def generate_visit_referral(
    request: ReferralRequest,
    db: Session = Depends(get_db),
) -> ReferralResponse:
    """Generate a referral note via the protocol engine (with optional Haiku polish)."""
    risk_result = request.riskResult or {
        "level": request.extraction.get("riskLevel", "LOW"),
        "score": request.extraction.get("riskScore", 0.1),
        "flags": request.extraction.get("riskFlags", []),
        "firedRules": request.extraction.get("firedRules", []),
    }

    referral = await generate_referral(
        extraction=request.extraction,
        risk_result=risk_result,
        language_code=request.languageCode,
        asha_facility_info=request.ashaFacilityInfo,
    )

    meta = referral.get("_meta") or {}
    source = meta.get("source", "template")
    fired_rule_ids = referral.get("firedRuleIds") or []

    # Cost log: only when we actually called Haiku for the polish layer.
    if "haiku_polish" in source:
        log_cost(
            db,
            endpoint="/api/referral/generate",
            provider="anthropic",
            model=meta.get("model", "claude-haiku-4-5-20251001"),
            input_tokens=meta.get("input_tokens", 0),
            output_tokens=meta.get("output_tokens", 0),
            cached_input_tokens=meta.get("cached_input_tokens", 0),
        )

    log_event(
        db,
        actor_id="system",
        actor_role="SYSTEM",
        event_type="REFERRAL_GENERATED",
        payload_summary={
            "source": source,
            "riskLevel": risk_result["level"],
            "urgency": referral.get("urgency"),
            "firedRuleCount": len(fired_rule_ids),
        },
    )

    # Surface catalog gaps as a separate audit event so rule authors can
    # spot missing protocols without having to grep through REFERRAL_GENERATED.
    if meta.get("catalog_gap"):
        log_event(
            db,
            actor_id="system",
            actor_role="SYSTEM",
            event_type="CATALOG_GAP",
            payload_summary={
                "visitType": request.extraction.get("visitType"),
                "riskLevel": risk_result["level"],
                "riskFlags": meta.get("risk_flags") or risk_result.get("flags", []),
            },
        )

    return ReferralResponse(
        referralText=referral.get("referralText", ""),
        patientInstruction=referral.get("patientInstruction", ""),
        urgency=referral.get("urgency", "ROUTINE"),
        facility=referral.get("facility"),
        facilityType=referral.get("facilityType"),
        followUpPlan=referral.get("followUpPlan"),
        firstResponseActions=referral.get("firstResponseActions"),
        firedRuleIds=fired_rule_ids,
        clinicalSummary=referral.get("clinicalSummary"),
        generatedAt=datetime.now(timezone.utc).isoformat(),
    )
