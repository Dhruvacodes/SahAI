"""AI model selection and inference-cost helpers — V3 aligned."""

from __future__ import annotations

from typing import Optional

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class ClaudeModelPolicy:
    """Pricing and purpose metadata for a Claude model."""

    model_id: str
    label: str
    input_usd_per_mtok: float
    output_usd_per_mtok: float
    rationale: str


CLAUDE_MODELS: dict[str, ClaudeModelPolicy] = {
    "claude-haiku-4-5-20251001": ClaudeModelPolicy(
        model_id="claude-haiku-4-5-20251001",
        label="Claude Haiku 4.5",
        input_usd_per_mtok=1.0,
        output_usd_per_mtok=5.0,
        rationale=(
            "Default for extraction (80%+ of API calls). Fast, cheap, excellent JSON reliability. "
            "With prompt caching, 90% input cost reduction on system prompt hits."
        ),
    ),
    "claude-sonnet-4-6": ClaudeModelPolicy(
        model_id="claude-sonnet-4-6",
        label="Claude Sonnet 4.6",
        input_usd_per_mtok=3.0,
        output_usd_per_mtok=15.0,
        rationale=(
            "Used only for HIGH/CRITICAL referral generation where clinical nuance matters. "
            "~20% of visits need this; rest use free templates."
        ),
    ),
    "claude-opus-4-7": ClaudeModelPolicy(
        model_id="claude-opus-4-7",
        label="Claude Opus 4.7",
        input_usd_per_mtok=5.0,
        output_usd_per_mtok=25.0,
        rationale="Reserved. Not used in default pipeline due to cost.",
    ),
}

DEFAULT_EXTRACTION_MODEL = "claude-haiku-4-5-20251001"
DEFAULT_REFERRAL_MODEL = "claude-sonnet-4-6"


def selected_claude_model(purpose: str = "extraction") -> ClaudeModelPolicy:
    """Return the configured Claude model policy for a given purpose."""
    if purpose == "referral":
        model_id = os.getenv("ANTHROPIC_MODEL_SONNET", DEFAULT_REFERRAL_MODEL).strip()
    else:
        model_id = os.getenv("ANTHROPIC_MODEL_HAIKU", DEFAULT_EXTRACTION_MODEL).strip()
    return CLAUDE_MODELS.get(model_id, CLAUDE_MODELS[DEFAULT_EXTRACTION_MODEL])


def estimate_claude_cost_usd(
    input_tokens: int,
    output_tokens: int,
    model_id: Optional[str] = None,
) -> float:
    """Estimate token cost in USD for one Claude inference."""
    model = CLAUDE_MODELS.get(model_id or "", selected_claude_model())
    input_cost = (max(input_tokens, 0) / 1_000_000) * model.input_usd_per_mtok
    output_cost = (max(output_tokens, 0) / 1_000_000) * model.output_usd_per_mtok
    return round(input_cost + output_cost, 6)
