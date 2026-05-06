# backend/app/services/referral_service.py
"""Smart routing: template for LOW/MODERATE, Sonnet for HIGH/CRITICAL."""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Dict, Optional

from anthropic import AsyncAnthropic

from app.services.template_referrals import build_template_referral
from app.services.visit_types import get_visit_type

log = logging.getLogger(__name__)


REFERRAL_SYSTEM_PROMPT = """You are a clinical referral note generator for ASHA (community health) workers in India.

You receive a CRITICAL or HIGH risk extraction. Your job is to produce a clear, protocol-aligned referral the ASHA can act on immediately.

ROLE BOUNDARIES:
1. You DO NOT diagnose. You name "suspected" conditions only when the constellation is clear.
2. You DO NOT prescribe medications or dosages.
3. You produce: (a) clinical referral note in English for ANM/doctor, (b) simple-language patient instruction in patient's language.

OUTPUT (strict JSON):
{
  "referralText": "...",
  "patientInstruction": "...",
  "urgency": "EMERGENCY" | "URGENT" | "ELEVATED",
  "facility": "...",
  "facilityType": "PHC" | "CHC" | "DH" | "IMCI_HOSPITAL",
  "followUpPlan": {
    "nextVisitDays": number,
    "monitorFor": [list of warning signs]
  },
  "firstResponseActions": [list of 2-4 actions ASHA should take BEFORE transport, e.g. "Call 108 ambulance", "Place patient in left lateral position"]
}
"""


_client: Optional[AsyncAnthropic] = None


def _get_client() -> AsyncAnthropic:
    global _client
    if _client is None:
        _client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    return _client


def _fallback_referral(risk_level: str, visit_type: str, language_code: str) -> Dict[str, Any]:
    return {
        "referralText": (
            f"{risk_level} risk {visit_type} case. "
            "Refer to nearest CHC immediately. "
            "Suspected condition requires medical evaluation."
        ),
        "patientInstruction": (
            "Aapko aaj hi bade hospital jaana hai. Sthithi gambhir ho sakti hai."
            if language_code == "hi"
            else "Please go to the nearest hospital today."
        ),
        "urgency": "URGENT",
        "facility": "Nearest CHC",
        "facilityType": "CHC",
        "followUpPlan": {"nextVisitDays": 1, "monitorFor": []},
        "firstResponseActions": ["Call ANM", "Arrange transport"],
    }


async def generate_referral(
    extraction: dict,
    risk_result: dict,
    language_code: str,
    asha_facility_info: Optional[dict] = None,
) -> dict:
    """
    extraction: full extraction dict from extract_clinical_data
    risk_result: {level, score, flags}
    asha_facility_info: {chcName, chcDistanceKm, anmName, anmPhone, ambulancePhone}
    """
    risk_level = risk_result["level"]
    visit_type = extraction.get("visitType", "OTHER")

    if asha_facility_info is None:
        asha_facility_info = {
            "chcName": "Nearest CHC",
            "anmPhone": "Contact ANM",
            "ambulancePhone": "108",
        }

    # === ROUTING DECISION ===
    if risk_level in ("LOW", "MODERATE"):
        # Template — no LLM call
        return build_template_referral(visit_type, risk_level, language_code, extraction)

    # HIGH/CRITICAL: Sonnet call
    if not os.getenv("ANTHROPIC_API_KEY"):
        return _fallback_referral(risk_level, visit_type, language_code)

    visit_type_def = get_visit_type(visit_type)

    user_text = (
        f"<context>\n"
        f"riskLevel: {risk_level}\n"
        f"riskFlags: {risk_result['flags']}\n"
        f"languageCode: {language_code}\n"
        f"visitType: {visit_type} ({visit_type_def['label']})\n"
        f"facility_options: {asha_facility_info}\n"
        f"</context>\n\n"
        f"<extraction>\n"
        f"{extraction}\n"
        f"</extraction>\n\n"
        f"Return ONLY the JSON object."
    )

    messages = [
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": REFERRAL_SYSTEM_PROMPT,
                    "cache_control": {"type": "ephemeral"},
                },
                {"type": "text", "text": user_text},
            ],
        }
    ]

    client = _get_client()
    model = os.getenv("ANTHROPIC_MODEL_SONNET", "claude-sonnet-4-6")

    try:
        response = await client.messages.create(
            model=model, max_tokens=1024, messages=messages
        )
        raw = response.content[0].text
        raw = re.sub(r"^```(?:json)?\s*", "", raw.strip())
        raw = re.sub(r"```\s*$", "", raw)
        data = json.loads(raw)
        usage = response.usage
        data["_meta"] = {
            "source": "sonnet",
            "model": model,
            "input_tokens": getattr(usage, "input_tokens", 0),
            "output_tokens": getattr(usage, "output_tokens", 0),
            "cached_input_tokens": getattr(usage, "cache_read_input_tokens", 0),
        }
        return data
    except Exception as e:
        log.exception(f"Sonnet referral failed: {e}")
        fb = _fallback_referral(risk_level, visit_type, language_code)
        fb["_meta"] = {"source": "fallback", "error": str(e)}
        return fb
