"""In-process pub/sub bus for severe-case alert events.

Subscribers register an ``asyncio.Queue`` and receive every event posted
during their lifetime. Producers call :func:`publish_alert` from any thread
or loop; the dispatch is non-blocking — slow subscribers just drop events
rather than back-pressuring the producer.

This is intentionally tiny. In production it should be replaced with
Redis pubsub / NATS / a managed queue so multiple backend workers can
broadcast to the same dashboard. For the demo (single uvicorn process)
this is sufficient.

Event shape::

    {
        "type": "alert.created" | "alert.updated",
        "ts": "2026-05-06T19:00:00+00:00",
        "data": <serialized alert dict from alert_service.serialize_alert>,
    }
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Set

log = logging.getLogger(__name__)


_subscribers: "Set[asyncio.Queue[Dict[str, Any]]]" = set()
_lock = asyncio.Lock()
_loop: Optional[asyncio.AbstractEventLoop] = None


def attach_loop(loop: asyncio.AbstractEventLoop) -> None:
    """Capture the running loop so producers from sync code can dispatch."""
    global _loop
    _loop = loop


async def subscribe() -> "asyncio.Queue[Dict[str, Any]]":
    """Register a new subscriber; returns the queue events will land on."""
    queue: "asyncio.Queue[Dict[str, Any]]" = asyncio.Queue(maxsize=128)
    async with _lock:
        _subscribers.add(queue)
    return queue


async def unsubscribe(queue: "asyncio.Queue[Dict[str, Any]]") -> None:
    async with _lock:
        _subscribers.discard(queue)


def _broadcast(event: Dict[str, Any]) -> None:
    for queue in list(_subscribers):
        try:
            queue.put_nowait(event)
        except asyncio.QueueFull:
            log.warning("alert_bus: subscriber queue full; dropping event")


def publish_alert(kind: str, alert: Dict[str, Any]) -> None:
    """Publish ``alert.<kind>`` (e.g. ``created``, ``updated``) on the bus.

    Safe to call from sync code (e.g. the ``/sync/visit`` route handler):
    if no loop has been attached yet (server still starting) we silently no-op.
    """
    event = {
        "type": f"alert.{kind}",
        "ts": datetime.now(timezone.utc).isoformat(),
        "data": alert,
    }
    if _loop is None:
        return
    if _loop.is_closed():
        return
    try:
        _loop.call_soon_threadsafe(_broadcast, event)
    except RuntimeError:
        log.debug("alert_bus: loop not running; event dropped")
