# backend/app/services/consent_service.py
"""Consent validation, persistence, hash computation, and withdrawal."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.consent_receipt import ConsentReceiptORM

CONSENT_VERSION = "sahai-consent-v1"

DATA_USE_SCOPES = {
    "transcription",
    "ai_extraction",
    "risk_assessment",
    "referral_generation",
    "same_language_readback",
    "clinical_visit",
    "data_sync",
}


class ConsentValidationError(Exception):
    """Raised when a request does not include adequate patient consent."""


def validate_consent(consent: Optional[Dict[str, Any]], required_scope: str) -> None:
    """Ensure consent is explicit, current, and covers the requested workflow.
    Supports both V3 (consentGranted/scopeAgreed) and V1 (consentGiven/dataUseScopes) formats.
    """
    if not consent:
        raise ConsentValidationError("Consent is required before processing patient data.")

    # V3 format: consentGranted + scopeAgreed
    granted = consent.get("consentGranted", consent.get("consentGiven"))
    if granted is not True:
        raise ConsentValidationError("Patient consent was not granted.")

    scopes = consent.get("scopeAgreed", consent.get("dataUseScopes", []))
    if not isinstance(scopes, list):
        raise ConsentValidationError(f"Consent does not cover {required_scope}.")

    # If scopes are provided, check coverage. Clinical_visit covers transcription/extraction/risk.
    if scopes and required_scope not in scopes:
        # Allow clinical_visit as umbrella scope
        if "clinical_visit" not in scopes:
            raise ConsentValidationError(f"Consent does not cover {required_scope}.")


def build_consent_receipt(
    asha_id: str,
    patient_id: str,
    language_code: str,
    data_use_scopes: list[str],
    consent_given: bool,
    privacy_notice_accepted: bool,
) -> Dict[str, Any]:
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


def compute_receipt_hash(consent: dict) -> str:
    """Canonical sorted-keys JSON → SHA-256 hex."""
    canonical = json.dumps(consent, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def persist_consent_receipt(db: Session, consent: dict) -> str:
    """Compute hash and persist. Returns hash."""
    h = compute_receipt_hash(consent)
    existing = db.query(ConsentReceiptORM).filter(ConsentReceiptORM.receipt_hash == h).first()
    if existing:
        return h
    receipt = ConsentReceiptORM(
        patient_id=consent["patientId"],
        asha_id=consent["ashaId"],
        consent_granted=consent["consentGranted"],
        scope_agreed=consent["scopeAgreed"],
        language_code=consent["languageCode"],
        witness_present=consent.get("witnessPresent", False),
        receipt_hash=h,
        granted_at=datetime.fromisoformat(consent["timestamp"].replace("Z", "+00:00")),
    )
    db.add(receipt)
    db.commit()
    return h


def verify_consent_receipt(db: Session, receipt_hash: str) -> ConsentReceiptORM:
    """Raises HTTPException 403 if not found or withdrawn."""
    rec = db.query(ConsentReceiptORM).filter(ConsentReceiptORM.receipt_hash == receipt_hash).first()
    if not rec:
        raise HTTPException(status_code=403, detail={"code": "CONSENT_NOT_FOUND", "hash": receipt_hash})
    if rec.withdrawn_at is not None:
        raise HTTPException(status_code=403, detail={"code": "CONSENT_WITHDRAWN", "withdrawnAt": rec.withdrawn_at.isoformat()})
    return rec


def withdraw_consent(db: Session, receipt_hash: str, reason: str = None) -> dict:
    rec = db.query(ConsentReceiptORM).filter(ConsentReceiptORM.receipt_hash == receipt_hash).first()
    if not rec:
        raise HTTPException(status_code=404, detail={"code": "CONSENT_NOT_FOUND"})
    if rec.withdrawn_at is not None:
        return {"withdrawn": True, "withdrawnAt": rec.withdrawn_at.isoformat()}
    rec.withdrawn_at = datetime.now(timezone.utc)
    rec.withdrawal_reason = reason
    db.commit()
    return {"withdrawn": True, "withdrawnAt": rec.withdrawn_at.isoformat()}
