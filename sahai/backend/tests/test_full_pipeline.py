"""End-to-end API tests for the ASR, extraction, risk, and referral pipeline."""

import json
import os
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from scripts.demo_transcripts import DEMO_TRANSCRIPTS

pytestmark = pytest.mark.asyncio


@pytest.mark.asyncio
async def test_full_visit_pipeline() -> None:
    """Run the critical visit flow from ASR through referral generation with mocked AI SDKs."""
    critical_demo = DEMO_TRANSCRIPTS["critical_bp"]
    transcript_text = critical_demo["text"]
    extracted_payload = {
        "extractedVitals": {
            "bloodPressureSystolic": 165,
            "bloodPressureDiastolic": 110,
            "hemoglobinLevel": 8.4,
            "fetalMovements": False,
            "oedema": True,
            "temperature": 99.1,
        },
        "symptoms": [
            "hand and foot swelling",
            "visual disturbance",
            "absent fetal movements",
        ],
        "patientComplaint": "Severe swelling and absent fetal movement for two days.",
        "riskScore": 92,
        "riskLevel": "CRITICAL",
        "referralGenerated": True,
        "followUpPlan": "Immediate referral is required.",
    }
    referral_payload = {
        "referralText": (
            "Patient requires immediate PHC and higher-center evaluation for severe "
            "hypertension with oedema and absent fetal movements."
        ),
        "followUpPlan": (
            "Patient aur parivar ko turant referral ke baare mein samjhayen aur deri "
            "kiye bina 108 se sahayata lein."
        ),
        "urgency": "EMERGENCY",
    }

    with patch.dict(
        os.environ,
        {"OPENAI_API_KEY": "test-openai-key", "ANTHROPIC_API_KEY": "test-anthropic-key"},
        clear=False,
    ), patch(
        "app.services.asr_service.AsyncOpenAI",
        return_value=build_openai_client_mock(transcript_text),
    ), patch(
        "app.services.extraction_service.anthropic.Anthropic",
        return_value=build_anthropic_client_mock(extracted_payload),
    ), patch(
        "app.services.extraction_service.anthropic.AsyncAnthropic",
        return_value=build_anthropic_client_mock(extracted_payload),
    ), patch(
        "app.services.referral_service.anthropic.Anthropic",
        return_value=build_anthropic_client_mock(referral_payload),
    ), patch(
        "app.services.referral_service.anthropic.AsyncAnthropic",
        return_value=build_anthropic_client_mock(referral_payload),
    ):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            asr_response = await client.post(
                "/api/asr/transcribe",
                data={"language_code": critical_demo["language"]},
                files={"audio_file": ("critical_bp.m4a", b"fake audio bytes", "audio/mp4")},
            )
            assert asr_response.status_code == 200
            asr_payload = asr_response.json()
            assert asr_payload["transcript"] == transcript_text

            extraction_response = await client.post(
                "/api/extract",
                json={"transcript": asr_payload["transcript"], "visitId": "visit-critical-001"},
            )
            assert extraction_response.status_code == 200
            extraction_json = extraction_response.json()
            assert extraction_json["bloodPressureSystolic"] >= 160

            risk_response = await client.post(
                "/api/risk/score",
                json={
                    "vitals": extraction_json,
                    "patient": {
                        "isPregnant": True,
                        "gestationalWeek": 32,
                        "ageYears": 26,
                    },
                },
            )
            assert risk_response.status_code == 200
            risk_json = risk_response.json()
            risk_level = risk_json["level"]
            assert risk_level == "CRITICAL"
            assert risk_json["score"] >= 75

            referral_response = await client.post(
                "/api/referral/generate",
                json={
                    "patientName": "Sunita",
                    "ageYears": 26,
                    "village": "Kakori",
                    "visitDate": "2026-04-23T10:15:00+00:00",
                    "vitals": extraction_json,
                    "symptoms": extraction_json["symptoms"],
                    "riskLevel": risk_level,
                    "riskFlags": risk_json["flags"],
                    "ashaName": "Savitri Devi",
                    "outputLanguage": "hi",
                },
            )
            assert referral_response.status_code == 200
            referral_json = referral_response.json()
            assert referral_json["referralText"]
            assert referral_json["urgency"] == "EMERGENCY"


def build_openai_client_mock(transcript_text: str) -> SimpleNamespace:
    """Create a mocked AsyncOpenAI client that returns a fixed transcript text."""
    return SimpleNamespace(
        audio=SimpleNamespace(
            transcriptions=SimpleNamespace(create=AsyncMock(return_value=transcript_text))
        )
    )


def build_anthropic_client_mock(payload: dict) -> SimpleNamespace:
    """Create a mocked Anthropic client returning the given JSON payload as text."""
    response = SimpleNamespace(content=[SimpleNamespace(text=json.dumps(payload))])
    return SimpleNamespace(messages=SimpleNamespace(create=AsyncMock(return_value=response)))
