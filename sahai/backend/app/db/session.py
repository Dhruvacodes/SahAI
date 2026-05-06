"""SQLAlchemy engine and session management for the Sahai backend."""

import os
import logging
from collections.abc import Generator

from dotenv import load_dotenv
from sqlalchemy import create_engine, JSON
from sqlalchemy.orm import Session, declarative_base, sessionmaker

load_dotenv()

log = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./sahai_dev.db")

# SQLite needs special handling — no pool_pre_ping and check_same_thread
if DATABASE_URL.startswith("sqlite"):
    log.info("Using SQLite database at %s", DATABASE_URL)
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
    )
else:
    log.info("Using PostgreSQL database")
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """Yield a SQLAlchemy database session for a FastAPI request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
