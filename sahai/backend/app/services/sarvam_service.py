# backend/app/services/sarvam_service.py

from __future__ import annotations
"""Sarvam AI integration: Saaras v3 STT + Bulbul v2 TTS.
Reference: https://docs.sarvam.ai
"""
import asyncio
import logging
import os
from typing import Optional

from sarvamai import SarvamAI

try:
    # Sarvam SDK ApiError carries (status_code, headers, body). We re-export
    # the body in our own exception so callers can show a meaningful message
    # instead of "headers: {...}" truncated to 200 chars.
    from sarvamai.core.api_error import ApiError as SarvamApiError
except Exception:  # pragma: no cover — older SDK or import quirk
    SarvamApiError = Exception  # type: ignore[misc, assignment]

log = logging.getLogger(__name__)


class SarvamTranscriptionError(Exception):
    """Sarvam transcription failure with a useful one-line summary."""

    def __init__(
        self,
        *,
        message: str,
        status_code: Optional[int] = None,
        body: Optional[object] = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.body = body


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

    try:
        response = await asyncio.to_thread(_sync_call)
    except SarvamApiError as exc:
        # Surface the Sarvam-side reason (e.g. "audio too long") instead of
        # losing it inside a stringified `headers: {...}` dump.
        body_repr = _short_body_repr(getattr(exc, "body", None))
        status = getattr(exc, "status_code", None)
        raise SarvamTranscriptionError(
            message=f"Sarvam {status or '?'}: {body_repr}",
            status_code=status,
            body=getattr(exc, "body", None),
        ) from exc

    return {
        "transcript": response.transcript,
        "language_code": language_code,
        "provider": "sarvam",
        "model": "saarika:v2.5",
        "audio_seconds": getattr(response, "duration_seconds", 0.0),
    }


def _short_body_repr(body: object) -> str:
    """One-line summary of the Sarvam error body."""
    if body is None:
        return "no body"
    if isinstance(body, dict):
        for key in ("error", "message", "detail", "details"):
            value = body.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
            if isinstance(value, dict):
                msg = value.get("message") or value.get("detail")
                if isinstance(msg, str) and msg.strip():
                    return msg.strip()
        return str(body)[:240]
    return str(body)[:240]


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
