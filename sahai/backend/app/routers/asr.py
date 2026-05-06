"""ASR API routes for transcribing uploaded audio files."""

from __future__ import annotations

from typing import Dict, Optional

import json
import time

from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import JSONResponse

from app.schemas.privacy import ConsentSnapshot
from app.services.consent_service import ConsentValidationError, validate_consent
from app.services.asr_service import ASRTranscriptionError, transcribe_audio, transcribe_audio_from_path
from app.services.language_policy import (
    PSEUDO_LANGUAGE_CODES,
    SUPPORTED_LANGUAGE_BY_CODE,
    normalize_language_code,
)

# Pseudo codes ("auto", "en") are first-class — Sarvam runs auto-detect for them.
SUPPORTED_LANGUAGE_CODES = set(SUPPORTED_LANGUAGE_BY_CODE) | PSEUDO_LANGUAGE_CODES

router = APIRouter(tags=["asr"])


@router.post("/transcribe")
async def transcribe_uploaded_audio(
    audio_file: Optional[UploadFile] = File(None),
    language_code: Optional[str] = Form(None),
    consent_json: Optional[str] = Form(None),
) -> Dict[str, object]:
    """Transcribe an uploaded audio file using the selected ASR language.

    Args:
        audio_file: Uploaded audio file sent as multipart form data.
        language_code: ISO language code used to guide transcription.
        consent_json: Consent snapshot serialized as JSON.

    Returns:
        A transcript response with language code and processing duration, or an error response.
    """
    # TODO: add slowapi limiter in production.
    if audio_file is None:
        return JSONResponse(
            status_code=400,
            content={"error": "audio_file is required."},
        )

    if language_code is None:
        return JSONResponse(
            status_code=400,
            content={"error": "language_code is required."},
        )

    normalized_language_code = normalize_language_code(language_code)
    if normalized_language_code not in SUPPORTED_LANGUAGE_CODES:
        return JSONResponse(
            status_code=400,
            content={"error": f"Unsupported language_code: {language_code}"},
        )

    if consent_json is None:
        return JSONResponse(
            status_code=403,
            content={"error": "Patient consent is required before transcription."},
        )

    try:
        consent = _parse_consent_json(consent_json)
        validate_consent(_model_to_dict(consent), "transcription")
    except (ConsentValidationError, ValueError, json.JSONDecodeError) as exc:
        return JSONResponse(status_code=403, content={"error": str(exc)})

    audio_bytes = await audio_file.read()
    if not audio_bytes:
        return JSONResponse(
            status_code=400,
            content={"error": "audio_file must not be empty."},
        )

    import tempfile
    import os
    started_at = time.perf_counter()
    try:
        # Write to temp file so sarvam_service can use file-path API
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name
        try:
            result = await transcribe_audio_from_path(tmp_path, normalized_language_code)
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
    except ASRTranscriptionError as exc:
        return JSONResponse(status_code=422, content={"error": exc.message})

    duration_ms = int((time.perf_counter() - started_at) * 1000)
    # Return both `transcriptText` (mobile contract) and `transcript` (legacy) so either client works.
    return {
        "transcriptText": result["transcript"],
        "transcript": result["transcript"],
        "language_code": normalized_language_code,
        "provider": result.get("provider", "sarvam"),
        "model": result.get("model", "saaras:v3"),
        "duration_ms": duration_ms,
    }


def _parse_consent_json(consent_json: str) -> ConsentSnapshot:
    """Parse consent JSON across Pydantic versions."""
    if hasattr(ConsentSnapshot, "model_validate_json"):
        return ConsentSnapshot.model_validate_json(consent_json)

    return ConsentSnapshot.parse_raw(consent_json)


def _model_to_dict(model: ConsentSnapshot) -> dict:
    """Convert a Pydantic model to a dictionary across Pydantic versions."""
    if hasattr(model, "model_dump"):
        return model.model_dump()

    return model.dict()
