"""API routes for syncing offline mobile visit records to the backend."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, Literal, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.patient import PatientORM
from app.models.visit import VisitORM
from app.schemas.privacy import ConsentSnapshot
from app.services.alert_service import create_alert_from_visit

logger = logging.getLogger(__name__)

router = APIRouter(tags=["sync"])

# Alembic migration command: alembic revision --autogenerate -m "create visits table" && alembic upgrade head


class ExtractedVitalsSchema(BaseModel):
    """Extracted vital signs attached to a synced visit."""

    bloodPressureSystolic: Optional[float] = None
    bloodPressureDiastolic: Optional[float] = None
    hemoglobinLevel: Optional[float] = None
    fetalMovements: Optional[bool] = None
    oedema: Optional[bool] = None
    temperature: Optional[float] = None


class VisitRecordSchema(BaseModel):
    """Pydantic schema matching the shared TypeScript VisitRecord contract."""

    id: str
    patientId: str
    ashaId: str
    visitDate: str
    rawTranscriptText: str
    extractedVitals: ExtractedVitalsSchema
    symptoms: list[str]
    consent: ConsentSnapshot
    languageCode: str = "hi"
    riskScore: int
    riskLevel: Literal["LOW", "MODERATE", "HIGH", "CRITICAL"]
    referralGenerated: bool
    followUpPlan: str
    syncedToCloud: bool
    # Protocol-engine provenance (added in V4 / protocol-grounded overhaul).
    firedRules: list[Dict[str, Any]] = []
    firstResponseActions: list[Dict[str, Any]] = []
    protocolVersion: Optional[str] = None
    tttMinutes: Optional[int] = None


@router.post("/sync/visit")
async def sync_visit(
    visit: VisitRecordSchema,
    db: Session = Depends(get_db),
) -> Dict[str, str]:
    """Upsert a mobile visit record into PostgreSQL and trigger high-risk alerts.

    Args:
        visit: Mobile visit payload using the shared VisitRecord shape.
        db: SQLAlchemy session injected by FastAPI.

    Returns:
        Sync status and the synced visit identifier.
    """
    visit_data = _visit_to_orm_data(visit)
    existing_visit = db.get(VisitORM, visit.id)

    _ensure_patient_exists(db, visit)

    if existing_visit is None:
        db.add(VisitORM(**visit_data))
    else:
        for field_name, field_value in visit_data.items():
            setattr(existing_visit, field_name, field_value)

    db.commit()

    if visit.riskLevel in {"HIGH", "CRITICAL"}:
        notify_anm_supervisor(visit)
        # Persist a severe-case alert for the supervisor dashboard. Idempotent:
        # a re-sync of the same visit refreshes the urgency score but never
        # overwrites the supervisor's recorded actions.
        try:
            persisted_visit = db.get(VisitORM, visit.id)
            patient_row = db.get(PatientORM, visit.patientId)
            patient_name = None
            village = None
            district = None
            age_years = None
            is_pregnant = False
            if patient_row is not None:
                patient_name = (
                    getattr(patient_row, "nameLatin", None)
                    or getattr(patient_row, "name", None)
                )
                village = getattr(patient_row, "village", None)
                # PatientORM has no district column today; the dashboard
                # resolves district from the seeded supervision data instead.
                district = None
                age_years = getattr(patient_row, "ageYears", None)
                is_pregnant = bool(getattr(patient_row, "isPregnant", False))
            create_alert_from_visit(
                db,
                visit=persisted_visit,
                patient_name=patient_name,
                village=village,
                district=district,
                age_years=age_years,
                is_pregnant=is_pregnant,
            )
        except Exception:  # pragma: no cover — alerting must never break sync
            logger.exception("Failed to persist severe-case alert for visit %s", visit.id)

    return {"status": "synced", "visitId": visit.id}


@router.get("/sync/status/{ashaId}")
async def get_sync_status(
    ashaId: str,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Return sync summary metadata for one ASHA worker.

    Args:
        ashaId: Identifier of the ASHA worker whose sync state is requested.
        db: SQLAlchemy session injected by FastAPI.

    Returns:
        Pending server sync count and the latest sync timestamp.
    """
    pending_sync_count = (
        db.query(VisitORM)
        .filter(VisitORM.ashaId == ashaId, VisitORM.syncedToCloud.is_(False))
        .count()
    )
    last_sync_at = (
        db.query(func.max(VisitORM.syncedAt))
        .filter(VisitORM.ashaId == ashaId)
        .scalar()
    )

    return {
        "pendingSyncCount": pending_sync_count,
        "lastSyncAt": _datetime_to_iso(last_sync_at),
    }


def notify_anm_supervisor(visit: VisitRecordSchema) -> None:
    """Log an ANM supervisor alert for high-risk visit records."""
    logger.warning(
        "ANM alert triggered for visit %s with risk level %s",
        visit.id,
        visit.riskLevel,
    )


def _ensure_patient_exists(db: Session, visit: VisitRecordSchema) -> None:
    """Cascade-create a placeholder patient row if the visit references an unknown id.

    Visits should never fail to sync because the patient record happens to be
    queued behind them. We insert the minimum required to satisfy a lookup;
    a subsequent /api/patient upsert will fill in the rest.
    """
    existing = db.get(PatientORM, visit.patientId)
    if existing is not None:
        return

    now = datetime.now(timezone.utc)
    db.add(
        PatientORM(
            id=visit.patientId,
            ashaId=visit.ashaId,
            name="(pending sync)",
            languageCode=visit.languageCode or "hi",
            isPregnant=False,
            isPostpartum=False,
            createdAt=now,
            updatedAt=now,
        )
    )


def _visit_to_orm_data(visit: VisitRecordSchema) -> Dict[str, Any]:
    """Convert a VisitRecord request into SQLAlchemy model fields."""
    return {
        "id": visit.id,
        "patientId": visit.patientId,
        "ashaId": visit.ashaId,
        "visitDate": visit.visitDate,
        "rawTranscriptText": visit.rawTranscriptText,
        "extractedVitals": _model_to_dict(visit.extractedVitals),
        "symptoms": visit.symptoms,
        "consent": _model_to_dict(visit.consent),
        "languageCode": visit.languageCode,
        "riskScore": visit.riskScore,
        "riskLevel": visit.riskLevel,
        "referralGenerated": visit.referralGenerated,
        "followUpPlan": visit.followUpPlan,
        "syncedToCloud": True,
        "syncedAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc),
        "firedRules": visit.firedRules or [],
        "firstResponseActions": visit.firstResponseActions or [],
        "protocolVersion": visit.protocolVersion,
        "tttMinutes": visit.tttMinutes,
    }


def _model_to_dict(model: BaseModel) -> Dict[str, Any]:
    """Convert a Pydantic model to a dictionary across Pydantic versions."""
    if hasattr(model, "model_dump"):
        return model.model_dump()

    return model.dict()


def _datetime_to_iso(value: Optional[datetime]) -> str:
    """Convert an optional datetime into an ISO timestamp string."""
    if value is None:
        return ""

    return value.isoformat()

