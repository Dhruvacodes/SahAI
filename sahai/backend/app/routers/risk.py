"""API routes for rule-based clinical risk scoring."""

from typing import Any, List, Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.routers.extraction import ExtractionResponse
from app.schemas.privacy import ConsentSnapshot
from app.services.consent_service import ConsentValidationError, validate_consent
from app.services.risk_engine import calculate_risk_score

RECOMMENDED_ACTIONS = {
    "LOW": "Continue routine monitoring. Next visit in 4 weeks.",
    "MEDIUM": "Increase visit frequency. Notify ANM supervisor.",
    "HIGH": "Refer to PHC within 48 hours. Alert ANM immediately.",
    "CRITICAL": "Emergency referral NOW. Call 108. Do not wait.",
}

router = APIRouter(tags=["risk"])


class PatientRiskProfile(BaseModel):
    """Patient metadata required for rule-based risk scoring."""

    isPregnant: bool
    gestationalWeek: Optional[int]
    ageYears: int


class RiskRequest(BaseModel):
    """Risk scoring request containing extracted vitals and patient context."""

    vitals: ExtractionResponse
    patient: PatientRiskProfile
    consent: ConsentSnapshot


class RiskResponse(BaseModel):
    """Risk score response with clinical flags and recommended action."""

    score: int
    level: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    flags: List[str]
    recommendedAction: str


@router.post("/risk/score", response_model=RiskResponse)
async def score_visit_risk(request: RiskRequest) -> RiskResponse:
    """Calculate a deterministic clinical risk score for extracted visit data.

    Args:
        request: Extracted vitals and patient metadata for the scoring engine.

    Returns:
        Risk score, severity level, triggered flags, and a recommended action.
    """
    try:
        validate_consent(_model_to_dict(request.consent), "risk_assessment")
    except ConsentValidationError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc

    risk_result = calculate_risk_score(
        _model_to_dict(request.vitals),
        _model_to_dict(request.patient),
    )
    level = risk_result["level"]

    return RiskResponse(
        score=risk_result["score"],
        level=level,
        flags=risk_result["flags"],
        recommendedAction=RECOMMENDED_ACTIONS[level],
    )


def _model_to_dict(model: BaseModel) -> dict[str, Any]:
    """Convert a Pydantic model to a dictionary across Pydantic versions."""
    if hasattr(model, "model_dump"):
        return model.model_dump()

    return model.dict()

