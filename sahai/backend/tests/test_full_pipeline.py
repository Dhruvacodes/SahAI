"""End-to-end API tests for the ASR, extraction, risk, and referral pipeline.

Updated for V3 architecture: new consent schema, extraction response format,
and mock targets aligned with the current service layer.
"""

import json
import os
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app

pytestmark = pytest.mark.asyncio

# V3 consent format
CONSENT_SNAPSHOT = {
    "consentGranted": True,
    "scopeAgreed": ["clinical_visit", "data_sync"],
    "languageCode": "hi",
    "timestamp": "2026-05-06T10:00:00Z",
    "witnessPresent": False,
    "patientId": "demo-pat-001",
    "ashaId": "demo-asha-001",
}

# V3 extraction result (Haiku output shape)
MOCK_EXTRACTION_JSON = json.dumps({
    "visitType": "ANC",
    "vitals": {
        "systolicBP": 165,
        "diastolicBP": 110,
        "heartRate": 88,
        "spO2": 97,
        "temperature": 37.2,
        "weight": 58,
        "haemoglobin": 8.4,
        "muacMm": None,
        "respiratoryRate": None,
    },
    "symptoms": ["headache", "edema", "visual disturbance"],
    "chiefComplaint": "Severe headache and swelling for two days.",
    "patientInstruction": "Aapko aaj hi hospital jaana zaroori hai. BP zyada hai. 108 pe call karein.",
    "dataQuality": {
        "confidence": 0.85,
        "suspectedInjection": False,
        "missingFields": [],
    },
})

# V3 referral result (Sonnet output shape)
MOCK_REFERRAL_JSON = json.dumps({
    "referralText": (
        "Patient requires immediate PHC evaluation for severe "
        "hypertension with oedema and visual disturbance. Suspected pre-eclampsia."
    ),
    "patientInstruction": "Aapko turant hospital jaana hai. 108 pe call karein.",
    "urgency": "EMERGENCY",
    "facility": "Pune District Hospital (CHC)",
    "facilityType": "CHC",
    "followUpPlan": {"nextVisitDays": 1, "monitorFor": ["BP", "headache", "edema"]},
    "firstResponseActions": ["Call 108", "Place in left lateral position"],
})


def _mock_anthropic_response(text: str):
    """Build a mock Anthropic Message response."""
    msg = MagicMock()
    block = MagicMock()
    block.text = text
    msg.content = [block]
    msg.usage = MagicMock(input_tokens=100, output_tokens=50, cache_read_input_tokens=0)
    return msg


@pytest.mark.asyncio
async def test_asr_endpoint():
    """Test ASR endpoint with mocked transcription."""
    with patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}, clear=False), \
         patch("app.routers.asr.transcribe_audio", new_callable=AsyncMock) as mock_asr:
        mock_asr.return_value = "Patient ko sir mein dard hai. BP 165 over 110."
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.post(
                "/api/asr/transcribe",
                data={
                    "language_code": "hi",
                    "consent_json": json.dumps(CONSENT_SNAPSHOT),
                },
                files={"audio_file": ("test.m4a", b"fake audio bytes", "audio/mp4")},
            )
        assert response.status_code == 200
        data = response.json()
        assert "transcript" in data
        assert data["language_code"] == "hi"


@pytest.mark.asyncio
async def test_extract_endpoint():
    """Test extraction endpoint with mocked Claude Haiku."""
    with patch("app.services.extraction_service._get_client") as mock_get:
        client_mock = AsyncMock()
        client_mock.messages.create = AsyncMock(
            return_value=_mock_anthropic_response(MOCK_EXTRACTION_JSON)
        )
        mock_get.return_value = client_mock

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.post(
                "/api/extract",
                json={
                    "transcriptText": "Patient ko sir mein dard hai. BP 165 over 110. Sujan hai.",
                    "languageCode": "hi",
                    "consent": CONSENT_SNAPSHOT,
                    "patientProfile": {
                        "isPregnant": True,
                        "gestationalWeekIfPregnant": 36,
                    },
                },
            )
        assert response.status_code == 200
        data = response.json()
        assert data["visitType"] == "ANC"
        assert data["riskLevel"] in ("HIGH", "CRITICAL")
        assert data["vitals"]["systolicBP"] == 165


@pytest.mark.asyncio
async def test_risk_endpoint():
    """Test risk scoring endpoint."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.post(
            "/api/risk/score",
            json={
                "vitals": {
                    "bloodPressureSystolic": 165,
                    "bloodPressureDiastolic": 110,
                },
                "patient": {
                    "isPregnant": True,
                    "gestationalWeek": 36,
                    "ageYears": 26,
                },
                "consent": CONSENT_SNAPSHOT,
            },
        )
    assert response.status_code == 200
    data = response.json()
    assert data["level"] == "CRITICAL"
    assert len(data["flags"]) > 0


@pytest.mark.asyncio
async def test_referral_template_routing():
    """Test that LOW risk gets template referral (no Sonnet call)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.post(
            "/api/referral/generate",
            json={
                "extraction": {
                    "visitType": "ANC",
                    "riskLevel": "LOW",
                    "riskScore": 0.1,
                    "riskFlags": [],
                    "patientInstruction": "Sab theek hai.",
                },
                "languageCode": "hi",
            },
        )
    assert response.status_code == 200
    data = response.json()
    assert data["urgency"] == "ROUTINE"
    assert "referralText" in data


@pytest.mark.asyncio
async def test_consent_endpoint():
    """Test consent record endpoint."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.post(
            "/api/consent/record",
            json=CONSENT_SNAPSHOT,
        )
    assert response.status_code == 200
    data = response.json()
    assert "receiptHash" in data


@pytest.mark.asyncio
async def test_health_endpoint():
    """Test health check endpoint."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/health/")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_demo_login():
    """Test demo login returns JWT."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.post("/api/auth/demo-login")
    assert response.status_code == 200
    data = response.json()
    assert "token" in data
    assert data["user"]["name"] == "Rekha Sharma"
