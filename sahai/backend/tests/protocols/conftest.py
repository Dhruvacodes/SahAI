"""Shared helpers for protocol-rule fixture tests."""

from __future__ import annotations

from typing import Any, Dict, Iterable, List, Optional

import pytest

from app.services import protocol_engine


@pytest.fixture(autouse=True)
def reload_catalog():
    """Ensure each test sees the on-disk catalog (no stale lru_cache)."""
    protocol_engine.reload_catalog()
    yield
    protocol_engine.reload_catalog()


def evaluate(
    *,
    vitals: Optional[Dict[str, Any]] = None,
    symptoms: Optional[List[str]] = None,
    patient: Optional[Dict[str, Any]] = None,
    visit_type: Optional[str] = None,
    mechanisms: Optional[List[str]] = None,
    velocity_warnings: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Evaluate the engine and return the legacy {level, score, flags, fired_rules} dict."""
    return protocol_engine.score_risk_via_protocol(
        vitals=vitals or {},
        symptoms=symptoms or [],
        patient_profile=patient or {},
        velocity_warnings=velocity_warnings or [],
        visit_type=visit_type,
        mechanisms=mechanisms,
    )


def fired_ids(result: Dict[str, Any]) -> List[str]:
    return [r["id"] for r in result.get("fired_rules", [])]


def assert_fires(result: Dict[str, Any], rule_id: str) -> None:
    ids = fired_ids(result)
    assert rule_id in ids, f"Expected rule {rule_id} to fire; fired: {ids}"


def assert_not_fires(result: Dict[str, Any], rule_id: str) -> None:
    ids = fired_ids(result)
    assert rule_id not in ids, f"Did not expect {rule_id} to fire; fired: {ids}"


def assert_level_at_least(result: Dict[str, Any], expected: str) -> None:
    order = ("LOW", "MODERATE", "HIGH", "CRITICAL")
    assert order.index(result["level"]) >= order.index(expected), (
        f"Expected level >= {expected}, got {result['level']}"
    )


def all_rule_ids() -> Iterable[str]:
    """Yield every rule id present in the catalog (used by signoff tests)."""
    for rule in protocol_engine._load_rules():  # noqa: SLF001 — internal but stable
        yield rule.get("id", "")
