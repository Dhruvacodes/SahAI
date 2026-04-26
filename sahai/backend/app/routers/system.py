"""System capability routes for clients and demo preparation."""

from fastapi import APIRouter

from app.services.language_policy import supported_language_payload
from app.services.model_policy import estimate_claude_cost_usd, selected_claude_model

router = APIRouter(tags=["system"])


@router.get("/system/capabilities")
async def get_system_capabilities() -> dict:
    """Return language, privacy, model, and cost capabilities."""
    model = selected_claude_model()
    extraction_estimate = estimate_claude_cost_usd(1600, 450, model.model_id)
    referral_estimate = estimate_claude_cost_usd(1200, 650, model.model_id)
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
        },
        "promptInjectionPosture": {
            "transcriptTreatedAsUntrustedData": True,
            "structuredJsonOnly": True,
            "deterministicRiskRulesOutsideModel": True,
        },
        "aiModel": {
            "provider": "Anthropic",
            "modelId": model.model_id,
            "label": model.label,
            "rationale": model.rationale,
            "inputUsdPerMillionTokens": model.input_usd_per_mtok,
            "outputUsdPerMillionTokens": model.output_usd_per_mtok,
        },
        "estimatedCostUsd": {
            "extractionPerInference": extraction_estimate,
            "referralPerInference": referral_estimate,
            "combinedVisit": round(extraction_estimate + referral_estimate, 6),
        },
    }
