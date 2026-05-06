"""Smoke fixtures across the remaining verticals.

Each test exercises one positive and (where applicable) one negative case.
The goal is not exhaustive coverage — that lives in the per-vertical
fixture files — but to ensure no rule pack regresses to silently dropping
its triggers when the catalog is updated.
"""

from .conftest import (
    assert_fires,
    assert_level_at_least,
    assert_not_fires,
    evaluate,
)


def test_pph_primary_fires_critical():
    result = evaluate(
        symptoms=["heavy bleeding"],
        patient={"isPostpartum": True, "daysPostpartum": 0},
        visit_type="PNC",
    )
    assert_fires(result, "PPH.PRIMARY")
    assert_level_at_least(result, "CRITICAL")


def test_pph_primary_fires_on_blood_loss_threshold():
    result = evaluate(
        vitals={"bloodLossMl": 600},
        patient={"isPostpartum": True, "daysPostpartum": 0},
        visit_type="PNC",
    )
    assert_fires(result, "PPH.PRIMARY")
    assert_level_at_least(result, "CRITICAL")


def test_neonatal_danger_sign_fires_critical():
    result = evaluate(
        symptoms=["not feeding", "convulsions"],
        patient={"ageMonths": 0},
        visit_type="NEONATAL",
    )
    assert_fires(result, "HBNC.NEONATE.DANGER_SIGN")
    assert_level_at_least(result, "CRITICAL")


def test_severe_hypertension_ncd_fires_critical():
    result = evaluate(
        vitals={"systolicBP": 185, "diastolicBP": 115},
        patient={"ageYears": 55, "isPregnant": False},
        visit_type="NCD_SCREEN",
    )
    assert_fires(result, "NCD.HTN.SEVERE")
    assert_level_at_least(result, "CRITICAL")


def test_suicidal_ideation_fires_critical():
    result = evaluate(
        symptoms=["thoughts of self harm", "wants to die"],
        patient={"ageYears": 22},
        visit_type="MENTAL_HEALTH",
    )
    assert_fires(result, "MENTAL.SUICIDAL.IDEATION")
    assert_level_at_least(result, "CRITICAL")


def test_snake_bite_fires_critical():
    result = evaluate(
        symptoms=["snake bite to leg", "bleeding"],
        patient={"ageYears": 30},
        visit_type="EMERGENCY",
    )
    assert_fires(result, "BITE.SNAKE")
    assert_level_at_least(result, "CRITICAL")


def test_routine_anc_does_not_fire_unrelated_rules():
    """Healthy ANC visit should not trigger PPH, IMNCI, NCD, or trauma rules."""
    result = evaluate(
        vitals={
            "systolicBP": 116,
            "diastolicBP": 74,
            "heartRate": 80,
            "haemoglobin": 11.2,
        },
        symptoms=["mild morning sickness"],
        patient={"isPregnant": True, "gestationalWeekIfPregnant": 16, "ageYears": 28},
        visit_type="ANC",
    )
    for rule_id in (
        "PPH.PRIMARY",
        "PPH.SECONDARY",
        "IMNCI.GENERAL.DANGER_SIGN",
        "NCD.HTN.SEVERE",
        "TRAUMA.PENETRATING.GUNSHOT",
        "MENTAL.SUICIDAL.IDEATION",
    ):
        assert_not_fires(result, rule_id)
    assert result["level"] == "LOW"
