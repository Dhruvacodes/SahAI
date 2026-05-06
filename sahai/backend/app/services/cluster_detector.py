# backend/app/services/cluster_detector.py

from __future__ import annotations
"""Statistical anomaly detection on visits over a sliding window."""
from datetime import datetime, timedelta
from collections import defaultdict
from sqlalchemy.orm import Session
from app.models.visit import VisitORM


KNOWN_PATTERNS = {
    "fever_rash":   {"required": ["fever"], "any_of": ["rash", "skin lesion"]},
    "fever_rigors": {"required": ["fever"], "any_of": ["rigors", "chills"]},
    "diarrhea_cluster": {"required": ["diarrhea"], "any_of": []},
    "respiratory_cluster": {"required": ["respiratory distress", "cough"], "any_of": []},
}


def detect_clusters(db: Session, window_days: int = 7, min_cases: int = 3) -> list:
    cutoff = datetime.utcnow() - timedelta(days=window_days)
    visits = db.query(VisitORM).filter(VisitORM.syncedAt >= cutoff).all()
    
    by_village: dict = defaultdict(list)
    for v in visits:
        meta = (v.extractedVitals or {}).get("_metadata", {})
        village = meta.get("village", "Unknown")
        by_village[village].append(v)
    
    alerts = []
    for village, vlist in by_village.items():
        for pattern_name, rules in KNOWN_PATTERNS.items():
            matches = []
            for v in vlist:
                syms = " ".join(v.symptoms or []).lower()
                has_required = all(r in syms for r in rules["required"])
                has_any = (not rules["any_of"]) or any(a in syms for a in rules["any_of"])
                if has_required and has_any:
                    matches.append(v)
            if len(matches) >= min_cases:
                alerts.append({
                    "village": village,
                    "pattern": pattern_name,
                    "caseCount": len(matches),
                    "windowDays": window_days,
                    "firstSeen": min(m.syncedAt for m in matches).isoformat() if matches else None,
                    "lastSeen": max(m.syncedAt for m in matches).isoformat() if matches else None,
                })
    return alerts
