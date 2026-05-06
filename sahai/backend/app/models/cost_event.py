"""ORM model for per-API-call cost tracking in USD and INR."""

import uuid

from sqlalchemy import Column, DateTime, Float, Integer, String, func

from app.db.session import Base


class CostEventORM(Base):
    """Cost event for tracking API spend per call, per provider."""

    __tablename__ = "cost_events"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    endpoint = Column(String, index=True)
    provider = Column(String, index=True)  # "sarvam" | "openai" | "anthropic"
    model = Column(String, index=True)
    input_tokens = Column(Integer, default=0)
    output_tokens = Column(Integer, default=0)
    cached_input_tokens = Column(Integer, default=0)
    audio_seconds = Column(Float, default=0.0)
    estimated_cost_usd = Column(Float, nullable=False)
    estimated_cost_inr = Column(Float, nullable=False)
    visit_id = Column(String, index=True, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
