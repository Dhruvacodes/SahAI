"""Application entrypoint for the Sahai FastAPI backend."""

import asyncio

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from app.db.session import Base, engine
from app.db.auto_migrate import run_auto_migrations
import app.models  # noqa: F401 — registers all ORM models with Base before create_all
from app.routers.alerts import router as alerts_router
from app.routers.asha_override import router as asha_override_router
from app.routers.asr import router as asr_router
from app.routers.auth import router as auth_router
from app.routers.consent import router as consent_router
from app.routers.dashboard import router as dashboard_router
from app.routers.extraction import router as extraction_router
from app.routers.health import router as health_router
from app.routers.patient import router as patient_router
from app.routers.protocols import router as protocols_router
from app.routers.referral import router as referral_router
from app.routers.risk import router as risk_router
from app.routers.sync import router as sync_router
from app.routers.system import router as system_router
from app.services import alert_bus

# Create any missing tables on startup (idempotent; safe for SQLite dev and
# Postgres dev. For production schema changes use Alembic migrations instead).
Base.metadata.create_all(bind=engine)
# Then ALTER TABLE ADD COLUMN for any new (nullable) columns that were added to
# the ORM models since the dev DB was last created. Dev-only safety net.
run_auto_migrations(engine, Base)


def create_app() -> FastAPI:
    """Create and configure the Sahai FastAPI application."""
    app = FastAPI(
        title="Sahai API",
        description="Backend services for Sahai mobile and dashboard clients.",
        version="0.2.0",
    )

    # CORS — allow mobile and dashboard origins
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # tighten in production
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth_router)
    app.include_router(alerts_router, prefix="/api")
    app.include_router(asha_override_router, prefix="/api")
    app.include_router(asr_router, prefix="/api/asr")
    app.include_router(consent_router, prefix="/api")
    app.include_router(dashboard_router, prefix="/api")
    app.include_router(extraction_router, prefix="/api")
    app.include_router(patient_router, prefix="/api")
    app.include_router(protocols_router, prefix="/api")
    app.include_router(referral_router, prefix="/api")
    app.include_router(risk_router, prefix="/api")
    app.include_router(sync_router, prefix="/api")
    app.include_router(system_router, prefix="/api")
    app.include_router(health_router)

    @app.on_event("startup")
    async def _attach_alert_bus_loop() -> None:
        # Capture the running asyncio loop so sync code paths (e.g. the
        # ``/sync/visit`` route handler) can dispatch events onto the SSE
        # bus from any thread via ``alert_bus.publish_alert``.
        alert_bus.attach_loop(asyncio.get_running_loop())

    @app.get("/", include_in_schema=False)
    def root() -> RedirectResponse:
        return RedirectResponse(url="/docs")

    return app


app = create_app()
