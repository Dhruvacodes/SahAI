# backend/app/services/visit_types.py

from __future__ import annotations
"""NHM visit-type definitions. Each type has its own extraction focus and risk variant."""
from typing import Dict, List, TypedDict


class VisitType(TypedDict):
    code: str
    label: str
    extraction_focus: List[str]
    danger_signs: List[str]
    risk_rules_variant: str
    facility_type: str  # PHC, CHC, DH, IMCI_HOSPITAL, DOTS_CENTER


VISIT_TYPES: Dict[str, VisitType] = {
    "ANC": {
        "code": "ANC",
        "label": "Antenatal care",
        "extraction_focus": [
            "systolicBP", "diastolicBP", "weight", "haemoglobin",
            "fetalMovement", "edema", "gestationalWeek", "fundalHeight",
        ],
        "danger_signs": [
            "BP >= 140/90 with headache or edema (pre-eclampsia)",
            "BP >= 160/110 alone (severe hypertension)",
            "Visual disturbance + high BP",
            "Reduced fetal movement",
            "Vaginal bleeding",
            "Severe anemia (Hb < 7)",
        ],
        "risk_rules_variant": "preeclampsia_constellation",
        "facility_type": "CHC",
    },
    "PNC": {
        "code": "PNC",
        "label": "Postnatal care",
        "extraction_focus": [
            "bleeding", "fever", "breastFeeding", "babyWeight",
            "woundHealing", "lochiaQuality", "babyTemperature",
        ],
        "danger_signs": [
            "Fever > 38.5°C (postpartum sepsis)",
            "Heavy bleeding",
            "Foul-smelling discharge",
            "Severe abdominal pain",
        ],
        "risk_rules_variant": "postpartum_sepsis",
        "facility_type": "CHC",
    },
    "SICK_CHILD": {
        "code": "SICK_CHILD",
        "label": "Sick child (IMCI)",
        "extraction_focus": [
            "muacMm", "feverDurationDays", "diarrheaCount",
            "respiratoryRate", "imciDangerSigns", "ableToDrink",
            "convulsionHistory", "lethargy",
        ],
        "danger_signs": [
            "Unable to drink/breastfeed",
            "Convulsions",
            "Lethargic or unconscious",
            "Stridor at rest",
            "MUAC < 115mm (SAM)",
            "Severe respiratory distress",
        ],
        "risk_rules_variant": "imci_classification",
        "facility_type": "IMCI_HOSPITAL",
    },
    "TB_FOLLOWUP": {
        "code": "TB_FOLLOWUP",
        "label": "TB / DOTS follow-up",
        "extraction_focus": [
            "dosesTaken", "weight", "sputumTestResult",
            "sideEffects", "treatmentDay",
        ],
        "danger_signs": [
            "Treatment interrupted > 2 days",
            "Hemoptysis (coughing blood)",
            "Severe weight loss",
            "Drug-induced jaundice",
        ],
        "risk_rules_variant": "tb_adherence",
        "facility_type": "DOTS_CENTER",
    },
    "MALARIA_SCREENING": {
        "code": "MALARIA_SCREENING",
        "label": "Malaria screening",
        "extraction_focus": ["feverPattern", "rdtResult", "chillsRigors", "temperature"],
        "danger_signs": [
            "Fever > 39°C with altered consciousness",
            "RDT positive + severe symptoms",
            "Persistent vomiting",
        ],
        "risk_rules_variant": "malaria_severity",
        "facility_type": "PHC",
    },
    "EMERGENCY": {
        "code": "EMERGENCY",
        "label": "Emergency / acute event",
        "extraction_focus": [
            "systolicBP", "diastolicBP", "heartRate", "spO2", "respiratoryRate",
            "temperature", "gcs", "painScore", "airwayClear",
        ],
        "danger_signs": [
            "Airway compromise / not breathing normally",
            "SpO2 < 90%",
            "Shock (SBP < 90 or HR > 120)",
            "Altered consciousness / GCS <= 12",
        ],
        "risk_rules_variant": "trauma_redflags",
        "facility_type": "DH",
    },
    "TRAUMA": {
        "code": "TRAUMA",
        "label": "Injury / trauma",
        "extraction_focus": [
            "injuryMechanism", "wound", "bloodLossMl", "painScore",
            "gcs", "systolicBP", "heartRate", "airwayClear",
        ],
        "danger_signs": [
            "Penetrating injury (gunshot/stab)",
            "Uncontrolled major bleeding",
            "Severe head injury",
            "Limb fracture or deformity",
            "Major burn",
            "Snake / animal bite",
        ],
        "risk_rules_variant": "trauma_redflags",
        "facility_type": "DH",
    },
    "MENTAL_HEALTH": {
        "code": "MENTAL_HEALTH",
        "label": "Mental health screen / follow-up",
        "extraction_focus": [
            "phq2_anhedonia", "phq2_low_mood", "suicidal_ideation",
            "sleep", "appetite",
        ],
        "danger_signs": ["Active suicidal ideation", "Self-harm intent"],
        "risk_rules_variant": "mental_health_phq2",
        "facility_type": "CHC",
    },
    "NCD_SCREEN": {
        "code": "NCD_SCREEN",
        "label": "NCD (PEN) screening",
        "extraction_focus": [
            "systolicBP", "diastolicBP", "fastingGlucose", "randomGlucose",
            "tobaccoUse", "alcoholUse", "weight", "waistCircumference",
        ],
        "danger_signs": [
            "BP >= 180/110",
            "RBS >= 250 with symptoms",
            "Tobacco / pre-cancerous oral lesion",
        ],
        "risk_rules_variant": "ncd_pen",
        "facility_type": "PHC",
    },
    "OTHER": {
        "code": "OTHER",
        "label": "General community visit",
        "extraction_focus": ["systolicBP", "diastolicBP", "temperature", "spO2"],
        "danger_signs": ["Any vitals critical"],
        "risk_rules_variant": "default",
        "facility_type": "PHC",
    },
}


def get_visit_type(code: str) -> VisitType:
    return VISIT_TYPES.get(code, VISIT_TYPES["OTHER"])
