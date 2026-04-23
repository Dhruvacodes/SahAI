"""Dashboard summary API routes for ANM supervisor views."""

from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.visit import VisitORM

router = APIRouter(tags=["dashboard"])


class TopRiskPatient(BaseModel):
    """High-risk patient summary row for the dashboard table."""

    patientId: str
    patientName: str
    village: str
    riskLevel: str
    riskScore: int
    lastVisitDate: str
    topFlag: str


class DashboardSummary(BaseModel):
    """Aggregated dashboard metrics for an ANM supervisor."""

    totalVisitsToday: int
    criticalCases: int
    highRiskCases: int
    avgRiskScore: float
    topRiskPatients: list[TopRiskPatient]


class DistrictHeatmapRow(BaseModel):
    """District-level risk aggregation row for the heatmap table."""

    name: str
    avgRiskScore: float
    criticalCount: int
    totalVisits: int
    dominantRisk: str


class DistrictHeatmapResponse(BaseModel):
    """District-level risk aggregation payload for dashboard heatmap views."""

    districts: list[DistrictHeatmapRow]


@router.get("/dashboard/summary", response_model=DashboardSummary)
async def get_dashboard_summary(
    anmId: str = Query(...),
    db: Session = Depends(get_db),
) -> DashboardSummary:
    """Return visit and risk metrics for ASHAs supervised by one ANM.

    Args:
        anmId: ANM supervisor identifier. The current scaffold treats matching
            `ashaId` values as the supervised scope until a supervision table exists.
        db: SQLAlchemy session injected by FastAPI.

    Returns:
        Aggregated visit totals, risk counts, average score, and top five high-risk patients.
    """
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
async def get_district_heatmap(
    db: Session = Depends(get_db),
) -> DistrictHeatmapResponse:
    """Return district-level risk aggregates for recent visits.

    Args:
        db: SQLAlchemy session injected by FastAPI.

    Returns:
        District averages, critical counts, total visits, and dominant risk labels.
    """
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
            criticalCount=sum(
                1 for visit in grouped_visits if visit.riskLevel == "CRITICAL"
            ),
            totalVisits=len(grouped_visits),
            dominantRisk=_dominant_risk(grouped_visits),
        )
        for district_name, grouped_visits in sorted(district_groups.items())
    ]

    return DistrictHeatmapResponse(districts=rows)


def _get_supervised_asha_ids(anm_id: str) -> list[str]:
    """Return ASHA identifiers supervised by an ANM in the current scaffold."""
    return [anm_id]


def _seven_days_ago() -> datetime:
    """Return the UTC lower bound for the dashboard summary window."""
    return datetime.now(timezone.utc) - timedelta(days=7)


def _parse_visit_datetime(visit_date: str) -> datetime:
    """Parse a stored visit date into a timezone-aware UTC datetime."""
    try:
        normalized = visit_date.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return datetime.min.replace(tzinfo=timezone.utc)

    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)

    return parsed.astimezone(timezone.utc)


def _average_risk_score(visits: list[VisitORM]) -> float:
    """Calculate the average risk score for a collection of visits."""
    if not visits:
        return 0.0

    return round(sum(visit.riskScore for visit in visits) / len(visits), 1)


def _top_risk_patients(visits: list[VisitORM]) -> list[TopRiskPatient]:
    """Return the top five high-risk patient rows sorted by score and recency."""
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
    """Read patient display name from JSON vitals metadata when available."""
    metadata = _metadata_from_visit(visit)
    value = metadata.get("patientName")
    return str(value) if value else visit.patientId


def _extract_village(visit: VisitORM) -> str:
    """Read village from JSON vitals metadata when available."""
    metadata = _metadata_from_visit(visit)
    value = metadata.get("village")
    return str(value) if value else "Not recorded"


def _extract_district(visit: VisitORM) -> str:
    """Read district from JSON vitals metadata when available."""
    metadata = _metadata_from_visit(visit)
    value = metadata.get("district")
    return str(value) if value else "Unknown District"


def _extract_top_flag(visit: VisitORM) -> str:
    """Read the most important warning flag from visit metadata or symptoms."""
    metadata = _metadata_from_visit(visit)
    risk_flags = metadata.get("riskFlags")
    if isinstance(risk_flags, list) and risk_flags:
        return str(risk_flags[0])

    if isinstance(visit.symptoms, list) and visit.symptoms:
        return str(visit.symptoms[0])

    return f"{visit.riskLevel} risk visit"


def _metadata_from_visit(visit: VisitORM) -> dict[str, Any]:
    """Return optional metadata stored alongside extracted vitals."""
    if isinstance(visit.extractedVitals, dict):
        metadata = visit.extractedVitals.get("_metadata")
        if isinstance(metadata, dict):
            return metadata

    return {}


def _dominant_risk(visits: list[VisitORM]) -> str:
    """Return the dominant risk label for a group of visits."""
    if not visits:
        return "LOW"

    severity_order = {"LOW": 0, "MEDIUM": 1, "HIGH": 2, "CRITICAL": 3}
    counts = {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0}

    for visit in visits:
        if visit.riskLevel in counts:
            counts[visit.riskLevel] += 1

    return max(
        counts,
        key=lambda level: (counts[level], severity_order[level]),
    )
