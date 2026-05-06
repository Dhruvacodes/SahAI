# backend/app/services/longitudinal.py

from __future__ import annotations
"""Compute trend deltas and velocity warnings from patient's past visits."""
from datetime import date, datetime
from typing import Dict, List, Optional
from sqlalchemy.orm import Session
from app.models.visit import VisitORM


VELOCITY_THRESHOLDS = {
    "systolicBP_rise_per_14days": 20,  # +20mmHg in 14d → flag
    "diastolicBP_rise_per_14days": 15,
    "weight_loss_pct_per_30days": 5,   # 5% loss → flag (esp. for children/TB)
}


def _safe_get(visit: VisitORM, key: str) -> Optional[float]:
    if not visit.extractedVitals:
        return None
    v = visit.extractedVitals.get(key)
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _days_ago(visit_date_str: str) -> int:
    try:
        d = datetime.fromisoformat(visit_date_str.replace("Z", "+00:00")).date()
        return (date.today() - d).days
    except Exception:
        return 999


def get_patient_trends(
    db: Session,
    patient_id: str,
    current_vitals: Dict,
    n_visits: int = 3,
) -> Dict:
    """
    Returns: {
      "trend_context": "Systolic BP: 118 → 148 (+30, 14d ago) | ...",
      "velocity_warnings": ["RAPID_BP_RISE: +30 mmHg in 14 days"],
      "has_trend": bool,
    }
    """
    past = (
        db.query(VisitORM)
        .filter(VisitORM.patientId == patient_id)
        .order_by(VisitORM.visitDate.desc())
        .limit(n_visits)
        .all()
    )
    if not past:
        return {"trend_context": "First recorded visit.", "velocity_warnings": [], "has_trend": False}
    
    deltas = []
    velocity_warnings = []
    
    for key, label in [("systolicBP", "Systolic BP"),
                        ("diastolicBP", "Diastolic BP"),
                        ("weight", "Weight"),
                        ("haemoglobin", "Haemoglobin")]:
        curr = current_vitals.get(key)
        if curr is None:
            continue
        try:
            curr = float(curr)
        except (TypeError, ValueError):
            continue
        prev = _safe_get(past[0], key)
        if prev is None:
            continue
        delta = curr - prev
        days_ago = _days_ago(past[0].visitDate)
        sign = "+" if delta >= 0 else ""
        deltas.append(f"{label}: {prev:.0f} → {curr:.0f} ({sign}{delta:.0f}, {days_ago}d ago)")
        
        # Velocity rules
        if key == "systolicBP" and delta >= VELOCITY_THRESHOLDS["systolicBP_rise_per_14days"] and days_ago <= 14:
            velocity_warnings.append(f"RAPID_BP_RISE: +{delta:.0f} mmHg in {days_ago} days")
        if key == "diastolicBP" and delta >= VELOCITY_THRESHOLDS["diastolicBP_rise_per_14days"] and days_ago <= 14:
            velocity_warnings.append(f"RAPID_DBP_RISE: +{delta:.0f} mmHg in {days_ago} days")
    
    return {
        "trend_context": " | ".join(deltas) if deltas else "No comparable trends in last visit.",
        "velocity_warnings": velocity_warnings,
        "has_trend": bool(deltas),
    }
