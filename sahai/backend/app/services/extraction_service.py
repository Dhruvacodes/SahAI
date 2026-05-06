# backend/app/services/extraction_service.py

from __future__ import annotations
"""Claude Haiku extraction with prompt caching, sanitization, validation."""
import os
import re
import json
import unicodedata
import logging
from typing import Optional
from anthropic import AsyncAnthropic
from app.prompts.extraction_system_prompts import build_extraction_user_message

log = logging.getLogger(__name__)
MAX_TRANSCRIPT_CHARS = 8000

_client: Optional[AsyncAnthropic] = None
def _get_client() -> AsyncAnthropic:
    global _client
    if _client is None:
        _client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    return _client


def sanitize_transcript(text: str) -> str:
    if not text:
        return ""
    text = text[:MAX_TRANSCRIPT_CHARS]
    text = unicodedata.normalize("NFKC", text)
    # Strip control chars except newline/tab
    text = "".join(ch for ch in text if ch in "\n\t" or not unicodedata.category(ch).startswith("C"))
    text = re.sub(r"\s+", " ", text).strip()
    return text


# Plausibility ranges
RANGES = {
    "systolicBP": (50, 250),
    "diastolicBP": (30, 150),
    "heartRate": (30, 200),
    "spO2": (50, 100),
    "temperature": (34.0, 42.0),
    "weight": (1, 200),
    "haemoglobin": (3.0, 20.0),
    "muacMm": (50, 200),
    "respiratoryRate": (10, 80),
}


def validate_extraction(data: dict) -> dict:
    """Clamp out-of-range numerics to None and add to missingFields."""
    vitals = data.get("vitals", {})
    missing = list(data.get("dataQuality", {}).get("missingFields", []))
    for field, (lo, hi) in RANGES.items():
        v = vitals.get(field)
        if v is None:
            continue
        try:
            num = float(v)
            if not (lo <= num <= hi):
                vitals[field] = None
                if field not in missing:
                    missing.append(field)
        except (TypeError, ValueError):
            vitals[field] = None
            if field not in missing:
                missing.append(field)
    data.setdefault("dataQuality", {})["missingFields"] = missing
    data["vitals"] = vitals
    return data


def empty_extraction(language_code: str, suspected_injection: bool = False) -> dict:
    return {
        "visitType": "OTHER",
        "vitals": {k: None for k in RANGES.keys()},
        "symptoms": [],
        "chiefComplaint": "",
        "patientInstruction": "",
        "dataQuality": {
            "confidence": 0.0,
            "suspectedInjection": suspected_injection,
            "missingFields": list(RANGES.keys()),
        },
    }


async def extract_clinical_data(transcript: str, context: dict) -> dict:
    """Extract structured clinical data from a transcript using Claude Haiku.
    
    context = {
        "languageCode": str,
        "visitTypeHint": Optional[str],
        "patientProfile": dict,
        "trendContext": str,
        "velocityWarnings": list[str],
    }
    
    Returns extraction dict matching schema in extraction_system_prompts.
    Includes _meta with token usage for cost tracking.
    """
    sanitized = sanitize_transcript(transcript)
    
    if not sanitized or len(sanitized) < 5:
        result = empty_extraction(context.get("languageCode", "en"))
        result["_meta"] = {"input_tokens": 0, "output_tokens": 0, "cached": False}
        return result
    
    messages = build_extraction_user_message(sanitized, context)
    client = _get_client()
    model = os.getenv("ANTHROPIC_MODEL_HAIKU", "claude-haiku-4-5-20251001")
    
    try:
        response = await client.messages.create(
            model=model,
            max_tokens=1024,
            messages=messages,
        )
    except Exception as e:
        log.exception(f"Anthropic extraction call failed: {e}")
        result = empty_extraction(context.get("languageCode", "en"))
        result["_meta"] = {"input_tokens": 0, "output_tokens": 0, "cached": False, "error": str(e)}
        return result
    
    # Parse JSON
    raw_text = response.content[0].text if response.content else ""
    # Strip markdown fences if model added them despite instructions
    raw_text = re.sub(r"^```(?:json)?\s*", "", raw_text.strip())
    raw_text = re.sub(r"```\s*$", "", raw_text)
    
    try:
        data = json.loads(raw_text)
    except json.JSONDecodeError:
        log.warning(f"Extraction returned invalid JSON: {raw_text[:200]}")
        data = empty_extraction(context.get("languageCode", "en"))
    
    # Validate ranges
    data = validate_extraction(data)
    
    # Attach token usage for cost tracking
    usage = response.usage
    data["_meta"] = {
        "input_tokens": getattr(usage, "input_tokens", 0),
        "output_tokens": getattr(usage, "output_tokens", 0),
        "cached_input_tokens": getattr(usage, "cache_read_input_tokens", 0),
        "model": model,
    }
    return data


# === Legacy compatibility aliases ===
class ExtractionParseError(Exception):
    """Raised when the extraction model returns a response that cannot be parsed."""
    def __init__(self, message: str, raw: str) -> None:
        super().__init__(message)
        self.message = message
        self.raw = raw


class ExtractionServiceError(Exception):
    """Raised when the extraction provider is unavailable or misconfigured."""
    def __init__(self, message: str, status_code: int) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


async def extract_health_data(transcript: str, language_code: str = "hi") -> dict:
    """Legacy compatibility wrapper for the old extraction API."""
    context = {"languageCode": language_code, "patientProfile": {}}
    result = await extract_clinical_data(transcript, context)
    # Map new schema to old schema for backward compat
    vitals = result.get("vitals", {})
    return {
        "extractedVitals": {
            "bloodPressureSystolic": vitals.get("systolicBP"),
            "bloodPressureDiastolic": vitals.get("diastolicBP"),
            "hemoglobinLevel": vitals.get("haemoglobin"),
            "fetalMovements": None,
            "oedema": None,
            "temperature": vitals.get("temperature"),
        },
        "symptoms": result.get("symptoms", []),
        "patientComplaint": result.get("chiefComplaint", ""),
        "riskScore": None,
        "riskLevel": None,
        "referralGenerated": None,
        "followUpPlan": result.get("patientInstruction", ""),
    }
