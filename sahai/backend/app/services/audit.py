# backend/app/services/audit.py

from __future__ import annotations
"""Immutable audit log service. NEVER include raw transcript or PII in payload_summary."""
import uuid
from sqlalchemy.orm import Session
from app.models.audit_event import AuditEventORM


def log_event(db: Session, *,
              actor_id: str, actor_role: str,
              event_type: str,
              target_id: str = None,
              payload_summary: dict = None,
              request_ip: str = None) -> str:
    """Log an audit event. NEVER include raw transcript or PII in payload_summary."""
    event_id = str(uuid.uuid4())
    event = AuditEventORM(
        id=event_id,
        actor_id=actor_id, actor_role=actor_role,
        event_type=event_type, target_id=target_id,
        payload_summary=payload_summary, request_ip=request_ip,
    )
    db.add(event)
    db.commit()
    return event_id
