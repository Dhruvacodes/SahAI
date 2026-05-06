"""ORM model for immutable audit events — metadata only, never raw PII."""

import uuid

from sqlalchemy import Column, DateTime, String, JSON, func

from app.db.session import Base


class AuditEventORM(Base):
    """Audit event for clinical, auth, and system actions.

    NEVER store raw transcript text or PII in payload_summary.
    Only metadata: length, language, visit type, hash, etc.
    """

    __tablename__ = "audit_events"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    actor_id = Column(String, index=True)
    actor_role = Column(String)  # "ASHA" | "ANM" | "SYSTEM"
    event_type = Column(String, index=True)  # CONSENT_GRANTED, ASR_TRANSCRIBE, etc.
    target_id = Column(String, index=True, nullable=True)
    payload_summary = Column(JSON, nullable=True)  # METADATA ONLY, never raw text
    request_ip = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
