"""Deterministic referral renderer over fired protocol rules.

The risk band, first-response actions, and the urgency tier are all decided by
the protocol engine. This module turns those decisions into the wire-shape
expected by the mobile client (`ReferralResponse`). No LLM is called here:
every line of text either comes from the rule's authored templates or from a
small set of language-localised strings hard-coded below. That makes the
referral fully auditable end-to-end.

For HIGH/CRITICAL cases where the operator wants a polished single-paragraph
patient instruction (e.g. for TTS read-aloud), `referral_service.generate_referral`
may still call Sonnet — but it now feeds Sonnet the assembled packet and
explicitly constrains it to consolidate text *only*, never invent facts.
"""

from __future__ import annotations

from typing import Any, Dict, Iterable, List, Optional

from app.services.visit_types import get_visit_type


URGENCY_FROM_LEVEL = {
    "CRITICAL": "EMERGENCY",
    "HIGH": "URGENT",
    "MODERATE": "ELEVATED",
    "LOW": "ROUTINE",
}


def _localised(field: Optional[Dict[str, str]], language_code: str, fallback: str = "") -> str:
    if not field:
        return fallback
    if language_code in field and field[language_code]:
        return field[language_code]
    if "en" in field and field["en"]:
        return field["en"]
    # Pick any available
    for value in field.values():
        if value:
            return value
    return fallback


def _facility_for_visit_type(visit_type: str) -> Dict[str, str]:
    vt = get_visit_type(visit_type)
    facility_type = vt.get("facility_type", "PHC")
    facility = "Nearest CHC" if facility_type in ("CHC", "DH") else "Nearest PHC"
    if facility_type == "DH":
        facility = "Nearest District Hospital"
    if facility_type == "IMCI_HOSPITAL":
        facility = "Nearest IMNCI hospital"
    if facility_type == "DOTS_CENTER":
        facility = "DOTS centre"
    return {"facility": facility, "facilityType": facility_type}


def _next_visit_days(level: str) -> int:
    return {
        "CRITICAL": 0,
        "HIGH": 1,
        "MODERATE": 7,
        "LOW": 28,
    }.get(level, 14)


def _dedup_strings(items: Iterable[str]) -> List[str]:
    seen: set = set()
    out: List[str] = []
    for s in items:
        if not s:
            continue
        if s in seen:
            continue
        seen.add(s)
        out.append(s)
    return out


def render_referral_from_rules(
    extraction: Dict[str, Any],
    fired_rules: List[Dict[str, Any]],
    risk_level: str,
    language_code: str,
    facility_info: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Build a complete referral packet from the protocol-engine fired rules.

    Args:
        extraction: full extraction dict returned by /api/extract.
        fired_rules: ordered list of fired rules (each with ``label``,
            ``rationale``, ``referral_text_templates``, ``first_response_actions``).
        risk_level: final severity band assigned by the engine.
        language_code: patient's spoken language; the patient instruction is
            rendered in this language.
        facility_info: optional override of facility/phone metadata.
    """
    visit_type = extraction.get("visitType", "OTHER")

    # 1. ASHA referral note (always English so receiving facility can read it).
    asha_lines: List[str] = []
    for rule in fired_rules:
        templates = rule.get("referral_text_templates") or {}
        asha_text = _localised(templates.get("asha_to_phc"), "en", "")
        if asha_text:
            asha_lines.append(asha_text)
    if not asha_lines:
        asha_lines = [
            f"{risk_level} risk {visit_type} case identified by protocol engine.",
            "Refer to nearest appropriate facility per fired rule(s).",
        ]
    referral_text = "\n".join(_dedup_strings(asha_lines))

    # 1b. ANM-facing one-line clinical summary (rule labels joined). The Haiku
    #     polish layer in referral_service may rewrite this into a single
    #     fluent sentence, but it must NOT introduce new clinical facts.
    rule_labels = [rule.get("label") or rule.get("id") or "" for rule in fired_rules]
    rule_labels = [lbl for lbl in rule_labels if lbl]
    if rule_labels:
        clinical_summary = (
            f"{risk_level} risk {visit_type} case. Fired rules: "
            + "; ".join(rule_labels)
            + "."
        )
    else:
        clinical_summary = f"{risk_level} risk {visit_type} case."

    # 2. Patient-facing instruction (in patient language).
    patient_lines: List[str] = []
    for rule in fired_rules:
        templates = rule.get("referral_text_templates") or {}
        patient_text = _localised(templates.get("patient_instruction"), language_code, "")
        if patient_text:
            patient_lines.append(patient_text)
    if not patient_lines:
        patient_lines = [
            _default_patient_line(risk_level, language_code),
        ]
    patient_instruction = " ".join(_dedup_strings(patient_lines)).strip()

    # 3. First-response checklist — flatten action.text in patient-language
    #    where available, else English. Each action is one short imperative.
    first_response: List[str] = []
    seen_action_ids: set = set()
    for rule in fired_rules:
        for action in rule.get("first_response_actions") or []:
            aid = action.get("id")
            if aid and aid in seen_action_ids:
                continue
            if aid:
                seen_action_ids.add(aid)
            first_response.append(_localised(action.get("text"), language_code, ""))
    first_response = _dedup_strings(first_response)

    # 4. Facility resolution.
    facility_block = _facility_for_visit_type(visit_type)
    if facility_info and facility_info.get("name"):
        facility_block["facility"] = facility_info["name"]

    # 5. Monitor list — pulled from rule labels so dashboard can show what
    #    triggered the band.
    monitor_for = [rule.get("label") or rule.get("id") for rule in fired_rules]

    return {
        "referralText": referral_text,
        "clinicalSummary": clinical_summary,
        "patientInstruction": patient_instruction,
        "urgency": URGENCY_FROM_LEVEL.get(risk_level, "ROUTINE"),
        "facility": facility_block["facility"],
        "facilityType": facility_block["facilityType"],
        "followUpPlan": {
            "nextVisitDays": _next_visit_days(risk_level),
            "monitorFor": [m for m in monitor_for if m],
        },
        "firstResponseActions": first_response,
        "firedRuleIds": [rule.get("id") for rule in fired_rules if rule.get("id")],
        "_meta": {"source": "protocol_engine"},
    }


def _default_patient_line(level: str, language_code: str) -> str:
    """Fallback patient instruction when no fired rule has a localised template."""
    table = {
        "hi": {
            "CRITICAL": "अभी अस्पताल जाना ज़रूरी है। 108 बुला ली है।",
            "HIGH": "आज ही पास के अस्पताल जाना है।",
            "MODERATE": "अगले कुछ दिनों में डॉक्टर को दिखाएं।",
            "LOW": "सब ठीक है। अगर तकलीफ़ बढ़े तो ANM दीदी को बताएं।",
        },
        "en": {
            "CRITICAL": "We need to go to the hospital right now. 108 has been called.",
            "HIGH": "We must visit the nearest hospital today.",
            "MODERATE": "Please see a doctor in the next few days.",
            "LOW": "All is well. Tell your ASHA worker if anything bothers you.",
        },
        "bn": {
            "CRITICAL": "এখনই হাসপাতালে যেতে হবে। ১০৮ ডাকা হয়েছে।",
            "HIGH": "আজই কাছের হাসপাতালে যান।",
            "MODERATE": "আগামী কয়েক দিনের মধ্যে ডাক্তার দেখান।",
            "LOW": "সব ঠিক আছে। কোনো সমস্যা হলে আশা দিদিকে জানান।",
        },
        "ta": {
            "CRITICAL": "உடனே மருத்துவமனைக்கு செல்ல வேண்டும். 108 அழைக்கப்பட்டது.",
            "HIGH": "இன்றே அருகிலுள்ள மருத்துவமனைக்குச் செல்லவும்.",
            "MODERATE": "அடுத்த சில நாட்களில் மருத்துவரைப் பாருங்கள்.",
            "LOW": "எல்லாம் நலம். ஏதாவது தொந்தரவு இருந்தால் ASHA க்கு தெரிவிக்கவும்.",
        },
    }
    return (table.get(language_code) or table["en"]).get(level, "")
