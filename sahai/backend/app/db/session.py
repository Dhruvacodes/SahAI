"""SQLAlchemy engine and session management for the Sahai backend."""

import os
from collections.abc import Generator

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://sahai:sahai@localhost:5432/sahai")

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

