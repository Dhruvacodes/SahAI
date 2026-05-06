"""Severe-case alert lifecycle.

A single visit syncing at HIGH or CRITICAL produces exactly one alert row.
The service owns:

  * idempotent creation (so a re-sync of the same visit does not duplicate),
  * urgency-score computation per ``protocols/v1/ttt.v1.json``,
  * SLA due-time computation,
  * status transitions (acknowledge / dispatch / resolve),
  * broadcast notifications to the in-process pub/sub bus used by SSE.

The bus itself is intentionally simple and lives in ``app.services.alert_bus``
(an asyncio fanout). In production this should be swapped for Redis pubsub
or NATS, but for the demo a single-process bus is sufficient and it lets us
keep the dependency footprint small.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.severe_case_alert import SevereCaseAlertORM
from app.models.visit import VisitORM
from app.services import alert_bus, audit
from app.services.protocol_engine import _CATALOG_DIR

log = logging.getLogger(__name__)


# ─── supervision map (mirrors dashboard.py for now) ─────────────────────────


DEMO_SUPERVISION_MAP: Dict[str, List[str]] = {
    "anm-demo": ["asha-savitri", "asha-meena", "asha-priya"],
    "demo_anm_pune_001": ["demo-asha-001", "demo-asha-002"],
}


def resolve_anm_for_asha(asha_id: str) -> Optional[str]:
    """Return the ANM id that supervises ``asha_id`` if known, else None.

    Today this consults the in-memory demo map; once an ``asha_workers``
    table exists the lookup will use that instead.
    """
    if not asha_id:
        return None
    for anm_id, asha_ids in DEMO_SUPERVISION_MAP.items():
        if asha_id in asha_ids:
            return anm_id
    return None


# ─── TTT and urgency score ──────────────────────────────────────────────────


def _load_ttt_config() -> Dict[str, Any]:
    path = Path(_CATALOG_DIR) / "ttt.v1.json"
    if not path.exists():
        return {
            "defaults": {"CRITICAL": 30, "HIGH": 240, "MODERATE": 1440, "LOW": 10080},
            "urgency_score": {
                "level_weight": {"LOW": 0, "MODERATE": 25, "HIGH": 60, "CRITICAL": 100},
                "life_threat_bonus": 25,
                "age_modifiers": {
                    "infant_under_2_months": 15,
                    "child_under_5_years": 10,
                    "elderly_over_60_years": 5,
                },
                "pregnancy_modifier": 10,
            },
        }
    with path.open(encoding="utf-8") as fp:
        return json.load(fp)


_TTT_CONFIG: Dict[str, Any] = _load_ttt_config()


# Fired-rule ids that count as "life-threat" for the urgency bonus.
_LIFE_THREAT_RULE_TOKENS: Tuple[str, ...] = (
    "GUNSHOT",
    "PENETRATING",
    "AIRWAY",
    "SHOCK",
    "ECLAMPSIA",
    "HEMORRHAGE",
    "PPH.PRIMARY",
    "DANGER_SIGN",
    "SEVERE_DEHYDRATION",
    "SEVERE.PE",
    "PE.SEVERE",
    "SUICIDAL",
    "BITE.SNAKE",
    "MALARIA.SEVERE",
)


def _has_life_threat(fired_rule_ids: Iterable[str]) -> bool:
    upper = [(rid or "").upper() for rid in fired_rule_ids]
    return any(any(token in rid for token in _LIFE_THREAT_RULE_TOKENS) for rid in upper)


def _age_modifier(
    age_years: Optional[int],
    age_months: Optional[int],
) -> int:
    mods = _TTT_CONFIG.get("urgency_score", {}).get("age_modifiers", {})
    if age_months is not None and age_months < 2:
        return int(mods.get("infant_under_2_months", 15))
    if age_years is not None and age_years < 5:
        return int(mods.get("child_under_5_years", 10))
    if age_years is not None and age_years >= 60:
        return int(mods.get("elderly_over_60_years", 5))
    return 0


def _level_weight(level: str) -> int:
    return int(
        _TTT_CONFIG.get("urgency_score", {})
        .get("level_weight", {})
        .get(level, 0)
    )


def compute_urgency_score(
    *,
    risk_level: str,
    fired_rule_ids: Iterable[str],
    ttt_minutes_remaining: int,
    age_years: Optional[int] = None,
    age_months: Optional[int] = None,
    is_pregnant: bool = False,
) -> float:
    """Implement the ``urgency_score`` formula from ``ttt.v1.json``."""
    cfg = _TTT_CONFIG.get("urgency_score", {})
    level_weight = _level_weight(risk_level)
    life_threat = (
        int(cfg.get("life_threat_bonus", 25)) if _has_life_threat(fired_rule_ids) else 0
    )
    age_mod = _age_modifier(age_years, age_months)
    pregnancy_mod = int(cfg.get("pregnancy_modifier", 10)) if is_pregnant else 0
    ttt_bonus = 1000.0 / max(int(ttt_minutes_remaining or 1), 1)
    return float(level_weight + life_threat + age_mod + pregnancy_mod + ttt_bonus)


def compute_sla_due_at(
    *, created_at: datetime, ttt_minutes: Optional[int]
) -> datetime:
    """SLA due time is creation + min(rule.ttt_minutes) per the engine."""
    minutes = int(ttt_minutes) if isinstance(ttt_minutes, int) and ttt_minutes > 0 else 30
    return created_at + timedelta(minutes=minutes)


# ─── lifecycle ──────────────────────────────────────────────────────────────


def _existing_alert_for_visit(db: Session, visit_id: str) -> Optional[SevereCaseAlertORM]:
    return (
        db.query(SevereCaseAlertORM)
        .filter(SevereCaseAlertORM.visit_id == visit_id)
        .one_or_none()
    )


def _fired_rule_ids_from_visit(visit: VisitORM) -> List[str]:
    rules = getattr(visit, "firedRules", None) or []
    out: List[str] = []
    for rule in rules:
        if isinstance(rule, dict):
            rid = rule.get("id")
            if rid:
                out.append(str(rid))
    return out


def _short_chief_complaint(visit: VisitORM) -> str:
    """Best-effort one-line summary for queue cards (no transcript dump)."""
    symptoms = getattr(visit, "symptoms", None) or []
    if symptoms:
        joined = "; ".join(str(s).strip() for s in symptoms[:3] if s)
        if joined:
            return joined[:240]
    flags = getattr(visit, "flags", None) or []
    if flags:
        return "; ".join(str(f) for f in flags[:3])[:240]
    return ""


def create_alert_from_visit(
    db: Session,
    *,
    visit: VisitORM,
    patient_name: Optional[str] = None,
    village: Optional[str] = None,
    district: Optional[str] = None,
    visit_type: Optional[str] = None,
    age_years: Optional[int] = None,
    age_months: Optional[int] = None,
    is_pregnant: bool = False,
    risk_flags: Optional[List[str]] = None,
) -> Tuple[SevereCaseAlertORM, bool]:
    """Idempotently create or refresh the alert for ``visit``.

    Returns ``(alert, created)`` where ``created`` is ``True`` if a new row
    was inserted. On re-sync of the same visit we only refresh the urgency
    score and SLA window; the human-action columns (acked/dispatched/...) are
    preserved so the supervisor's decisions are never overwritten.
    """
    existing = _existing_alert_for_visit(db, visit.id)
    fired_rule_ids = _fired_rule_ids_from_visit(visit)
    flags = list(risk_flags or [])
    ttt_minutes = getattr(visit, "tttMinutes", None)
    risk_score = float(getattr(visit, "riskScore", 0.0) or 0.0)
    risk_level = getattr(visit, "riskLevel", "LOW")
    asha_id = getattr(visit, "ashaId", "")
    anm_id = resolve_anm_for_asha(asha_id)

    now = datetime.now(timezone.utc)
    sla_due_at = compute_sla_due_at(created_at=now, ttt_minutes=ttt_minutes)
    minutes_remaining = max(int((sla_due_at - now).total_seconds() // 60), 1)
    urgency = compute_urgency_score(
        risk_level=risk_level,
        fired_rule_ids=fired_rule_ids,
        ttt_minutes_remaining=minutes_remaining,
        age_years=age_years,
        age_months=age_months,
        is_pregnant=is_pregnant,
    )

    payload = {
        "firedRules": getattr(visit, "firedRules", None) or [],
        "firstResponseActions": getattr(visit, "firstResponseActions", None) or [],
        "flags": flags,
        "languageCode": getattr(visit, "languageCode", None),
    }

    if existing is None:
        alert = SevereCaseAlertORM(
            visit_id=visit.id,
            patient_id=getattr(visit, "patientId", ""),
            asha_id=asha_id,
            anm_id=anm_id,
            district=district,
            village=village,
            risk_level=risk_level,
            risk_score=risk_score,
            urgency_score=urgency,
            ttt_minutes=int(ttt_minutes) if isinstance(ttt_minutes, int) else None,
            sla_due_at=sla_due_at,
            chief_complaint=_short_chief_complaint(visit),
            language_code=getattr(visit, "languageCode", None),
            patient_name=patient_name,
            visit_type=visit_type,
            fired_rule_ids=fired_rule_ids,
            flags=flags,
            vitals_snapshot=getattr(visit, "extractedVitals", None) or {},
            payload=payload,
            protocol_version=getattr(visit, "protocolVersion", None),
            status="NEW",
        )
        db.add(alert)
        db.commit()
        db.refresh(alert)
        audit.log_event(
            db,
            actor_id="system",
            actor_role="SYSTEM",
            event_type="SEVERE_ALERT_CREATED",
            target_id=alert.id,
            payload_summary={
                "visitId": visit.id,
                "ashaId": asha_id,
                "anmId": anm_id,
                "riskLevel": risk_level,
                "urgencyScore": urgency,
                "firedRuleCount": len(fired_rule_ids),
            },
        )
        alert_bus.publish_alert("created", _serialize_alert(alert))
        return alert, True

    # Refresh dynamic columns. Preserve human decisions.
    existing.risk_level = risk_level
    existing.risk_score = risk_score
    existing.urgency_score = urgency
    existing.ttt_minutes = int(ttt_minutes) if isinstance(ttt_minutes, int) else existing.ttt_minutes
    existing.sla_due_at = sla_due_at
    existing.fired_rule_ids = fired_rule_ids or existing.fired_rule_ids
    existing.flags = flags or existing.flags
    existing.vitals_snapshot = getattr(visit, "extractedVitals", None) or existing.vitals_snapshot
    existing.payload = payload
    existing.protocol_version = getattr(visit, "protocolVersion", None) or existing.protocol_version
    existing.chief_complaint = _short_chief_complaint(visit) or existing.chief_complaint
    existing.language_code = getattr(visit, "languageCode", None) or existing.language_code
    if patient_name and not existing.patient_name:
        existing.patient_name = patient_name
    if village and not existing.village:
        existing.village = village
    if district and not existing.district:
        existing.district = district
    db.commit()
    db.refresh(existing)
    alert_bus.publish_alert("updated", _serialize_alert(existing))
    return existing, False


def _set_status(
    db: Session,
    alert_id: str,
    *,
    new_status: str,
    actor_id: str,
    extra: Optional[Dict[str, Any]] = None,
) -> Optional[SevereCaseAlertORM]:
    alert = db.get(SevereCaseAlertORM, alert_id)
    if alert is None:
        return None

    now = datetime.now(timezone.utc)
    alert.status = new_status
    if new_status == "ACKNOWLEDGED":
        alert.acknowledged_at = now
        alert.acknowledged_by = actor_id
    elif new_status == "DISPATCHED":
        if alert.acknowledged_at is None:
            alert.acknowledged_at = now
            alert.acknowledged_by = actor_id
        alert.dispatched_at = now
        alert.dispatched_by = actor_id
        if extra:
            if isinstance(extra.get("eta_minutes"), int):
                alert.dispatch_eta_minutes = extra["eta_minutes"]
            if extra.get("notes"):
                alert.dispatch_notes = str(extra["notes"])[:2000]
    elif new_status == "RESOLVED":
        alert.resolved_at = now
        alert.resolved_by = actor_id
        if extra and extra.get("notes"):
            alert.resolution_notes = str(extra["notes"])[:2000]

    db.commit()
    db.refresh(alert)

    audit.log_event(
        db,
        actor_id=actor_id,
        actor_role="ANM",
        event_type=f"SEVERE_ALERT_{new_status}",
        target_id=alert.id,
        payload_summary={
            "visitId": alert.visit_id,
            "ashaId": alert.asha_id,
            "anmId": alert.anm_id,
            "riskLevel": alert.risk_level,
            "urgencyScore": alert.urgency_score,
            **(extra or {}),
        },
    )
    alert_bus.publish_alert("updated", _serialize_alert(alert))
    return alert


def acknowledge_alert(db: Session, alert_id: str, actor_id: str) -> Optional[SevereCaseAlertORM]:
    return _set_status(db, alert_id, new_status="ACKNOWLEDGED", actor_id=actor_id)


def dispatch_alert(
    db: Session,
    alert_id: str,
    actor_id: str,
    *,
    eta_minutes: Optional[int] = None,
    notes: Optional[str] = None,
) -> Optional[SevereCaseAlertORM]:
    return _set_status(
        db,
        alert_id,
        new_status="DISPATCHED",
        actor_id=actor_id,
        extra={"eta_minutes": eta_minutes, "notes": notes},
    )


def resolve_alert(
    db: Session,
    alert_id: str,
    actor_id: str,
    *,
    notes: Optional[str] = None,
) -> Optional[SevereCaseAlertORM]:
    return _set_status(
        db, alert_id, new_status="RESOLVED", actor_id=actor_id, extra={"notes": notes}
    )


# ─── serialisation ──────────────────────────────────────────────────────────


def _iso(dt: Optional[datetime]) -> Optional[str]:
    return dt.isoformat() if dt else None


def _serialize_alert(alert: SevereCaseAlertORM) -> Dict[str, Any]:
    """Wire shape for both REST and SSE consumers."""
    return {
        "id": alert.id,
        "visitId": alert.visit_id,
        "patientId": alert.patient_id,
        "ashaId": alert.asha_id,
        "anmId": alert.anm_id,
        "district": alert.district,
        "village": alert.village,
        "patientName": alert.patient_name,
        "visitType": alert.visit_type,
        "languageCode": alert.language_code,
        "riskLevel": alert.risk_level,
        "riskScore": alert.risk_score,
        "urgencyScore": alert.urgency_score,
        "tttMinutes": alert.ttt_minutes,
        "slaDueAt": _iso(alert.sla_due_at),
        "chiefComplaint": alert.chief_complaint,
        "firedRuleIds": alert.fired_rule_ids or [],
        "flags": alert.flags or [],
        "vitals": alert.vitals_snapshot or {},
        "payload": alert.payload or {},
        "protocolVersion": alert.protocol_version,
        "status": alert.status,
        "acknowledgedAt": _iso(alert.acknowledged_at),
        "acknowledgedBy": alert.acknowledged_by,
        "dispatchedAt": _iso(alert.dispatched_at),
        "dispatchedBy": alert.dispatched_by,
        "dispatchEtaMinutes": alert.dispatch_eta_minutes,
        "dispatchNotes": alert.dispatch_notes,
        "resolvedAt": _iso(alert.resolved_at),
        "resolvedBy": alert.resolved_by,
        "resolutionNotes": alert.resolution_notes,
        "createdAt": _iso(alert.created_at),
        "updatedAt": _iso(alert.updated_at),
    }


def serialize_alert(alert: SevereCaseAlertORM) -> Dict[str, Any]:
    """Public alias for ``_serialize_alert``."""
    return _serialize_alert(alert)
