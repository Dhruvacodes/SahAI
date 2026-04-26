"""API routes for syncing offline mobile visit records to the backend."""

import logging
from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.visit import VisitORM
from app.schemas.privacy import ConsentSnapshot

logger = logging.getLogger(__name__)

router = APIRouter(tags=["sync"])

# Alembic migration command: alembic revision --autogenerate -m "create visits table" && alembic upgrade head


class ExtractedVitalsSchema(BaseModel):
    """Extracted vital signs attached to a synced visit."""

    bloodPressureSystolic: float | None = None
    bloodPressureDiastolic: float | None = None
    hemoglobinLevel: float | None = None
    fetalMovements: bool | None = None
    oedema: bool | None = None
    temperature: float | None = None


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
    riskLevel: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    referralGenerated: bool
    followUpPlan: str
    syncedToCloud: bool


@router.post("/sync/visit")
async def sync_visit(
    visit: VisitRecordSchema,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    """Upsert a mobile visit record into PostgreSQL and trigger high-risk alerts.

    Args:
        visit: Mobile visit payload using the shared VisitRecord shape.
        db: SQLAlchemy session injected by FastAPI.

    Returns:
        Sync status and the synced visit identifier.
    """
    visit_data = _visit_to_orm_data(visit)
    existing_visit = db.get(VisitORM, visit.id)

    if existing_visit is None:
        db.add(VisitORM(**visit_data))
    else:
        for field_name, field_value in visit_data.items():
            setattr(existing_visit, field_name, field_value)

    db.commit()

    if visit.riskLevel in {"HIGH", "CRITICAL"}:
        notify_anm_supervisor(visit)

    return {"status": "synced", "visitId": visit.id}


@router.get("/sync/status/{ashaId}")
async def get_sync_status(
    ashaId: str,
    db: Session = Depends(get_db),
) -> dict[str, int | str]:
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


def _visit_to_orm_data(visit: VisitRecordSchema) -> dict[str, Any]:
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
    }


def _model_to_dict(model: BaseModel) -> dict[str, Any]:
    """Convert a Pydantic model to a dictionary across Pydantic versions."""
    if hasattr(model, "model_dump"):
        return model.model_dump()

    return model.dict()


def _datetime_to_iso(value: datetime | None) -> str:
    """Convert an optional datetime into an ISO timestamp string."""
    if value is None:
        return ""

    return value.isoformat()

