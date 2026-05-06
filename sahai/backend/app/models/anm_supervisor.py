"""ORM model for ANM supervisors — dashboard login and authorization."""

import uuid

from sqlalchemy import Column, DateTime, String, func

from app.db.session import Base


class ANMSupervisorORM(Base):
    """ANM supervisor who can log in to the dashboard."""

    __tablename__ = "anm_supervisors"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    district = Column(String, index=True, nullable=False)
    phone = Column(String)
    email = Column(String, unique=True)
    password_hash = Column(String, nullable=False)  # bcrypt
    role = Column(String, default="ANM")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
