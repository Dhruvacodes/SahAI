"""Health-check routes for service monitoring."""

from fastapi import APIRouter

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/")
def read_health() -> dict[str, str]:
    """Return the current API health status."""
    return {
        "service": "sahai-api",
        "status": "ok",
        "version": "0.1.0",
    }

