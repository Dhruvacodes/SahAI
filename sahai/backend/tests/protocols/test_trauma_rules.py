"""Trauma red-flag positive + negative fixtures."""

from __future__ import annotations

from .conftest import (
    assert_fires,
    assert_level_at_least,
    assert_not_fires,
    evaluate,
)


def test_gunshot_wound_fires_critical():
    result = evaluate(
        vitals={"systolicBP": 80, "heartRate": 130},
        symptoms=["gunshot wound to abdomen", "heavy bleeding"],
        mechanisms=["firearm"],
        visit_type="TRAUMA",
    )
    assert_fires(result, "TRAUMA.PENETRATING.GUNSHOT")
    assert_level_at_least(result, "CRITICAL")


def test_low_gcs_head_injury_fires_high():
    result = evaluate(
        vitals={"gcs": 7},
        symptoms=["head injury"],
        visit_type="TRAUMA",
    )
    assert_fires(result, "TRAUMA.HEAD.GCS_LOW")
    assert_level_at_least(result, "HIGH")


def test_normal_visit_does_not_fire_trauma_rules():
    result = evaluate(
        vitals={"systolicBP": 118, "diastolicBP": 76, "heartRate": 78},
        symptoms=["routine ANC visit"],
        patient={"isPregnant": True, "gestationalWeekIfPregnant": 24},
        visit_type="ANC",
    )
    for rule_id in (
        "TRAUMA.PENETRATING.GUNSHOT",
        "TRAUMA.MAJOR.BLEEDING",
        "TRAUMA.HEAD.GCS_LOW",
        "TRAUMA.AIRWAY.COMPROMISE",
    ):
        assert_not_fires(result, rule_id)


def test_minor_pain_does_not_escalate():
    result = evaluate(
        vitals={"painScore": 4},
        symptoms=["mild ankle sprain"],
        visit_type="OTHER",
    )
    assert result["level"] == "LOW"
