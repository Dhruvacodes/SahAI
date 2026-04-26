"""Health data extraction service backed by Anthropic Claude."""

import json
import os
from json import JSONDecodeError
from typing import Any

import anthropic
from dotenv import load_dotenv

from app.services.extraction_prompts import SYSTEM_PROMPT, USER_PROMPT_TEMPLATE
from app.services.language_policy import normalize_language_code
from app.services.model_policy import selected_claude_model

load_dotenv()

REQUIRED_TOP_LEVEL_KEYS = (
    "extractedVitals",
    "symptoms",
    "patientComplaint",
    "riskScore",
    "riskLevel",
    "referralGenerated",
    "followUpPlan",
)

REQUIRED_VITAL_KEYS = (
    "bloodPressureSystolic",
    "bloodPressureDiastolic",
    "hemoglobinLevel",
    "fetalMovements",
    "oedema",
    "temperature",
)


class ExtractionParseError(Exception):
    """Raised when the extraction model returns a response that cannot be parsed."""

    def __init__(self, message: str, raw: str) -> None:
        """Initialize a parse error with the raw model response."""
        super().__init__(message)
        self.message = message
        self.raw = raw


class ExtractionServiceError(Exception):
    """Raised when the extraction provider is unavailable or misconfigured."""

    def __init__(self, message: str, status_code: int) -> None:
        """Initialize a service error with an HTTP-style status code."""
        super().__init__(message)
        self.message = message
        self.status_code = status_code


async def extract_health_data(transcript: str, language_code: str = "hi") -> dict[str, Any]:
    """Extract structured health data from a transcript using Claude.

    Args:
        transcript: Raw ASHA visit transcript text.
        language_code: Requested language code for any patient-facing text fields.

    Returns:
        A validated dictionary containing extracted vitals, symptoms, risk, and follow-up data.

    Raises:
        ExtractionParseError: Raised when Claude returns invalid JSON.
        ExtractionServiceError: Raised when the Claude API is unavailable or not configured.
    """
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise ExtractionServiceError("ANTHROPIC_API_KEY is not configured", 503)

    client = anthropic.AsyncAnthropic(api_key=api_key)
    normalized_language_code = normalize_language_code(language_code)

    try:
        response = await client.messages.create(
            model=selected_claude_model().model_id,
            max_tokens=700,
            temperature=0,
            system=SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": USER_PROMPT_TEMPLATE.format(
                        language_code=normalized_language_code,
                        payload=json.dumps({"transcript": transcript}, ensure_ascii=False),
                    ),
                }
            ],
        )
    except anthropic.APIError as exc:
        raise ExtractionServiceError("Claude API unavailable", status_code=503) from exc

    response_text = _get_response_text(response)
    try:
        parsed_data = json.loads(response_text)
    except JSONDecodeError as exc:
        raise ExtractionParseError("Claude returned invalid JSON", raw=response_text) from exc

    if not isinstance(parsed_data, dict):
        raise ExtractionParseError("Claude returned invalid JSON", raw=response_text)

    return _validate_extracted_data(parsed_data)


def _get_response_text(response: Any) -> str:
    """Read the first text block from an Anthropic messages response."""
    content_block = response.content[0]
    return str(content_block.text)


def _validate_extracted_data(parsed_data: dict[str, Any]) -> dict[str, Any]:
    """Ensure extracted data contains every required key, filling missing values with None."""
    validated_data: dict[str, Any] = {}

    for key in REQUIRED_TOP_LEVEL_KEYS:
        validated_data[key] = parsed_data.get(key)

    extracted_vitals = validated_data["extractedVitals"]
    if not isinstance(extracted_vitals, dict):
        extracted_vitals = {}

    validated_data["extractedVitals"] = {
        key: extracted_vitals.get(key) for key in REQUIRED_VITAL_KEYS
    }
    return validated_data
