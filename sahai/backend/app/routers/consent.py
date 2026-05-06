"""Consent receipt routes — record, persist, and withdraw."""

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.consent_service import (
    persist_consent_receipt,
    withdraw_consent,
    compute_receipt_hash,
)
from app.services.audit import log_event

router = APIRouter(tags=["consent"])


class ConsentRecordRequest(BaseModel):
    """Request body matching the mobile consent payload per V3 spec."""
    consentGranted: bool
    scopeAgreed: List[str]
    languageCode: str
    timestamp: str
    witnessPresent: bool = False
    patientId: str
    ashaId: str


class ConsentRecordResponse(BaseModel):
    """Returns the receipt hash for subsequent API calls."""
    receiptHash: str
    consentGranted: bool
    patientId: str
    ashaId: str


@router.post("/consent/record", response_model=ConsentRecordResponse)
async def record_consent(
    request: ConsentRecordRequest,
    db: Session = Depends(get_db),
) -> ConsentRecordResponse:
    """Validate, hash, and persist a consent receipt."""
    if not request.consentGranted:
        raise HTTPException(status_code=400, detail="Consent must be granted to proceed.")

    consent_dict = {
        "consentGranted": request.consentGranted,
        "scopeAgreed": request.scopeAgreed,
        "languageCode": request.languageCode,
        "timestamp": request.timestamp,
        "witnessPresent": request.witnessPresent,
        "patientId": request.patientId,
        "ashaId": request.ashaId,
    }
    receipt_hash = persist_consent_receipt(db, consent_dict)

    # Audit log
    log_event(
        db,
        actor_id=request.ashaId,
        actor_role="ASHA",
        event_type="CONSENT_GRANTED",
        target_id=request.patientId,
        payload_summary={
            "languageCode": request.languageCode,
            "scopeCount": len(request.scopeAgreed),
            "witnessPresent": request.witnessPresent,
        },
    )

    return ConsentRecordResponse(
        receiptHash=receipt_hash,
        consentGranted=request.consentGranted,
        patientId=request.patientId,
        ashaId=request.ashaId,
    )


class WithdrawRequest(BaseModel):
    receiptHash: str
    reason: Optional[str] = None


@router.post("/consent/withdraw")
async def withdraw(
    request: WithdrawRequest,
    db: Session = Depends(get_db),
):
    """Withdraw a previously granted consent receipt. DPDP §11 compliance."""
    result = withdraw_consent(db, request.receiptHash, request.reason)

    log_event(
        db,
        actor_id="system",
        actor_role="SYSTEM",
        event_type="CONSENT_WITHDRAWN",
        payload_summary={"receiptHash": request.receiptHash},
    )

    return result
