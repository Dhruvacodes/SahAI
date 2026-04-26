"""Deterministic clinical risk scoring for extracted ASHA visit data."""

from typing import Any


def calculate_risk_score(vitals: dict, patient: dict) -> dict:
    """Calculate a rule-based maternal and community health risk score.

    The engine uses explicit clinical rules for hypertension, oedema, anaemia,
    fetal movement, and pregnancy age risk. These rules are intended for triage
    support and should be reviewed by clinical stakeholders before production use.

    Clinical basis for implemented rules:
    - Severe hypertension can indicate hypertensive crisis or severe pre-eclampsia.
    - Hypertension is a major cardiovascular and pregnancy risk marker.
    - Raised systolic pressure in pregnancy can signal gestational hypertension.
    - Oedema during pregnancy can accompany pre-eclampsia and needs escalation.
    - Oedema outside pregnancy can still indicate systemic fluid retention.
    - Severe anaemia substantially increases maternal and general health risk.
    - Moderate anaemia can worsen fatigue, pregnancy outcomes, and recovery.
    - Absent fetal movements after 28 weeks can indicate fetal distress.
    - Pregnancy before adulthood is associated with higher maternal and neonatal risk.
    - Pregnancy after age 35 has higher rates of obstetric complications.

    Args:
        vitals: Extracted vital signs using the ExtractedVitals key names.
        patient: Patient context containing pregnancy status, gestational week, and age.

    Returns:
        A dictionary containing a capped score, risk level, and triggered flags.
    """
    score = 0
    flags: list[str] = []

    systolic = _optional_float(vitals.get("bloodPressureSystolic"))
    diastolic = _optional_float(vitals.get("bloodPressureDiastolic"))
    hemoglobin = _optional_float(vitals.get("hemoglobinLevel"))
    fetal_movements = vitals.get("fetalMovements")
    oedema = vitals.get("oedema")

    is_pregnant = bool(patient.get("isPregnant"))
    gestational_week = _optional_int(patient.get("gestationalWeek"))
    age_years = _optional_int(patient.get("ageYears"))

    if _at_least(systolic, 160) or _at_least(diastolic, 110):
        score += 40
        flags.append("Severe hypertension - IMMEDIATE referral")

    if _at_least(systolic, 140) or _at_least(diastolic, 90):
        score += 25
        flags.append("Hypertension detected")

    if _at_least(systolic, 130) and is_pregnant:
        score += 15
        flags.append("Gestational hypertension risk")

    if oedema is True and is_pregnant:
        score += 20
        flags.append("Oedema in pregnancy - pre-eclampsia risk")

    if oedema is True and not is_pregnant:
        score += 10
        flags.append("Oedema detected")

    if hemoglobin is not None and hemoglobin < 7.0:
        score += 25
        flags.append("Severe anaemia")

    if hemoglobin is not None and hemoglobin < 10.0:
        score += 15
        flags.append("Moderate anaemia")

    if fetal_movements is False and gestational_week is not None and gestational_week >= 28:
        score += 30
        flags.append("Absent fetal movements - EMERGENCY")

    if is_pregnant and age_years is not None and age_years < 18:
        score += 10
        flags.append("Adolescent pregnancy - high risk")

    if is_pregnant and age_years is not None and age_years > 35:
        score += 5
        flags.append("Advanced maternal age")

    score = min(score, 100)
    return {
        "score": score,
        "level": _risk_level(score),
        "flags": flags,
    }


def _risk_level(score: int) -> str:
    """Map a numeric risk score to the product risk level labels."""
    if score <= 25:
        return "LOW"

    if score <= 50:
        return "MEDIUM"

    if score <= 75:
        return "HIGH"

    return "CRITICAL"


def _at_least(value: float | None, threshold: float) -> bool:
    """Check an optional numeric value against a threshold."""
    return value is not None and value >= threshold


def _optional_float(value: Any) -> float | None:
    """Convert a value to float when present and numeric."""
    if value is None:
        return None

    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _optional_int(value: Any) -> int | None:
    """Convert a value to int when present and numeric."""
    if value is None:
        return None

    try:
        return int(value)
    except (TypeError, ValueError):
        return None
