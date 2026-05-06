# backend/app/services/risk_engine.py

from __future__ import annotations
"""Deterministic, multi-factor risk engine.

Historically this module held all the inline thresholds. As of v3 the
authoritative rules live in the JSON catalog under ``sahai/protocols/v1/`` and
are evaluated by ``protocol_engine.evaluate``. This file now:

  1. Delegates to the protocol engine and surfaces its fired-rule output.
  2. Keeps the legacy inline rules as a *defence-in-depth* fallback so that if
     the catalog is missing or incomplete during transition, we still escalate
     for hypertension, hypoxia, fever and a small set of IMCI keywords.

Once every legacy rule has been migrated to a JSON file, the inline block can
be removed.
"""
from typing import Optional, List, Dict

from app.services import protocol_engine

LEVEL_ORDER = ["LOW", "MODERATE", "HIGH", "CRITICAL"]
LEVEL_SCORE = {"LOW": 0.10, "MODERATE": 0.40, "HIGH": 0.70, "CRITICAL": 0.92}


def _has_symptom(symptoms: List[str], needles: List[str]) -> bool:
    text = " ".join(symptoms).lower()
    return any(n.lower() in text for n in needles)


def score_risk(
    vitals: Dict,
    symptoms: List[str],
    patient_profile: Dict,
    velocity_warnings: Optional[List[str]] = None,
) -> Dict:
    """
    Returns: {"level": str, "score": float, "flags": List[str]}
    """
    if velocity_warnings is None:
        velocity_warnings = []
    flags: List[str] = []
    max_level = "LOW"
    
    def escalate(to: str, reason: str):
        nonlocal max_level
        flags.append(reason)
        if LEVEL_ORDER.index(to) > LEVEL_ORDER.index(max_level):
            max_level = to
    
    sbp = vitals.get("systolicBP")
    dbp = vitals.get("diastolicBP")
    is_pregnant = patient_profile.get("isPregnant", False)
    
    # === Hypertension thresholds ===
    if sbp is not None or dbp is not None:
        s = sbp or 0
        d = dbp or 0
        if s >= 160 or d >= 110:
            escalate("CRITICAL", "Severe hypertension (Stage 2)")
        elif s >= 140 or d >= 90:
            escalate("HIGH", "Hypertension (Stage 1)")
        elif s >= 130 or d >= 85:
            escalate("MODERATE", "Elevated BP (pre-hypertension)")
    
    # === Pre-eclampsia constellation ===
    if is_pregnant and sbp and sbp >= 140:
        if _has_symptom(symptoms, ["headache", "edema", "swelling", "visual", "blurred"]):
            escalate("CRITICAL", "Suspected pre-eclampsia (BP + symptom cluster)")
    
    # === SpO2 ===
    spo2 = vitals.get("spO2")
    if spo2 is not None:
        if spo2 < 90:
            escalate("CRITICAL", "Severe hypoxia (SpO2 < 90%)")
        elif spo2 < 94:
            escalate("HIGH", "Low SpO2 (< 94%)")
    
    # === Heart rate ===
    hr = vitals.get("heartRate")
    if hr is not None:
        if hr >= 130 or hr < 50:
            escalate("HIGH", "Abnormal heart rate")
    
    # === Temperature / fever ===
    temp = vitals.get("temperature")
    if temp is not None:
        if temp >= 39.0:
            escalate("HIGH", f"High fever ({temp}°C)")
        elif temp >= 38.0:
            escalate("MODERATE", f"Fever ({temp}°C)")
    
    # === IMCI danger signs (sick child) ===
    imci_red_flags = ["unable to drink", "convulsion", "lethargic", "stridor", "chest indrawing"]
    if _has_symptom(symptoms, imci_red_flags):
        escalate("CRITICAL", "IMCI danger sign present")
    
    # === MUAC (acute malnutrition) ===
    muac = vitals.get("muacMm")
    if muac is not None:
        if muac < 115:
            escalate("CRITICAL", "Severe acute malnutrition (MUAC < 115mm)")
        elif muac < 125:
            escalate("HIGH", "Moderate acute malnutrition (MUAC < 125mm)")
        elif muac < 135:
            escalate("MODERATE", "At-risk MUAC (< 135mm)")
    
    # === Postpartum sepsis ===
    if patient_profile.get("isPostpartum", False):
        if (temp is not None and temp >= 38.5) or _has_symptom(symptoms, ["foul discharge", "heavy bleeding"]):
            escalate("CRITICAL", "Suspected postpartum sepsis")
    
    # === Velocity-based escalation ===
    for w in velocity_warnings:
        if "RAPID_BP_RISE" in w:
            idx = LEVEL_ORDER.index(max_level)
            if idx < len(LEVEL_ORDER) - 1:
                max_level = LEVEL_ORDER[idx + 1]
                flags.append(f"Trend escalation: {w}")
    
    # === Hemorrhage flags ===
    if _has_symptom(symptoms, ["heavy bleeding", "haemorrhage"]):
        escalate("CRITICAL", "Heavy bleeding reported")

    # === Protocol-engine overlay (v3+) ============================================
    # Run the JSON-driven rule pack and merge its output. The strongest band
    # across legacy rules and protocol rules wins; fired rules and first-
    # response actions from the catalog are surfaced verbatim so downstream
    # consumers (dashboard, referral renderer) can cite them.
    try:
        protocol_out = protocol_engine.score_risk_via_protocol(
            vitals=vitals,
            symptoms=symptoms,
            patient_profile=patient_profile,
            velocity_warnings=velocity_warnings,
        )
    except Exception:  # pragma: no cover — never let the catalog crash a visit
        protocol_out = None

    if protocol_out is not None:
        protocol_level = protocol_out.get("level", "LOW")
        if LEVEL_ORDER.index(protocol_level) > LEVEL_ORDER.index(max_level):
            max_level = protocol_level
        # Merge new flags (de-duplicated) so the dashboard sees rule ids.
        for f in protocol_out.get("flags", []) or []:
            if f not in flags:
                flags.append(f)
    else:
        protocol_out = {}

    return {
        "level": max_level,
        "score": LEVEL_SCORE[max_level],
        "flags": flags,
        "firedRules": protocol_out.get("fired_rules", []) if protocol_out else [],
        "firstResponseActions": protocol_out.get("first_response_actions", []) if protocol_out else [],
        "ttt_minutes": protocol_out.get("ttt_minutes") if protocol_out else None,
        "catalogVersion": protocol_out.get("catalog_version") if protocol_out else None,
    }


# === Legacy compatibility alias ===
def calculate_risk_score(vitals: dict, patient: dict) -> dict:
    """Legacy wrapper for the old risk scoring API used by /api/risk/score."""
    # Map old vitals format to new
    new_vitals = {
        "systolicBP": vitals.get("bloodPressureSystolic"),
        "diastolicBP": vitals.get("bloodPressureDiastolic"),
        "haemoglobin": vitals.get("hemoglobinLevel"),
        "temperature": vitals.get("temperature"),
        "spO2": vitals.get("spO2"),
        "heartRate": vitals.get("heartRate"),
        "muacMm": vitals.get("muacMm"),
    }
    profile = {
        "isPregnant": patient.get("isPregnant", False),
        "isPostpartum": patient.get("isPostpartum", False),
    }
    symptoms = []
    if vitals.get("oedema"):
        symptoms.append("edema")
    if vitals.get("fetalMovements") is False:
        symptoms.append("reduced fetal movement")
    
    result = score_risk(new_vitals, symptoms, profile)
    # Return in old format
    return {
        "score": int(result["score"] * 100),
        "level": result["level"],
        "flags": result["flags"],
    }
