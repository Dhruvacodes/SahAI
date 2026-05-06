"""ASHA override audit endpoint.

When the ASHA worker disagrees with the protocol engine's risk band, she can
record a structured override on her device. The mobile client posts the
reason here so we have an auditable trail of clinical-judgement disagreements
that can feed back into protocol-rule tuning.

This is metadata only; we never store raw transcript or PII.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.audit import log_event

router = APIRouter(tags=["asha-override"])


class OverrideRequest(BaseModel):
    visitId: str = Field(..., min_length=1)
    patientId: str = Field(..., min_length=1)
    ashaId: str = Field(..., min_length=1)
    engineLevel: str = Field(..., description="The engine-assigned risk band")
    proposedLevel: Optional[str] = None
    reasonCode: str = Field(..., description="Short controlled vocab e.g. PATIENT_LOOKS_WELL, WORSE_THAN_DATA, OTHER")
    note: Optional[str] = Field(None, max_length=500)
    languageCode: Optional[str] = None


class OverrideResponse(BaseModel):
    auditId: str


@router.post("/asha-override", response_model=OverrideResponse)
async def record_override(
    request: OverrideRequest,
    db: Session = Depends(get_db),
) -> OverrideResponse:
    audit_id = log_event(
        db,
        actor_id=request.ashaId,
        actor_role="ASHA",
        event_type="ASHA_OVERRIDE",
        target_id=request.visitId,
        payload_summary={
            "visitId": request.visitId,
            "patientId": request.patientId,
            "engineLevel": request.engineLevel,
            "proposedLevel": request.proposedLevel,
            "reasonCode": request.reasonCode,
            "note": request.note,
            "languageCode": request.languageCode,
        },
    )
    return OverrideResponse(auditId=audit_id)
