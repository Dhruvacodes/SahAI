"""ORM model for DPDP-compliant consent receipts."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, String, Text, JSON, func

from app.db.session import Base


class ConsentReceiptORM(Base):
    """Persisted consent receipt with hash-based integrity and withdrawal support."""

    __tablename__ = "consent_receipts"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id = Column(String, index=True, nullable=False)
    asha_id = Column(String, index=True, nullable=False)
    consent_granted = Column(Boolean, nullable=False)
    scope_agreed = Column(JSON, nullable=False)
    language_code = Column(String, nullable=False)
    witness_present = Column(Boolean, default=False)
    receipt_hash = Column(String, unique=True, nullable=False, index=True)
    granted_at = Column(DateTime(timezone=True), nullable=False)
    withdrawn_at = Column(DateTime(timezone=True), nullable=True)
    withdrawal_reason = Column(Text, nullable=True)
    dpdp_notice_version = Column(String, default="2026.05")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
