"""ANC danger-sign positive + negative fixtures."""

from .conftest import (
    assert_fires,
    assert_level_at_least,
    assert_not_fires,
    evaluate,
)


def test_severe_pre_eclampsia_fires_critical():
    result = evaluate(
        vitals={"systolicBP": 168, "diastolicBP": 112},
        symptoms=["headache"],
        patient={"isPregnant": True, "gestationalWeekIfPregnant": 32},
        visit_type="ANC",
    )
    assert_fires(result, "ANC.PE.SEVERE")
    assert_level_at_least(result, "CRITICAL")


def test_suspected_pre_eclampsia_fires_high():
    result = evaluate(
        vitals={"systolicBP": 142, "diastolicBP": 92},
        symptoms=["blurred vision", "edema"],
        patient={"isPregnant": True, "gestationalWeekIfPregnant": 30},
        visit_type="ANC",
    )
    assert_fires(result, "ANC.PE.SUSPECTED")
    assert_level_at_least(result, "HIGH")


def test_high_bp_alone_does_not_fire_suspected_pe():
    """Suspected PE requires BP >= 140/90 *plus* a prodromal symptom."""
    result = evaluate(
        vitals={"systolicBP": 142, "diastolicBP": 92},
        symptoms=["routine check"],
        patient={"isPregnant": True, "gestationalWeekIfPregnant": 30},
        visit_type="ANC",
    )
    assert_not_fires(result, "ANC.PE.SUSPECTED")
    # ANC.PE.SEVERE also requires >=160/110; should not fire either.
    assert_not_fires(result, "ANC.PE.SEVERE")


def test_apb_after_20_weeks_fires_critical():
    result = evaluate(
        symptoms=["vaginal bleeding"],
        patient={"isPregnant": True, "gestationalWeekIfPregnant": 30},
        visit_type="ANC",
    )
    assert_fires(result, "ANC.HEMORRHAGE.ANTEPARTUM")
    assert_level_at_least(result, "CRITICAL")


def test_apb_before_20_weeks_does_not_fire():
    """The rule is scoped to gestationalWeeksMin >= 20."""
    result = evaluate(
        symptoms=["vaginal bleeding"],
        patient={"isPregnant": True, "gestationalWeekIfPregnant": 12},
        visit_type="ANC",
    )
    assert_not_fires(result, "ANC.HEMORRHAGE.ANTEPARTUM")


def test_non_pregnant_patient_does_not_match_anc_rules():
    result = evaluate(
        vitals={"systolicBP": 168, "diastolicBP": 112},
        symptoms=["severe headache"],
        patient={"isPregnant": False},
        visit_type="OTHER",
    )
    assert_not_fires(result, "ANC.PE.SEVERE")
    assert_not_fires(result, "ANC.PE.SUSPECTED")
