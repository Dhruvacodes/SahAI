"""Application entrypoint for the Sahai FastAPI backend."""

from fastapi import FastAPI

from app.routers.asr import router as asr_router
from app.routers.dashboard import router as dashboard_router
from app.routers.extraction import router as extraction_router
from app.routers.health import router as health_router
from app.routers.referral import router as referral_router
from app.routers.risk import router as risk_router
from app.routers.sync import router as sync_router


def create_app() -> FastAPI:
    """Create and configure the Sahai FastAPI application."""
    app = FastAPI(
        title="Sahai API",
        description="Backend services for Sahai mobile and dashboard clients.",
        version="0.1.0",
    )
    app.include_router(asr_router, prefix="/api/asr")
    app.include_router(dashboard_router, prefix="/api")
    app.include_router(extraction_router, prefix="/api")
    app.include_router(referral_router, prefix="/api")
    app.include_router(risk_router, prefix="/api")
    app.include_router(sync_router, prefix="/api")
    app.include_router(health_router)
    return app


app = create_app()
