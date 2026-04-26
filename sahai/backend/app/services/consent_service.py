"""Consent validation helpers for privacy-sensitive workflows."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

CONSENT_VERSION = "sahai-consent-v1"

DATA_USE_SCOPES = {
    "transcription",
    "ai_extraction",
    "risk_assessment",
    "referral_generation",
    "same_language_readback",
}


class ConsentValidationError(Exception):
    """Raised when a request does not include adequate patient consent."""


def validate_consent(consent: dict[str, Any] | None, required_scope: str) -> None:
    """Ensure consent is explicit, current, and covers the requested workflow."""
    if not consent:
        raise ConsentValidationError("Consent is required before processing patient data.")

    if consent.get("consentVersion") != CONSENT_VERSION:
        raise ConsentValidationError("Consent version is missing or outdated.")

    if consent.get("consentGiven") is not True:
        raise ConsentValidationError("Patient consent was not granted.")

    if consent.get("privacyNoticeAccepted") is not True:
        raise ConsentValidationError("Privacy notice must be accepted before processing.")

    scopes = consent.get("dataUseScopes")
    if not isinstance(scopes, list) or required_scope not in scopes:
        raise ConsentValidationError(f"Consent does not cover {required_scope}.")


def build_consent_receipt(
    asha_id: str,
    patient_id: str,
    language_code: str,
    data_use_scopes: list[str],
    consent_given: bool,
    privacy_notice_accepted: bool,
) -> dict[str, Any]:
    """Build an auditable consent receipt for storage or later sync."""
    approved_scopes = [scope for scope in data_use_scopes if scope in DATA_USE_SCOPES]
    return {
        "consentId": f"consent-{uuid4().hex}",
        "ashaId": asha_id,
        "patientId": patient_id,
        "consentVersion": CONSENT_VERSION,
        "consentGiven": consent_given,
        "privacyNoticeAccepted": privacy_notice_accepted,
        "languageCode": language_code,
        "dataUseScopes": approved_scopes,
        "recordedAt": datetime.now(timezone.utc).isoformat(),
        "withdrawalAvailable": True,
    }
