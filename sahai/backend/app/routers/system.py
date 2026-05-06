"""System capability routes for clients and demo preparation."""

from __future__ import annotations

from fastapi import APIRouter

from app.services.language_policy import supported_language_payload
from app.services.model_policy import estimate_claude_cost_usd, selected_claude_model

router = APIRouter(tags=["system"])


@router.get("/system/capabilities")
async def get_system_capabilities() -> dict:
    """Return language, privacy, model, and cost capabilities."""
    extraction_model = selected_claude_model("extraction")
    referral_model = selected_claude_model("referral")
    extraction_estimate = estimate_claude_cost_usd(1600, 450, extraction_model.model_id)
    referral_estimate = estimate_claude_cost_usd(1200, 650, referral_model.model_id)
    return {
        "supportedIndianLanguageCount": 22,
        "supportedLanguages": supported_language_payload(),
        "sameLanguageReadback": True,
        "consentRequired": True,
        "privacyPosture": {
            "dataMinimization": True,
            "explicitConsentBeforeAi": True,
            "withdrawalSupportedInDesign": True,
            "storesRawAudioByDefault": False,
            "dpdpSections": ["§6", "§8", "§11"],
        },
        "promptInjectionPosture": {
            "transcriptTreatedAsUntrustedData": True,
            "structuredJsonOnly": True,
            "deterministicRiskRulesOutsideModel": True,
            "plausibilityValidation": True,
            "adversarialTestSuite": "15 cases",
        },
        "aiModels": {
            "extraction": {
                "provider": "Anthropic",
                "modelId": extraction_model.model_id,
                "label": extraction_model.label,
                "rationale": extraction_model.rationale,
                "promptCaching": True,
            },
            "referral": {
                "provider": "Anthropic",
                "modelId": referral_model.model_id,
                "label": referral_model.label,
                "rationale": referral_model.rationale,
                "onlyForHighCritical": True,
            },
            "stt": {
                "primary": "Sarvam Saaras v3",
                "fallback": "OpenAI Whisper-1",
            },
            "tts": {
                "primary": "expo-speech (device, free)",
                "premium": "Sarvam Bulbul v2",
            },
        },
        "costStrategy": {
            "templateReferralsForLowModerate": True,
            "llmReferralsForHighCritical": True,
            "blendedTargetPerVisitINR": 1.50,
            "extractionEstimateUSD": extraction_estimate,
            "referralEstimateUSD": referral_estimate,
        },
    }
