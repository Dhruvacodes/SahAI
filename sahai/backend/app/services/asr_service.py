# backend/app/services/asr_service.py

from __future__ import annotations
"""ASR with provider fallback chain: Sarvam → Whisper.
Sarvam is preferred for Indian languages; Whisper is fallback only.
"""
import os
import io
import tempfile
import logging
from typing import Optional
from openai import AsyncOpenAI, APIStatusError, OpenAIError
from app.services.sarvam_service import transcribe_with_sarvam

log = logging.getLogger(__name__)

ASHA_DOMAIN_PROMPT = (
    "Visit by ASHA community health worker in rural India. "
    "Mentions of: blood pressure (BP), pulse, oxygen (SpO2), temperature, "
    "weight, haemoglobin, gestational week, fetal movement, MUAC, "
    "headache, edema, swelling, fever, bleeding, diarrhea. "
    "Numbers in Hindi-English code-mixed format common."
)


class ASRTranscriptionError(Exception):
    """Raised when audio transcription fails through the ASR provider."""

    def __init__(self, message: str, status_code: int = 500) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


_openai_client: Optional[AsyncOpenAI] = None
def _get_openai() -> AsyncOpenAI:
    global _openai_client
    if _openai_client is None:
        _openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    return _openai_client


async def transcribe_audio_from_path(audio_path: str, language_code: str) -> dict:
    """Transcribe with Sarvam first; fall back to Whisper on failure.
    Returns {transcript, language_code, provider, model, audio_seconds}.
    """
    sarvam_error: str | None = None

    # PRIMARY: Sarvam
    if os.getenv("SARVAM_API_KEY"):
        try:
            return await transcribe_with_sarvam(audio_path, language_code, ASHA_DOMAIN_PROMPT)
        except Exception as e:
            sarvam_error = str(e)
            log.warning("Sarvam STT failed, falling back to Whisper: %s", e)

    # FALLBACK: Whisper
    if not os.getenv("OPENAI_API_KEY"):
        if sarvam_error:
            raise ASRTranscriptionError(
                f"Sarvam transcription failed ({sarvam_error[:200]}) and OPENAI_API_KEY is not set."
            )
        raise ASRTranscriptionError(
            "No STT provider available: set SARVAM_API_KEY or OPENAI_API_KEY in .env"
        )
    
    client = _get_openai()
    with open(audio_path, "rb") as f:
        response = await client.audio.transcriptions.create(
            model="whisper-1",
            file=f,
            language=language_code,
        )
    
    # Whisper doesn't return duration directly; estimate from file size at 32kbps
    file_size_bytes = os.path.getsize(audio_path)
    estimated_seconds = file_size_bytes / 4000  # 32kbps mono ≈ 4 KB/s
    
    return {
        "transcript": response.text,
        "language_code": language_code,
        "provider": "openai",
        "model": "whisper-1",
        "audio_seconds": estimated_seconds,
    }


async def transcribe_audio(audio_bytes: bytes, language_code: str) -> str:
    """Legacy compatibility: accepts bytes, returns transcript string.
    Writes to temp file for Sarvam → Whisper chain.
    """
    # Write bytes to temp file for the path-based API
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        result = await transcribe_audio_from_path(tmp_path, language_code)
        return result["transcript"]
    except ASRTranscriptionError:
        raise
    except Exception as e:
        raise ASRTranscriptionError(str(e), 502)
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def transcribe_audio_offline_stub(audio_bytes: bytes = b"", language_code: str = "hi") -> dict:
    """Test-only stub for tests that don't want to hit real APIs."""
    return {
        "transcript": "[OFFLINE STUB] Patient appears stable. BP 120 over 80. No complaints.",
        "language_code": language_code,
        "provider": "stub",
        "model": "stub",
        "audio_seconds": 5.0,
    }
