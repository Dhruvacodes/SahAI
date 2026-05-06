"""SQLAlchemy model for synced ASHA visit records."""

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Integer, Float, String, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class VisitORM(Base):
    """Persisted visit record synced from a mobile device."""

    __tablename__ = "visits"

    id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    patientId: Mapped[str] = mapped_column(String, nullable=False, index=True)
    ashaId: Mapped[str] = mapped_column(String, nullable=False, index=True)
    visitDate: Mapped[str] = mapped_column(String, nullable=False)
    rawTranscriptText: Mapped[str] = mapped_column(Text, nullable=False, default="")
    extractedVitals: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    symptoms: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    consent: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    languageCode: Mapped[str] = mapped_column(String, nullable=False, default="hi")
    riskScore: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    riskLevel: Mapped[str] = mapped_column(String, nullable=False, index=True)
    referralGenerated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    followUpPlan: Mapped[str] = mapped_column(Text, nullable=False, default="")
    syncedToCloud: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    syncedAt: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updatedAt: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    # Outcome tracking (added in V3)
    outcome_status: Mapped[str] = mapped_column(
        String, default="PENDING", nullable=True
    )  # PENDING|ATTENDED_CONFIRMED|ATTENDED_OTHER|DID_NOT_ATTEND|UNKNOWN
    outcome_notes: Mapped[str] = mapped_column(Text, nullable=True)
    outcome_recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
