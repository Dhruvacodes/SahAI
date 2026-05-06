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
from app.services.audio_chunking import (
    DEFAULT_CHUNK_SECONDS,
    probe_wav_duration_seconds,
    split_wav_to_chunks,
)
from app.services.sarvam_service import (
    SarvamTranscriptionError,
    transcribe_with_sarvam,
)

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

    Long WAVs (>30 s) exceed Sarvam Saarika's per-call cap, so we split
    them into 25-second chunks and concatenate the partial transcripts.
    Returns ``{transcript, language_code, provider, model, audio_seconds}``.
    """
    sarvam_error: str | None = None

    # PRIMARY: Sarvam (with on-the-fly chunking for long recordings).
    if os.getenv("SARVAM_API_KEY"):
        try:
            return await _transcribe_with_sarvam_chunked(audio_path, language_code)
        except Exception as e:
            sarvam_error = str(e)
            log.warning("Sarvam STT failed, falling back to Whisper: %s", e)

    # FALLBACK: Whisper
    if not os.getenv("OPENAI_API_KEY"):
        if sarvam_error:
            raise ASRTranscriptionError(
                f"Sarvam transcription failed ({sarvam_error[:240]}) and OPENAI_API_KEY is not set."
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


async def _transcribe_with_sarvam_chunked(
    audio_path: str,
    language_code: str,
) -> dict:
    """Run Sarvam against ``audio_path``, splitting long WAVs as needed."""
    chunk_paths, did_split = split_wav_to_chunks(
        audio_path, chunk_seconds=DEFAULT_CHUNK_SECONDS
    )
    try:
        if not did_split and len(chunk_paths) == 1:
            return await transcribe_with_sarvam(
                chunk_paths[0], language_code, ASHA_DOMAIN_PROMPT
            )

        log.info(
            "ASR: chunked transcribe — %d chunks for %s",
            len(chunk_paths),
            audio_path,
        )
        transcripts: list[str] = []
        for idx, chunk_path in enumerate(chunk_paths):
            try:
                result = await transcribe_with_sarvam(
                    chunk_path, language_code, ASHA_DOMAIN_PROMPT
                )
            except SarvamTranscriptionError as exc:
                # One bad chunk should not lose the rest of the visit.
                log.warning(
                    "ASR: chunk %d/%d failed: %s",
                    idx + 1,
                    len(chunk_paths),
                    exc.message,
                )
                continue
            piece = (result.get("transcript") or "").strip()
            if piece:
                transcripts.append(piece)

        if not transcripts:
            # Every chunk failed — surface the most useful error we have.
            raise SarvamTranscriptionError(
                message="all audio chunks failed to transcribe",
                status_code=422,
                body=None,
            )

        joined = " ".join(transcripts)
        duration = probe_wav_duration_seconds(audio_path) or 0.0
        return {
            "transcript": joined,
            "language_code": language_code,
            "provider": "sarvam",
            "model": "saarika:v2.5",
            "audio_seconds": duration,
        }
    finally:
        if did_split:
            for path in chunk_paths:
                try:
                    os.unlink(path)
                except OSError:
                    pass


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
