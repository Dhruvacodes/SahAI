"""IMNCI sick-child fixture tests."""

from .conftest import (
    assert_fires,
    assert_level_at_least,
    assert_not_fires,
    evaluate,
)


def test_general_danger_sign_fires_critical():
    result = evaluate(
        symptoms=["unable to drink", "lethargic"],
        patient={"ageMonths": 18},
        visit_type="SICK_CHILD",
    )
    assert_fires(result, "IMNCI.GENERAL.DANGER_SIGN")
    assert_level_at_least(result, "CRITICAL")


def test_severe_pneumonia_fires_critical():
    result = evaluate(
        symptoms=["cough", "chest indrawing"],
        vitals={"respiratoryRate": 55},
        patient={"ageMonths": 12},
        visit_type="SICK_CHILD",
    )
    assert_fires(result, "IMNCI.PNEUMONIA.SEVERE")
    assert_level_at_least(result, "CRITICAL")


def test_nonsevere_pneumonia_fires_high():
    result = evaluate(
        symptoms=["cough"],
        vitals={"respiratoryRate": 45},
        patient={"ageMonths": 24},
        visit_type="SICK_CHILD",
    )
    assert_fires(result, "IMNCI.PNEUMONIA.NONSEVERE")
    assert_level_at_least(result, "HIGH")


def test_imnci_rules_only_apply_to_under_5():
    """A 6-year-old with the same symptoms should not fire under-5 rules."""
    result = evaluate(
        symptoms=["unable to drink"],
        patient={"ageMonths": 72},
        visit_type="SICK_CHILD",
    )
    assert_not_fires(result, "IMNCI.GENERAL.DANGER_SIGN")


def test_severe_dehydration_fires_critical():
    result = evaluate(
        symptoms=["sunken eyes", "skin pinch goes back very slowly"],
        patient={"ageMonths": 30},
        visit_type="SICK_CHILD",
    )
    assert_fires(result, "IMNCI.DIARRHOEA.SEVERE_DEHYDRATION")
    assert_level_at_least(result, "CRITICAL")


def test_routine_under_5_visit_stays_low():
    result = evaluate(
        symptoms=["mild runny nose"],
        vitals={"respiratoryRate": 30},
        patient={"ageMonths": 24},
        visit_type="SICK_CHILD",
    )
    assert result["level"] == "LOW"
