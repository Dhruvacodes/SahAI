"""Referral note generation service for ASHA-to-PHC escalation workflows."""

import json
import os
from json import JSONDecodeError
from typing import Any

import anthropic
from dotenv import load_dotenv

load_dotenv()

SUPPORTED_REFERRAL_LANGUAGES = {"en", "hi"}
URGENCY_LEVELS = {"ROUTINE", "URGENT", "EMERGENCY"}


async def generate_referral(visit_data: dict, language: str) -> dict:
    """Generate a referral note and ASHA follow-up plan with Claude.

    Args:
        visit_data: Visit context including patient details, vitals, symptoms, risk, and ASHA name.
        language: Output language for patient-facing follow-up text, either English or Hindi.

    Returns:
        A dictionary containing referralText, followUpPlan, and urgency.
    """
    normalized_language = language if language in SUPPORTED_REFERRAL_LANGUAGES else "en"
    system_prompt = _build_system_prompt(normalized_language)
    user_message = _build_user_message(visit_data)
    api_key = os.getenv("ANTHROPIC_API_KEY")

    if not api_key:
        return _fallback_referral(visit_data, normalized_language)

    client = anthropic.AsyncAnthropic(api_key=api_key)

    try:
        response = await client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=700,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}],
        )
        response_text = _get_response_text(response)
        parsed_response = json.loads(response_text)
    except (JSONDecodeError, anthropic.APIError, IndexError, AttributeError):
        return _fallback_referral(visit_data, normalized_language)

    if not isinstance(parsed_response, dict):
        return _fallback_referral(visit_data, normalized_language)

    return _validate_referral_response(parsed_response, visit_data, normalized_language)


def _build_system_prompt(language: str) -> str:
    """Build the Claude system prompt for referral generation."""
    return f"""You are a clinical documentation assistant for India's NHM ASHA program.
Generate two things:
1. A formal referral note for the PHC doctor (professional tone, medical terminology)
2. A follow-up care plan for the ASHA worker to communicate to the patient
   (simple language, no jargon, in {language})

Format your response as JSON with keys: referralText, followUpPlan, urgency
Urgency must be one of: ROUTINE, URGENT, EMERGENCY
No markdown. Return only valid JSON."""


def _build_user_message(visit_data: dict) -> str:
    """Build the user message containing visit facts for referral generation."""
    return (
        f"Patient: {visit_data.get('patientName')}, "
        f"Age: {visit_data.get('ageYears')}, "
        f"Village: {visit_data.get('village')}\n"
        f"Vitals: {visit_data.get('vitals')}. "
        f"Symptoms: {visit_data.get('symptoms')}. "
        f"Risk Level: {visit_data.get('riskLevel')}.\n"
        f"Risk Flags: {visit_data.get('riskFlags')}. "
        f"Visiting ASHA: {visit_data.get('ashaName')}. "
        f"Date: {visit_data.get('visitDate')}"
    )


def _get_response_text(response: Any) -> str:
    """Read the first text block from an Anthropic messages response."""
    content_block = response.content[0]
    return str(content_block.text)


def _validate_referral_response(
    parsed_response: dict[str, Any],
    visit_data: dict,
    language: str,
) -> dict:
    """Normalize Claude referral JSON into the required response shape."""
    referral_text = parsed_response.get("referralText")
    follow_up_plan = parsed_response.get("followUpPlan")
    urgency = parsed_response.get("urgency")

    if not isinstance(referral_text, str) or not isinstance(follow_up_plan, str):
        return _fallback_referral(visit_data, language)

    if urgency not in URGENCY_LEVELS:
        urgency = "ROUTINE"

    return {
        "referralText": referral_text,
        "followUpPlan": follow_up_plan,
        "urgency": urgency,
    }


def _fallback_referral(visit_data: dict, language: str) -> dict:
    """Return a generic referral response when Claude output cannot be parsed."""
    patient_name = visit_data.get("patientName") or "the patient"
    risk_level = visit_data.get("riskLevel") or "unclassified"
    symptoms = visit_data.get("symptoms") or []
    symptoms_text = ", ".join(str(symptom) for symptom in symptoms) or "not documented"

    if language == "hi":
        follow_up_plan = (
            "Rogi ko PHC par jaanch ke liye bhejein. Dawa ya salah doctor ke kehne par hi lein. "
            "Agar saans, tez dard, behoshi, ya zyada takleef ho to turant 108 par call karein."
        )
    else:
        follow_up_plan = (
            "Ask the patient to visit the PHC for assessment. Follow the doctor's advice for medicines "
            "or tests. If severe pain, breathing trouble, fainting, or worsening symptoms occur, call 108."
        )

    return {
        "referralText": (
            f"Referral for {patient_name}. Risk level: {risk_level}. "
            f"Reported symptoms: {symptoms_text}. Please evaluate at the PHC and advise further care."
        ),
        "followUpPlan": follow_up_plan,
        "urgency": "ROUTINE",
    }

