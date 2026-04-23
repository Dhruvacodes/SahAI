"""ASR API routes for transcribing uploaded audio files."""

import time

from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import JSONResponse

from app.services.asr_service import ASRTranscriptionError, transcribe_audio

SUPPORTED_LANGUAGE_CODES = {"hi", "ta", "bn", "kn", "te", "mr", "gu", "or"}

router = APIRouter(tags=["asr"])


@router.post("/transcribe")
async def transcribe_uploaded_audio(
    audio_file: UploadFile | None = File(None),
    language_code: str | None = Form(None),
) -> dict[str, object]:
    """Transcribe an uploaded audio file using the selected ASR language.

    Args:
        audio_file: Uploaded audio file sent as multipart form data.
        language_code: ISO language code used to guide transcription.

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

    if language_code not in SUPPORTED_LANGUAGE_CODES:
        return JSONResponse(
            status_code=400,
            content={"error": f"Unsupported language_code: {language_code}"},
        )

    audio_bytes = await audio_file.read()
    if not audio_bytes:
        return JSONResponse(
            status_code=400,
            content={"error": "audio_file must not be empty."},
        )

    started_at = time.perf_counter()
    try:
        transcript = await transcribe_audio(audio_bytes, language_code)
    except ASRTranscriptionError as exc:
        return JSONResponse(status_code=422, content={"error": exc.message})

    duration_ms = int((time.perf_counter() - started_at) * 1000)
    return {
        "transcript": transcript,
        "language_code": language_code,
        "duration_ms": duration_ms,
    }
