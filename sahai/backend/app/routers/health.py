"""Health-check routes for service monitoring."""

from __future__ import annotations

from typing import Dict, Optional

from fastapi import APIRouter

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/")
def read_health() -> Dict[str, str]:
    """Return the current API health status."""
    return {
        "service": "sahai-api",
        "status": "ok",
        "version": "0.1.0",
    }

