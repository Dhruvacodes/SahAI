"""Referral generation as a renderer over fired protocol rules.

The protocol engine is now the single source of clinical decisions:
severity, time-to-treatment, fired-rule citations and the first-response
checklist. This service turns that authoritative packet into the wire shape
expected by the mobile client.

Three branches:

  * **A — fired rules present:** assemble the packet from the rules'
    ``referral_text_templates`` and ``first_response_actions``. Optionally
    polish only the patient-facing instruction and a short ANM clinical
    summary using Claude Haiku (cheap), with a strict safety filter that
    rejects any output that introduces medication, dosage, route, or other
    facts not already present in the deterministic packet.

  * **B — no fired rules, LOW/MODERATE:** fall back to the long-standing
    NHM-aligned templates. This is the right product for routine visits
    where nothing escalated.

  * **C — no fired rules, HIGH/CRITICAL:** something escalated (e.g. via
    legacy inline rules in ``risk_engine.score_risk``) but the protocol
    catalog has no matching rule. Emit a generic fallback referral and tag
    ``_meta.catalog_gap = True`` so the router logs a ``CATALOG_GAP`` audit
    event for the rule authors to fix.
"""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Dict, List, Optional

from anthropic import AsyncAnthropic

from app.services.protocol_referral import render_referral_from_rules
from app.services.template_referrals import build_template_referral

log = logging.getLogger(__name__)


# ─── Haiku polish layer ─────────────────────────────────────────────────────


POLISH_SYSTEM_PROMPT = """You are a clinical text polisher for ASHA (community health) workers in India.

You receive an authoritative referral packet from a rule-based protocol engine. The packet was produced from government-approved clinical protocols (NHM / MoHFW / IMNCI). Every clinical fact in it is already correct and audited.

YOUR JOB: rewrite ONLY two strings into one fluent natural sentence each:
  1. patientInstruction — in the requested language, addressed to the patient/family. Plain, warm, second-person.
  2. clinicalSummary    — in English, addressed to the receiving ANM / medical officer. Compact, professional.

HARD CONSTRAINTS (violation = your output is discarded):
  * You MUST NOT introduce any clinical fact, diagnosis, medication name, dosage, time interval, route of administration, anatomical detail, or instruction that is not already present in the input packet.
  * You MUST NOT add reassurance or hedging language ("don't worry", "it's probably nothing").
  * You MUST NOT translate or change facility names, urgency, or numbers from the packet.
  * You MAY only rephrase, condense, and translate.

Output STRICT JSON only (no prose, no markdown):
{ "patientInstruction": "...", "clinicalSummary": "..." }
"""


# Tokens that indicate the polished text introduced clinical facts the
# protocol engine never sanctioned. They are blocked unless the *exact*
# token also appears in the deterministic packet (i.e. a rule template
# already included e.g. "ORS" or "ampicillin").
_MEDICATION_TOKEN_RE = re.compile(
    r"\b("
    r"\d+\s?(?:mg|mcg|ml|tablet|capsule|drop|drops|iu|units?)"
    r"|(?:IV|IM|SC|PO|IO)"
    r"|(?:paracetamol|ibuprofen|amoxicillin|ampicillin|gentamicin|ceftriaxone|"
    r"oxytocin|misoprostol|magnesium\s?sulphate|labetalol|nifedipine|"
    r"insulin|metformin|aspirin|ors)"
    r")\b",
    flags=re.IGNORECASE,
)


_client: Optional[AsyncAnthropic] = None


def _get_client() -> AsyncAnthropic:
    global _client
    if _client is None:
        _client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    return _client


def _safe_polish_string(
    candidate: str,
    deterministic: str,
    packet_text: str,
    max_ratio: float = 2.0,
) -> Optional[str]:
    """Return ``candidate`` if it passes the safety filter, else ``None``.

    The filter rejects medication / dosage / route tokens that aren't already
    in ``packet_text`` (the union of every authored string in the deterministic
    packet) and rejects outputs that are dramatically longer than the original.
    """
    if not candidate or not isinstance(candidate, str):
        return None
    candidate = candidate.strip()
    if not candidate:
        return None
    if len(candidate) > max(120, int(len(deterministic) * max_ratio)):
        return None

    packet_lower = packet_text.lower()
    for match in _MEDICATION_TOKEN_RE.finditer(candidate):
        token = match.group(0).lower()
        if token not in packet_lower:
            return None

    # Reject any new numeric ranges that aren't in the packet.
    for num_match in re.finditer(r"\b\d+(?:\.\d+)?\b", candidate):
        num = num_match.group(0)
        if num not in packet_text:
            return None

    return candidate


async def _polish_packet(
    packet: Dict[str, Any],
    language_code: str,
) -> Dict[str, Any]:
    """Run Haiku over the packet's patient instruction and clinical summary.

    On any failure or safety-filter rejection the packet is returned with
    ``_meta.source`` left as ``protocol_engine``. On success ``_meta.source``
    becomes ``protocol_engine+haiku_polish`` and the polished strings replace
    only those two fields.
    """
    if not os.getenv("ANTHROPIC_API_KEY"):
        return packet

    deterministic_patient = packet.get("patientInstruction", "")
    deterministic_summary = packet.get("clinicalSummary", "")

    # Build a single string of all packet text — the safety filter uses this
    # to allow Haiku to keep tokens that the rules already authorised.
    packet_corpus_parts: List[str] = [
        deterministic_patient,
        deterministic_summary,
        packet.get("referralText", ""),
    ]
    packet_corpus_parts.extend(packet.get("firstResponseActions") or [])
    packet_corpus = "\n".join(p for p in packet_corpus_parts if p)

    user_text = (
        f"<request>\n"
        f"language: {language_code}\n"
        f"</request>\n\n"
        f"<packet>\n"
        f"{json.dumps({'patientInstruction': deterministic_patient, 'clinicalSummary': deterministic_summary, 'urgency': packet.get('urgency'), 'facility': packet.get('facility'), 'firstResponseActions': packet.get('firstResponseActions') or [], 'firedRuleIds': packet.get('firedRuleIds') or []}, ensure_ascii=False)}\n"
        f"</packet>\n\n"
        f"Return ONLY the JSON object."
    )

    messages = [
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": POLISH_SYSTEM_PROMPT,
                    "cache_control": {"type": "ephemeral"},
                },
                {"type": "text", "text": user_text},
            ],
        }
    ]

    client = _get_client()
    model = os.getenv("ANTHROPIC_MODEL_HAIKU", "claude-haiku-4-5-20251001")

    try:
        response = await client.messages.create(
            model=model, max_tokens=512, messages=messages
        )
        raw = response.content[0].text
        raw = re.sub(r"^```(?:json)?\s*", "", raw.strip())
        raw = re.sub(r"```\s*$", "", raw)
        data = json.loads(raw)
    except Exception as exc:
        log.warning("Haiku polish failed, keeping deterministic strings: %s", exc)
        return packet

    polished_patient = _safe_polish_string(
        data.get("patientInstruction", ""),
        deterministic_patient,
        packet_corpus,
    )
    polished_summary = _safe_polish_string(
        data.get("clinicalSummary", ""),
        deterministic_summary,
        packet_corpus,
    )

    if not polished_patient or not polished_summary:
        log.info(
            "Haiku polish rejected by safety filter (rule_ids=%s)",
            packet.get("firedRuleIds"),
        )
        return packet

    usage = response.usage
    new_meta = dict(packet.get("_meta") or {})
    new_meta.update(
        {
            "source": "protocol_engine+haiku_polish",
            "model": model,
            "input_tokens": getattr(usage, "input_tokens", 0),
            "output_tokens": getattr(usage, "output_tokens", 0),
            "cached_input_tokens": getattr(usage, "cache_read_input_tokens", 0),
        }
    )

    polished = dict(packet)
    polished["patientInstruction"] = polished_patient
    polished["clinicalSummary"] = polished_summary
    polished["_meta"] = new_meta
    return polished


# ─── catalog-gap fallback ───────────────────────────────────────────────────


def _fallback_referral(
    risk_level: str,
    visit_type: str,
    language_code: str,
    risk_flags: List[str],
) -> Dict[str, Any]:
    """Generic referral used only when no protocol rule fired but risk
    escalated through the legacy inline rules. Tagged so the router can
    emit a CATALOG_GAP audit event.
    """
    instruction_table = {
        "hi": "आज ही पास के अस्पताल जाना ज़रूरी है। ASHA दीदी साथ चलेंगी।",
        "en": "Please go to the nearest hospital today. Your ASHA will accompany you.",
        "bn": "আজই কাছের হাসপাতালে যেতে হবে। আশা দিদি সাথে যাবেন।",
        "ta": "இன்றே அருகிலுள்ள மருத்துவமனைக்குச் செல்ல வேண்டும். ASHA உங்களுடன் வருவார்.",
        "te": "ఈ రోజే దగ్గరి ఆసుపత్రికి వెళ్లాలి. ASHA మీతో వస్తుంది.",
        "mr": "आजच जवळच्या रुग्णालयात जा. ASHA सोबत येतील.",
    }
    return {
        "referralText": (
            f"{risk_level} risk {visit_type} case. "
            f"Escalated by legacy clinical rules (no specific protocol matched). "
            f"Flags: {', '.join(risk_flags) if risk_flags else 'none'}. "
            f"Refer to nearest CHC for clinical evaluation."
        ),
        "clinicalSummary": (
            f"{risk_level} risk {visit_type} — review by ANM/MO required."
        ),
        "patientInstruction": instruction_table.get(
            language_code, instruction_table["en"]
        ),
        "urgency": "URGENT" if risk_level == "HIGH" else "EMERGENCY",
        "facility": "Nearest CHC",
        "facilityType": "CHC",
        "followUpPlan": {"nextVisitDays": 1, "monitorFor": list(risk_flags)},
        "firstResponseActions": [
            "Call ANM",
            "Arrange transport (108 if available)",
            "Stay with patient until transport arrives",
        ],
        "firedRuleIds": [],
        "_meta": {
            "source": "fallback",
            "catalog_gap": True,
            "risk_flags": list(risk_flags),
        },
    }


# ─── public API ─────────────────────────────────────────────────────────────


async def generate_referral(
    extraction: dict,
    risk_result: dict,
    language_code: str,
    asha_facility_info: Optional[dict] = None,
) -> dict:
    """Build a referral note from extraction + risk.

    Args:
        extraction: full dict returned by ``/api/extract`` (must carry the
            ``firedRules`` array if the protocol engine was used).
        risk_result: ``{level, score, flags, firedRules?, ...}``.
        language_code: patient's spoken language.
        asha_facility_info: optional ``{name, ...}`` override for facility
            display.
    """
    risk_level = risk_result.get("level", "LOW")
    visit_type = extraction.get("visitType", "OTHER")
    risk_flags = list(risk_result.get("flags") or [])

    # Source the fired rules from either the risk result (preferred — has
    # the full rule packet via score_risk_via_protocol) or the extraction
    # response (mobile syncs from there).
    fired_rules: List[Dict[str, Any]] = (
        risk_result.get("firedRules")
        or risk_result.get("fired_rules")
        or extraction.get("firedRules")
        or []
    )

    # ── Branch A: protocol engine produced fired rules ─────────────────────
    if fired_rules:
        packet = render_referral_from_rules(
            extraction=extraction,
            fired_rules=fired_rules,
            risk_level=risk_level,
            language_code=language_code,
            facility_info=asha_facility_info,
        )
        if risk_level in ("HIGH", "CRITICAL"):
            packet = await _polish_packet(packet, language_code)
        return packet

    # ── Branch B: routine LOW / MODERATE — use NHM templates ───────────────
    if risk_level in ("LOW", "MODERATE"):
        return build_template_referral(visit_type, risk_level, language_code, extraction)

    # ── Branch C: catalog gap — escalated but no rule matched ──────────────
    log.warning(
        "CATALOG_GAP: %s risk %s with no fired rule. flags=%s",
        risk_level,
        visit_type,
        risk_flags,
    )
    return _fallback_referral(risk_level, visit_type, language_code, risk_flags)
