# backend/app/services/sarvam_service.py

from __future__ import annotations
"""Sarvam AI integration: Saaras v3 STT + Bulbul v2 TTS.
Reference: https://docs.sarvam.ai
"""
import os
import asyncio
from typing import Optional
from sarvamai import SarvamAI

_client: Optional[SarvamAI] = None

def _get_client() -> SarvamAI:
    global _client
    if _client is None:
        key = os.getenv("SARVAM_API_KEY")
        if not key:
            raise RuntimeError("SARVAM_API_KEY not set")
        _client = SarvamAI(api_subscription_key=key)
    return _client


# BCP-47 language codes Sarvam Saarika expects.
# "en" and "auto" both map to "unknown" (auto-detect):
#   - saarika:v2.5 with "en-IN" outputs Devanagari transliteration for
#     Indian-accented English instead of Latin script — bad UX.
#   - "unknown" triggers auto-detection and outputs the correct script for
#     whatever language the speaker actually used (Latin for English, native
#     scripts for Indian languages). This is the safest default for our
#     hands-free demographics flow where the worker may speak any language.
LANG_TO_SARVAM = {
    "hi": "hi-IN", "bn": "bn-IN", "ta": "ta-IN", "te": "te-IN",
    "mr": "mr-IN", "gu": "gu-IN", "kn": "kn-IN", "ml": "ml-IN",
    "pa": "pa-IN", "ur": "ur-IN", "or": "od-IN",
    "en": "unknown",
    "auto": "unknown",
    "unknown": "unknown",
}


async def transcribe_with_sarvam(
    audio_path: str,
    language_code: str,
    domain_prompt: Optional[str] = None,  # kept for API compatibility; Saarika SDK doesn't support prompt
) -> dict:
    """Transcribe with Saarika v2.5. Returns {transcript, language_code, provider}.

    SDK signature (sarvamai 0.1.x):
        transcribe(*, file, model, language_code, request_options)
    `file` accepts a file-like object, bytes, or a (name, data) tuple.
    """
    client = _get_client()
    sarvam_lang = LANG_TO_SARVAM.get(
        language_code,
        language_code if "-" in language_code else f"{language_code}-IN",
    )

    def _sync_call():
        with open(audio_path, "rb") as f:
            return client.speech_to_text.transcribe(
                file=f,
                language_code=sarvam_lang,
                model="saarika:v2.5",
            )

    response = await asyncio.to_thread(_sync_call)
    return {
        "transcript": response.transcript,
        "language_code": language_code,
        "provider": "sarvam",
        "model": "saarika:v2.5",
        "audio_seconds": getattr(response, "duration_seconds", 0.0),
    }


async def synthesize_with_bulbul(
    text: str,
    language_code: str,
    speaker: str = "anushka",  # default Indian female voice
) -> bytes:
    """Generate TTS audio. Returns MP3 bytes.
    
    Note: For mobile, prefer expo-speech (device TTS, free) for routine readback.
    Use Bulbul only when premium voice quality is required.
    """
    client = _get_client()
    sarvam_lang = LANG_TO_SARVAM.get(language_code, f"{language_code}-IN")
    
    def _sync_call():
        return client.text_to_speech.convert(
            text=text,
            target_language_code=sarvam_lang,
            model="bulbul:v2",
            speaker=speaker,
            speech_sample_rate=22050,
            output_audio_codec="mp3",
        )
    
    response = await asyncio.to_thread(_sync_call)
    return response.audios[0]  # bytes
