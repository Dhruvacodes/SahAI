"""SQLAlchemy model for the severe-case alert queue.

A row is created whenever a HIGH or CRITICAL visit is synced to the backend.
The supervisor dashboard reads from this table to surface urgent cases in
real time, and the mobile client polls a feedback endpoint to learn the
current status (acknowledged, dispatched, resolved) so the originating ASHA
worker knows their case is being handled.

Design notes:

* This is a server-internal table (not a wire-shape mirror), so it follows
  the snake_case + ``Column``-style pattern used by ``audit_event.py``,
  ``cost_event.py``, ``consent_receipt.py`` and ``anm_supervisor.py``.
* IDs are server-generated UUID4 strings.
* Timestamps are real ``DateTime(timezone=True)`` columns (not ISO strings).
* ``payload`` carries metadata only (rule ids, flags, vitals snapshot,
  chief complaint, language) — never raw transcript or PII beyond what is
  already required to dispatch care.
* Status transitions are append-only via dedicated columns:
  ``NEW`` -> ``ACKNOWLEDGED`` -> ``DISPATCHED`` -> ``RESOLVED``.
"""

from __future__ import annotations

import uuid

from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    Float,
    Integer,
    String,
    Text,
    func,
)

from app.db.session import Base


class SevereCaseAlertORM(Base):
    """One row per HIGH/CRITICAL visit reaching the backend."""

    __tablename__ = "severe_case_alerts"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    # Anchors (free-form strings — match the existing convention; no FK because
    # there is no asha_workers table and visit ids are client-supplied).
    visit_id = Column(String, nullable=False, index=True, unique=True)
    patient_id = Column(String, nullable=False, index=True)
    asha_id = Column(String, nullable=False, index=True)
    anm_id = Column(String, nullable=True, index=True)
    district = Column(String, nullable=True, index=True)
    village = Column(String, nullable=True)

    # Risk packet (computed by the protocol engine, copied here so the
    # dashboard does not need to join back to visits for queue rendering).
    risk_level = Column(String, nullable=False, index=True)  # HIGH | CRITICAL
    risk_score = Column(Float, nullable=False, default=0.0)  # 0..100
    urgency_score = Column(Float, nullable=False, default=0.0, index=True)
    ttt_minutes = Column(Integer, nullable=True)
    sla_due_at = Column(DateTime(timezone=True), nullable=True, index=True)

    # Lightweight summary surfaces for queue cards.
    chief_complaint = Column(Text, nullable=True)
    language_code = Column(String, nullable=True)
    patient_name = Column(String, nullable=True)
    visit_type = Column(String, nullable=True)

    # Provenance.
    fired_rule_ids = Column(JSON, nullable=True, default=list)
    flags = Column(JSON, nullable=True, default=list)
    vitals_snapshot = Column(JSON, nullable=True, default=dict)
    payload = Column(JSON, nullable=True, default=dict)
    protocol_version = Column(String, nullable=True)

    # State machine.
    status = Column(
        String, nullable=False, default="NEW", index=True
    )  # NEW | ACKNOWLEDGED | DISPATCHED | RESOLVED
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    acknowledged_by = Column(String, nullable=True)
    dispatched_at = Column(DateTime(timezone=True), nullable=True)
    dispatched_by = Column(String, nullable=True)
    dispatch_eta_minutes = Column(Integer, nullable=True)
    dispatch_notes = Column(Text, nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolved_by = Column(String, nullable=True)
    resolution_notes = Column(Text, nullable=True)

    # Server timestamps.
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), index=True, nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
