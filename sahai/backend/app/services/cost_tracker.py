# backend/app/services/cost_tracker.py

from __future__ import annotations
"""Per-API-call cost tracking. Stores both USD and INR estimates."""
import uuid
from sqlalchemy.orm import Session
from app.models.cost_event import CostEventORM

INR_PER_USD = 83.5

# All prices in USD per unit (per token, per second, etc.)
PRICES_USD = {
    "sarvam:saaras:v3":        {"per_second": 0.000097},   # ₹30/hr
    "sarvam:bulbul:v2":        {"per_char": 0.0000018},     # ₹15/10K chars
    "openai:whisper-1":        {"per_second": 0.0001},      # $0.006/min
    "anthropic:claude-haiku-4-5-20251001": {"input_per_token": 0.000001, "output_per_token": 0.000005, "cached_input_per_token": 0.0000001},
    "anthropic:claude-sonnet-4-6":         {"input_per_token": 0.000003, "output_per_token": 0.000015, "cached_input_per_token": 0.0000003},
    "anthropic:claude-opus-4-7":           {"input_per_token": 0.000005, "output_per_token": 0.000025, "cached_input_per_token": 0.0000005},
}


def estimate_cost_usd(provider_model: str, *,
                       input_tokens: int = 0,
                       output_tokens: int = 0,
                       cached_input_tokens: int = 0,
                       audio_seconds: float = 0,
                       chars: int = 0) -> float:
    p = PRICES_USD.get(provider_model, {})
    cost = 0.0
    if "per_second" in p:
        cost += p["per_second"] * audio_seconds
    if "per_char" in p:
        cost += p["per_char"] * chars
    if "input_per_token" in p:
        # Cached vs fresh input split
        fresh = max(input_tokens - cached_input_tokens, 0)
        cost += p["input_per_token"] * fresh + p.get("cached_input_per_token", p["input_per_token"]) * cached_input_tokens
    if "output_per_token" in p:
        cost += p["output_per_token"] * output_tokens
    return round(cost, 6)


def log_cost(db: Session, *, endpoint: str, provider: str, model: str,
             input_tokens: int = 0, output_tokens: int = 0,
             cached_input_tokens: int = 0, audio_seconds: float = 0,
             chars: int = 0, visit_id: str = None) -> float:
    pm = f"{provider}:{model}"
    usd = estimate_cost_usd(pm,
        input_tokens=input_tokens, output_tokens=output_tokens,
        cached_input_tokens=cached_input_tokens,
        audio_seconds=audio_seconds, chars=chars)
    inr = round(usd * INR_PER_USD, 4)
    event = CostEventORM(
        id=str(uuid.uuid4()),
        endpoint=endpoint, provider=provider, model=model,
        input_tokens=input_tokens, output_tokens=output_tokens,
        cached_input_tokens=cached_input_tokens,
        audio_seconds=audio_seconds,
        estimated_cost_usd=usd, estimated_cost_inr=inr,
        visit_id=visit_id,
    )
    db.add(event)
    db.commit()
    return usd
