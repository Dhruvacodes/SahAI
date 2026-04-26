"""Consent receipt routes."""

from typing import List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.consent_service import (
    CONSENT_VERSION,
    ConsentValidationError,
    build_consent_receipt,
    validate_consent,
)
from app.services.language_policy import normalize_language_code

router = APIRouter(tags=["consent"])


class ConsentRecordRequest(BaseModel):
    """Request body for recording explicit patient consent."""

    ashaId: str
    patientId: str
    consentGiven: bool
    privacyNoticeAccepted: bool
    languageCode: str = "hi"
    dataUseScopes: List[str]
    patientSignatureName: str | None = None


class ConsentRecordResponse(BaseModel):
    """Auditable consent receipt returned to mobile clients."""

    consentId: str
    ashaId: str
    patientId: str
    consentVersion: str
    consentGiven: bool
    privacyNoticeAccepted: bool
    languageCode: str
    dataUseScopes: List[str]
    recordedAt: str
    withdrawalAvailable: bool


@router.post("/consent/record", response_model=ConsentRecordResponse)
async def record_consent(request: ConsentRecordRequest) -> ConsentRecordResponse:
    """Validate and return an auditable consent receipt."""
    language_code = normalize_language_code(request.languageCode)
    receipt = build_consent_receipt(
        asha_id=request.ashaId,
        patient_id=request.patientId,
        language_code=language_code,
        data_use_scopes=request.dataUseScopes,
        consent_given=request.consentGiven,
        privacy_notice_accepted=request.privacyNoticeAccepted,
    )
    receipt["patientSignatureName"] = request.patientSignatureName

    try:
        validate_consent(receipt, "ai_extraction")
    except ConsentValidationError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc

    receipt["consentVersion"] = CONSENT_VERSION
    return ConsentRecordResponse(**receipt)
