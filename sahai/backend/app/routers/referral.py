"""API routes for generating PHC referral notes and ASHA follow-up plans."""

from datetime import datetime, timezone
from typing import Any, List, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.schemas.privacy import ConsentSnapshot
from app.services.consent_service import ConsentValidationError, validate_consent
from app.services.referral_service import generate_referral

router = APIRouter(tags=["referral"])


class ReferralRequest(BaseModel):
    """Request body for generating a referral note from visit data."""

    patientName: str
    ageYears: int
    village: str
    visitDate: str
    vitals: dict[str, Any]
    symptoms: List[str]
    riskLevel: str
    riskFlags: List[str]
    ashaName: str
    outputLanguage: str = "hi"
    consent: ConsentSnapshot


class ReferralResponse(BaseModel):
    """Generated referral note response with urgency and timestamp metadata."""

    referralText: str
    followUpPlan: str
    urgency: Literal["ROUTINE", "URGENT", "EMERGENCY"]
    generatedAt: str


@router.post("/referral/generate", response_model=ReferralResponse)
async def generate_visit_referral(request: ReferralRequest) -> ReferralResponse:
    """Generate a referral note and patient-facing follow-up plan for a visit.

    Args:
        request: Visit data and requested output language for referral generation.

    Returns:
        Referral text, follow-up plan, urgency level, and UTC generation timestamp.
    """
    try:
        validate_consent(_model_to_dict(request.consent), "referral_generation")
    except ConsentValidationError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc

    referral = await generate_referral(
        _model_to_dict(request),
        request.outputLanguage,
    )

    return ReferralResponse(
        referralText=referral["referralText"],
        followUpPlan=referral["followUpPlan"],
        urgency=referral["urgency"],
        generatedAt=datetime.now(timezone.utc).isoformat(),
    )


def _model_to_dict(model: BaseModel) -> dict[str, Any]:
    """Convert a Pydantic model to a dictionary across Pydantic versions."""
    if hasattr(model, "model_dump"):
        return model.model_dump()

    return model.dict()

