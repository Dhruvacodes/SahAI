"""AI model selection and inference-cost helpers."""

from __future__ import annotations

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
    "claude-sonnet-4-6": ClaudeModelPolicy(
        model_id="claude-sonnet-4-6",
        label="Claude Sonnet 4.6",
        input_usd_per_mtok=3.0,
        output_usd_per_mtok=15.0,
        rationale=(
            "Default for clinical extraction and referral drafting because it balances "
            "multilingual quality, JSON reliability, reasoning, speed, and cost."
        ),
    ),
    "claude-haiku-4-5-20251001": ClaudeModelPolicy(
        model_id="claude-haiku-4-5-20251001",
        label="Claude Haiku 4.5",
        input_usd_per_mtok=1.0,
        output_usd_per_mtok=5.0,
        rationale=(
            "Lower-cost option for non-critical readback or draft-only workflows after "
            "clinical validation accepts the quality tradeoff."
        ),
    ),
}

DEFAULT_CLAUDE_MODEL = "claude-sonnet-4-6"


def selected_claude_model() -> ClaudeModelPolicy:
    """Return the configured Claude model policy."""
    configured_model = os.getenv("ANTHROPIC_MODEL", DEFAULT_CLAUDE_MODEL).strip()
    return CLAUDE_MODELS.get(configured_model, CLAUDE_MODELS[DEFAULT_CLAUDE_MODEL])


def estimate_claude_cost_usd(
    input_tokens: int,
    output_tokens: int,
    model_id: str | None = None,
) -> float:
    """Estimate token cost in USD for one Claude inference."""
    model = CLAUDE_MODELS.get(model_id or "", selected_claude_model())
    input_cost = (max(input_tokens, 0) / 1_000_000) * model.input_usd_per_mtok
    output_cost = (max(output_tokens, 0) / 1_000_000) * model.output_usd_per_mtok
    return round(input_cost + output_cost, 6)
