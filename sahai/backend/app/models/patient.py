"""SQLAlchemy model for ASHA patient records.

Patients are owned by a single ASHA worker and synced from her device.
The mobile client generates the primary key (a UUID) so syncs are idempotent
even if the device is offline when the record is created.
"""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class PatientORM(Base):
    """A patient record managed by an ASHA worker."""

    __tablename__ = "patients"

    id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    ashaId: Mapped[str] = mapped_column(String, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    ageYears: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    sex: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    isPregnant: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    gestationalWeeks: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    isPostpartum: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    daysPostpartum: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    village: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    languageCode: Mapped[str] = mapped_column(String, nullable=False, default="hi")
    consentReceiptHash: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    createdAt: Mapped[datetime] = mapped_column(
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
