"""API routes for managing ASHA patient records.

The mobile client generates the patient id (UUID) so that POST requests are
idempotent and can be retried by the offline sync queue without duplicating
records. Only minimal demographic data is stored server-side; clinical data
lives on visit records.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.patient import PatientORM

router = APIRouter(tags=["patient"])


class PatientUpsert(BaseModel):
    """Payload accepted by POST /api/patient. Used for create and update."""

    id: str = Field(..., description="Client-generated UUID")
    ashaId: str
    name: str
    ageYears: Optional[int] = None
    sex: Optional[str] = None
    isPregnant: bool = False
    gestationalWeeks: Optional[int] = None
    isPostpartum: bool = False
    daysPostpartum: Optional[int] = None
    village: Optional[str] = None
    phone: Optional[str] = None
    languageCode: str = "hi"
    consentReceiptHash: Optional[str] = None


class PatientResponse(BaseModel):
    """Patient resource returned to clients."""

    id: str
    ashaId: str
    name: str
    ageYears: Optional[int] = None
    sex: Optional[str] = None
    isPregnant: bool
    gestationalWeeks: Optional[int] = None
    isPostpartum: bool
    daysPostpartum: Optional[int] = None
    village: Optional[str] = None
    phone: Optional[str] = None
    languageCode: str
    consentReceiptHash: Optional[str] = None
    createdAt: str
    updatedAt: str


def _to_response(orm: PatientORM) -> PatientResponse:
    return PatientResponse(
        id=orm.id,
        ashaId=orm.ashaId,
        name=orm.name,
        ageYears=orm.ageYears,
        sex=orm.sex,
        isPregnant=orm.isPregnant,
        gestationalWeeks=orm.gestationalWeeks,
        isPostpartum=orm.isPostpartum,
        daysPostpartum=orm.daysPostpartum,
        village=orm.village,
        phone=orm.phone,
        languageCode=orm.languageCode,
        consentReceiptHash=orm.consentReceiptHash,
        createdAt=orm.createdAt.isoformat() if orm.createdAt else "",
        updatedAt=orm.updatedAt.isoformat() if orm.updatedAt else "",
    )


@router.post("/patient", response_model=PatientResponse)
def upsert_patient(
    payload: PatientUpsert,
    db: Session = Depends(get_db),
) -> PatientResponse:
    """Create or update a patient record. Idempotent on `id`."""

    existing = db.get(PatientORM, payload.id)
    now = datetime.now(timezone.utc)

    if existing is None:
        record = PatientORM(
            id=payload.id,
            ashaId=payload.ashaId,
            name=payload.name,
            ageYears=payload.ageYears,
            sex=payload.sex,
            isPregnant=payload.isPregnant,
            gestationalWeeks=payload.gestationalWeeks,
            isPostpartum=payload.isPostpartum,
            daysPostpartum=payload.daysPostpartum,
            village=payload.village,
            phone=payload.phone,
            languageCode=payload.languageCode,
            consentReceiptHash=payload.consentReceiptHash,
            createdAt=now,
            updatedAt=now,
        )
        db.add(record)
    else:
        record = existing
        for field_name, field_value in payload.model_dump().items():
            if field_name == "id":
                continue
            setattr(record, field_name, field_value)
        record.updatedAt = now

    db.commit()
    db.refresh(record)
    return _to_response(record)


@router.get("/patient/{patientId}", response_model=PatientResponse)
def get_patient(
    patientId: str,
    db: Session = Depends(get_db),
) -> PatientResponse:
    """Fetch a single patient by id."""

    record = db.get(PatientORM, patientId)
    if record is None:
        raise HTTPException(status_code=404, detail="Patient not found")
    return _to_response(record)


@router.get("/patient", response_model=list[PatientResponse])
def list_patients(
    ashaId: str,
    db: Session = Depends(get_db),
) -> list[PatientResponse]:
    """List patients managed by a single ASHA worker."""

    rows = (
        db.query(PatientORM)
        .filter(PatientORM.ashaId == ashaId)
        .order_by(PatientORM.updatedAt.desc())
        .all()
    )
    return [_to_response(row) for row in rows]
