"""REST + SSE endpoints for the severe-case alert queue.

Endpoints (all mounted under ``/api`` by ``main.py``):

  * ``GET    /api/alerts``                   list alerts (filters: status,
                                              anmId, riskLevel, since)
  * ``GET    /api/alerts/{alert_id}``        full alert detail
  * ``POST   /api/alerts/{alert_id}/ack``     mark acknowledged
  * ``POST   /api/alerts/{alert_id}/dispatch`` mark dispatched (eta + notes)
  * ``POST   /api/alerts/{alert_id}/resolve`` mark resolved (notes)
  * ``GET    /api/alerts/stream``            SSE feed of created/updated events
  * ``GET    /api/alerts/feedback``          mobile-facing tail for an ASHA

Auth: where present, the dashboard sends a Bearer JWT via the existing
``/api/auth/...`` flow. The mobile feedback endpoint is open and filters
strictly by ``ashaId`` (matching the rest of the mobile API which is
unauthenticated end-to-end today).
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any, AsyncIterator, Dict, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from fastapi.responses import StreamingResponse
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.severe_case_alert import SevereCaseAlertORM
from app.routers.auth import JWT_ALGO, JWT_SECRET
from app.services import alert_bus
from app.services.alert_service import (
    acknowledge_alert,
    dispatch_alert,
    resolve_alert,
    serialize_alert,
)

log = logging.getLogger(__name__)

router = APIRouter(prefix="/alerts", tags=["alerts"])


# ─── auth helpers ───────────────────────────────────────────────────────────


def _decode_token(token: str) -> Dict[str, Any]:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc


def get_anm_actor(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    """Resolve the ANM identity from the bearer JWT.

    Returns ``{id, name, role, district}``. Raises 401 if the header is
    missing/invalid. Used by the mutating endpoints (ack/dispatch/resolve).
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    payload = _decode_token(authorization.split(" ", 1)[1])
    return {
        "id": payload.get("sub"),
        "name": payload.get("name"),
        "role": payload.get("role", "ANM"),
        "district": payload.get("district"),
    }


def maybe_anm_actor(authorization: Optional[str] = Header(None)) -> Optional[Dict[str, Any]]:
    """Like ``get_anm_actor`` but returns ``None`` when no header is present.

    Used by GET endpoints that should be readable in the demo without auth.
    """
    if not authorization:
        return None
    if not authorization.lower().startswith("bearer "):
        return None
    try:
        payload = _decode_token(authorization.split(" ", 1)[1])
    except HTTPException:
        return None
    return {
        "id": payload.get("sub"),
        "name": payload.get("name"),
        "role": payload.get("role", "ANM"),
        "district": payload.get("district"),
    }


# ─── pydantic shapes ────────────────────────────────────────────────────────


class DispatchRequest(BaseModel):
    etaMinutes: Optional[int] = None
    notes: Optional[str] = None


class ResolveRequest(BaseModel):
    notes: Optional[str] = None


class AlertListResponse(BaseModel):
    alerts: List[Dict[str, Any]]
    count: int


class AlertResponse(BaseModel):
    alert: Dict[str, Any]


# ─── shared filters ─────────────────────────────────────────────────────────


def _query_alerts(
    db: Session,
    *,
    status: Optional[str] = None,
    anm_id: Optional[str] = None,
    asha_id: Optional[str] = None,
    risk_level: Optional[str] = None,
    since: Optional[datetime] = None,
    limit: int = 100,
    order: str = "urgency",
) -> List[SevereCaseAlertORM]:
    q = db.query(SevereCaseAlertORM)
    if status:
        q = q.filter(SevereCaseAlertORM.status == status.upper())
    if anm_id:
        q = q.filter(SevereCaseAlertORM.anm_id == anm_id)
    if asha_id:
        q = q.filter(SevereCaseAlertORM.asha_id == asha_id)
    if risk_level:
        q = q.filter(SevereCaseAlertORM.risk_level == risk_level.upper())
    if since:
        q = q.filter(SevereCaseAlertORM.updated_at > since)
    if order == "urgency":
        q = q.order_by(SevereCaseAlertORM.urgency_score.desc(), SevereCaseAlertORM.created_at.desc())
    elif order == "recent":
        q = q.order_by(SevereCaseAlertORM.updated_at.desc())
    elif order == "sla":
        q = q.order_by(SevereCaseAlertORM.sla_due_at.asc())
    return q.limit(limit).all()


# ─── REST endpoints ─────────────────────────────────────────────────────────


@router.get("", response_model=AlertListResponse)
def list_alerts(
    status: Optional[str] = Query(None, description="NEW|ACKNOWLEDGED|DISPATCHED|RESOLVED"),
    anmId: Optional[str] = Query(None),
    riskLevel: Optional[str] = Query(None),
    since: Optional[str] = Query(None, description="ISO timestamp"),
    limit: int = Query(100, ge=1, le=500),
    order: str = Query("urgency", description="urgency|recent|sla"),
    db: Session = Depends(get_db),
    actor: Optional[Dict[str, Any]] = Depends(maybe_anm_actor),
) -> AlertListResponse:
    """List alerts. ANM actor filter is auto-applied unless explicitly overridden."""
    effective_anm = anmId or (actor.get("id") if actor else None)
    since_dt: Optional[datetime] = None
    if since:
        try:
            since_dt = datetime.fromisoformat(since.replace("Z", "+00:00"))
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="invalid since") from exc

    rows = _query_alerts(
        db,
        status=status,
        anm_id=effective_anm,
        risk_level=riskLevel,
        since=since_dt,
        limit=limit,
        order=order,
    )
    return AlertListResponse(
        alerts=[serialize_alert(r) for r in rows],
        count=len(rows),
    )


@router.get("/feedback")
def feedback_for_asha(
    ashaId: str = Query(..., min_length=1),
    since: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Mobile-facing tail of alerts owned by ``ashaId``.

    The mobile client polls this every minute when online to learn whether
    its previously-synced HIGH/CRITICAL visits have been acknowledged,
    dispatched, or resolved by the ANM. Returns only metadata the worker
    needs to surface in her inbox; never returns raw transcript.
    """
    since_dt: Optional[datetime] = None
    if since:
        try:
            since_dt = datetime.fromisoformat(since.replace("Z", "+00:00"))
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="invalid since") from exc
    rows = _query_alerts(
        db,
        asha_id=ashaId,
        since=since_dt,
        limit=limit,
        order="recent",
    )
    return {
        "ashaId": ashaId,
        "count": len(rows),
        "items": [
            {
                "alertId": r.id,
                "visitId": r.visit_id,
                "patientId": r.patient_id,
                "patientName": r.patient_name,
                "riskLevel": r.risk_level,
                "status": r.status,
                "anmId": r.anm_id,
                "acknowledgedAt": r.acknowledged_at.isoformat() if r.acknowledged_at else None,
                "dispatchedAt": r.dispatched_at.isoformat() if r.dispatched_at else None,
                "dispatchEtaMinutes": r.dispatch_eta_minutes,
                "dispatchNotes": r.dispatch_notes,
                "resolvedAt": r.resolved_at.isoformat() if r.resolved_at else None,
                "resolutionNotes": r.resolution_notes,
                "updatedAt": r.updated_at.isoformat() if r.updated_at else None,
            }
            for r in rows
        ],
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/{alert_id}", response_model=AlertResponse)
def get_alert(alert_id: str, db: Session = Depends(get_db)) -> AlertResponse:
    alert = db.get(SevereCaseAlertORM, alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail="alert not found")
    return AlertResponse(alert=serialize_alert(alert))


@router.post("/{alert_id}/ack", response_model=AlertResponse)
def post_acknowledge(
    alert_id: str,
    db: Session = Depends(get_db),
    actor: Dict[str, Any] = Depends(get_anm_actor),
) -> AlertResponse:
    updated = acknowledge_alert(db, alert_id, actor_id=actor["id"])
    if updated is None:
        raise HTTPException(status_code=404, detail="alert not found")
    return AlertResponse(alert=serialize_alert(updated))


@router.post("/{alert_id}/dispatch", response_model=AlertResponse)
def post_dispatch(
    alert_id: str,
    body: DispatchRequest,
    db: Session = Depends(get_db),
    actor: Dict[str, Any] = Depends(get_anm_actor),
) -> AlertResponse:
    updated = dispatch_alert(
        db,
        alert_id,
        actor_id=actor["id"],
        eta_minutes=body.etaMinutes,
        notes=body.notes,
    )
    if updated is None:
        raise HTTPException(status_code=404, detail="alert not found")
    return AlertResponse(alert=serialize_alert(updated))


@router.post("/{alert_id}/resolve", response_model=AlertResponse)
def post_resolve(
    alert_id: str,
    body: ResolveRequest,
    db: Session = Depends(get_db),
    actor: Dict[str, Any] = Depends(get_anm_actor),
) -> AlertResponse:
    updated = resolve_alert(db, alert_id, actor_id=actor["id"], notes=body.notes)
    if updated is None:
        raise HTTPException(status_code=404, detail="alert not found")
    return AlertResponse(alert=serialize_alert(updated))


# ─── SSE stream ─────────────────────────────────────────────────────────────


@router.get("/stream")
async def alerts_stream(
    anmId: Optional[str] = Query(None),
    token: Optional[str] = Query(None, description="JWT (alternative to Authorization header)"),
    authorization: Optional[str] = Header(None),
) -> StreamingResponse:
    """Server-Sent Events feed of alert created/updated events.

    EventSource cannot send custom headers in browsers, so we accept either
    an ``Authorization: Bearer`` header or a ``token=`` query param. When
    both are absent, the stream is anonymous (used for the demo).
    """
    actor: Optional[Dict[str, Any]] = None
    if token:
        try:
            payload = _decode_token(token)
            actor = {
                "id": payload.get("sub"),
                "district": payload.get("district"),
                "role": payload.get("role", "ANM"),
            }
        except HTTPException:
            actor = None
    elif authorization:
        try:
            actor = get_anm_actor(authorization)
        except HTTPException:
            actor = None
    effective_anm = anmId or (actor.get("id") if actor else None)

    async def event_source() -> AsyncIterator[bytes]:
        queue = await alert_bus.subscribe()
        # First message: client knows we're connected.
        yield _sse_format("hello", {"ts": datetime.now(timezone.utc).isoformat(), "anmId": effective_anm})
        try:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=15.0)
                except asyncio.TimeoutError:
                    # Heartbeat keeps proxies / reverse-proxies from closing
                    # the connection on idle. Comment-style SSE pings.
                    yield b": ping\n\n"
                    continue
                data = event.get("data") or {}
                if effective_anm and data.get("anmId") and data["anmId"] != effective_anm:
                    continue
                yield _sse_format(event.get("type", "message"), event)
        except asyncio.CancelledError:
            pass
        finally:
            await alert_bus.unsubscribe(queue)

    return StreamingResponse(
        event_source(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


def _sse_format(event_type: str, payload: Dict[str, Any]) -> bytes:
    lines = [f"event: {event_type}", f"data: {json.dumps(payload, default=str)}", "", ""]
    return "\n".join(lines).encode("utf-8")
