"""API routes for generating referral notes — smart routing: template vs Sonnet."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, List, Literal, Optional

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
    generatedAt: str


@router.post("/referral/generate", response_model=ReferralResponse)
async def generate_visit_referral(
    request: ReferralRequest,
    db: Session = Depends(get_db),
) -> ReferralResponse:
    """Generate a referral note with smart routing: template or Sonnet."""
    # Build risk_result from extraction if not provided
    risk_result = request.riskResult
    if not risk_result:
        risk_result = {
            "level": request.extraction.get("riskLevel", "LOW"),
            "score": request.extraction.get("riskScore", 0.1),
            "flags": request.extraction.get("riskFlags", []),
        }

    referral = await generate_referral(
        extraction=request.extraction,
        risk_result=risk_result,
        language_code=request.languageCode,
        asha_facility_info=request.ashaFacilityInfo,
    )

    # Cost log if Sonnet was used
    meta = referral.get("_meta", {})
    if meta.get("source") == "sonnet":
        log_cost(db,
            endpoint="/api/referral/generate",
            provider="anthropic",
            model=meta.get("model", "claude-sonnet-4-6"),
            input_tokens=meta.get("input_tokens", 0),
            output_tokens=meta.get("output_tokens", 0),
            cached_input_tokens=meta.get("cached_input_tokens", 0),
        )

    # Audit
    log_event(db,
        actor_id="system", actor_role="SYSTEM",
        event_type="REFERRAL_GENERATED",
        payload_summary={
            "source": meta.get("source", "template"),
            "riskLevel": risk_result["level"],
            "urgency": referral.get("urgency"),
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
        generatedAt=datetime.now(timezone.utc).isoformat(),
    )
