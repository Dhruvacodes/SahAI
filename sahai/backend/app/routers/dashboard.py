"""Dashboard summary API routes for ANM supervisor views.
Updated V3: adds cluster alerts, cost summary, patient visits, and outcome tracking.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.visit import VisitORM
from app.models.cost_event import CostEventORM
from app.services.cluster_detector import detect_clusters

router = APIRouter(tags=["dashboard"])

DEMO_SUPERVISION_MAP = {
    "anm-demo": ["asha-savitri", "asha-meena", "asha-priya"],
    "demo_anm_pune_001": ["demo-asha-001", "demo-asha-002"],
}


class TopRiskPatient(BaseModel):
    patientId: str
    patientName: str
    village: str
    riskLevel: str
    riskScore: float
    lastVisitDate: str
    topFlag: str


class DashboardSummary(BaseModel):
    totalVisitsToday: int
    criticalCases: int
    highRiskCases: int
    avgRiskScore: float
    topRiskPatients: list[TopRiskPatient]


class DistrictHeatmapRow(BaseModel):
    name: str
    avgRiskScore: float
    criticalCount: int
    totalVisits: int
    dominantRisk: str


class DistrictHeatmapResponse(BaseModel):
    districts: list[DistrictHeatmapRow]


@router.get("/dashboard/summary", response_model=DashboardSummary)
async def get_dashboard_summary(
    anmId: str = Query(...),
    db: Session = Depends(get_db),
) -> DashboardSummary:
    visits = (
        db.query(VisitORM)
        .filter(VisitORM.ashaId.in_(_get_supervised_asha_ids(anmId)))
        .all()
    )
    recent_visits = [
        visit for visit in visits if _parse_visit_datetime(visit.visitDate) >= _seven_days_ago()
    ]

    today = datetime.now(timezone.utc).date()
    total_visits_today = sum(
        1 for visit in recent_visits if _parse_visit_datetime(visit.visitDate).date() == today
    )
    critical_cases = sum(1 for visit in recent_visits if visit.riskLevel == "CRITICAL")
    high_risk_cases = sum(1 for visit in recent_visits if visit.riskLevel == "HIGH")
    avg_risk_score = _average_risk_score(recent_visits)

    return DashboardSummary(
        totalVisitsToday=total_visits_today,
        criticalCases=critical_cases,
        highRiskCases=high_risk_cases,
        avgRiskScore=avg_risk_score,
        topRiskPatients=_top_risk_patients(recent_visits),
    )


@router.get("/dashboard/district-heatmap", response_model=DistrictHeatmapResponse)
async def get_district_heatmap(db: Session = Depends(get_db)) -> DistrictHeatmapResponse:
    visits = db.query(VisitORM).all()
    recent_visits = [
        visit for visit in visits if _parse_visit_datetime(visit.visitDate) >= _seven_days_ago()
    ]
    district_groups: dict[str, list[VisitORM]] = {}

    for visit in recent_visits:
        district_name = _extract_district(visit)
        district_groups.setdefault(district_name, []).append(visit)

    rows = [
        DistrictHeatmapRow(
            name=district_name,
            avgRiskScore=_average_risk_score(grouped_visits),
            criticalCount=sum(1 for visit in grouped_visits if visit.riskLevel == "CRITICAL"),
            totalVisits=len(grouped_visits),
            dominantRisk=_dominant_risk(grouped_visits),
        )
        for district_name, grouped_visits in sorted(district_groups.items())
    ]

    return DistrictHeatmapResponse(districts=rows)


@router.get("/dashboard/cluster-alerts")
async def cluster_alerts(db: Session = Depends(get_db)):
    """Detect disease clusters from recent visit patterns."""
    return {"alerts": detect_clusters(db)}


@router.get("/dashboard/cost-summary")
async def cost_summary(db: Session = Depends(get_db)):
    """Return daily cost telemetry in INR."""
    today = datetime.now(timezone.utc).date()
    today_start = datetime(today.year, today.month, today.day, tzinfo=timezone.utc)
    week_start = today_start - timedelta(days=7)

    today_costs = db.query(func.sum(CostEventORM.estimated_cost_inr)).filter(
        CostEventORM.created_at >= today_start
    ).scalar() or 0.0

    week_costs = db.query(func.sum(CostEventORM.estimated_cost_inr)).filter(
        CostEventORM.created_at >= week_start
    ).scalar() or 0.0

    total_visits_today = db.query(func.count(func.distinct(CostEventORM.visit_id))).filter(
        CostEventORM.created_at >= today_start, CostEventORM.visit_id.isnot(None)
    ).scalar() or 0

    per_visit_inr = round(today_costs / max(total_visits_today, 1), 2)

    # Model split
    model_split = (
        db.query(CostEventORM.provider, func.sum(CostEventORM.estimated_cost_inr))
        .filter(CostEventORM.created_at >= week_start)
        .group_by(CostEventORM.provider)
        .all()
    )

    return {
        "todayINR": round(today_costs, 2),
        "weekINR": round(week_costs, 2),
        "perVisitINR": per_visit_inr,
        "totalVisitsToday": total_visits_today,
        "modelSplit": {provider: round(cost, 2) for provider, cost in model_split},
    }


@router.get("/dashboard/patient/{patient_id}/visits")
async def patient_visits(patient_id: str, db: Session = Depends(get_db)):
    """Return visit history for a specific patient."""
    visits = (
        db.query(VisitORM)
        .filter(VisitORM.patientId == patient_id)
        .order_by(VisitORM.visitDate.desc())
        .limit(20)
        .all()
    )
    return {
        "patientId": patient_id,
        "visits": [
            {
                "id": v.id,
                "visitDate": v.visitDate,
                "riskLevel": v.riskLevel,
                "riskScore": v.riskScore,
                "symptoms": v.symptoms,
                "vitals": v.extractedVitals,
                "referralGenerated": v.referralGenerated,
                "outcomeStatus": v.outcome_status,
            }
            for v in visits
        ],
    }


class OutcomeRequest(BaseModel):
    status: str
    notes: Optional[str] = None


@router.post("/dashboard/patient/{patient_id}/visit/{visit_id}/outcome")
async def record_outcome(
    patient_id: str,
    visit_id: str,
    req: OutcomeRequest,
    db: Session = Depends(get_db),
):
    """Record referral outcome for a visit."""
    visit = db.get(VisitORM, visit_id)
    if not visit or visit.patientId != patient_id:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Visit not found")
    visit.outcome_status = req.status
    visit.outcome_notes = req.notes
    visit.outcome_recorded_at = datetime.now(timezone.utc)
    db.commit()
    return {"status": "recorded", "visitId": visit_id}


# === Helper functions ===

def _get_supervised_asha_ids(anm_id: str) -> List[str]:
    return DEMO_SUPERVISION_MAP.get(anm_id, [anm_id])


def _seven_days_ago() -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=7)


def _parse_visit_datetime(visit_date: str) -> datetime:
    try:
        normalized = visit_date.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return datetime.min.replace(tzinfo=timezone.utc)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _average_risk_score(visits: list[VisitORM]) -> float:
    if not visits:
        return 0.0
    return round(sum(visit.riskScore for visit in visits) / len(visits), 2)


def _top_risk_patients(visits: list[VisitORM]) -> List[TopRiskPatient]:
    high_risk_visits = [
        visit for visit in visits if visit.riskLevel in {"HIGH", "CRITICAL"}
    ]
    sorted_visits = sorted(
        high_risk_visits,
        key=lambda visit: (visit.riskScore, _parse_visit_datetime(visit.visitDate)),
        reverse=True,
    )
    unique_patient_visits: list[VisitORM] = []
    seen_patient_ids: set[str] = set()

    for visit in sorted_visits:
        if visit.patientId in seen_patient_ids:
            continue
        unique_patient_visits.append(visit)
        seen_patient_ids.add(visit.patientId)

    return [
        TopRiskPatient(
            patientId=visit.patientId,
            patientName=_extract_patient_name(visit),
            village=_extract_village(visit),
            riskLevel=visit.riskLevel,
            riskScore=visit.riskScore,
            lastVisitDate=visit.visitDate,
            topFlag=_extract_top_flag(visit),
        )
        for visit in unique_patient_visits[:5]
    ]


def _extract_patient_name(visit: VisitORM) -> str:
    metadata = _metadata_from_visit(visit)
    value = metadata.get("patientName")
    return str(value) if value else visit.patientId


def _extract_village(visit: VisitORM) -> str:
    metadata = _metadata_from_visit(visit)
    value = metadata.get("village")
    return str(value) if value else "Not recorded"


def _extract_district(visit: VisitORM) -> str:
    metadata = _metadata_from_visit(visit)
    value = metadata.get("district")
    return str(value) if value else "Unknown District"


def _extract_top_flag(visit: VisitORM) -> str:
    metadata = _metadata_from_visit(visit)
    risk_flags = metadata.get("riskFlags")
    if isinstance(risk_flags, list) and risk_flags:
        return str(risk_flags[0])
    if isinstance(visit.symptoms, list) and visit.symptoms:
        return str(visit.symptoms[0])
    return f"{visit.riskLevel} risk visit"


def _metadata_from_visit(visit: VisitORM) -> Dict[str, Any]:
    if isinstance(visit.extractedVitals, dict):
        metadata = visit.extractedVitals.get("_metadata")
        if isinstance(metadata, dict):
            return metadata
    return {}


def _dominant_risk(visits: list[VisitORM]) -> str:
    if not visits:
        return "LOW"
    severity_order = {"LOW": 0, "MODERATE": 1, "HIGH": 2, "CRITICAL": 3}
    counts = {"LOW": 0, "MODERATE": 0, "HIGH": 0, "CRITICAL": 0}
    for visit in visits:
        if visit.riskLevel in counts:
            counts[visit.riskLevel] += 1
    return max(counts, key=lambda level: (counts[level], severity_order.get(level, 0)))
