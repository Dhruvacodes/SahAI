"""Automatic speech recognition services for Sahai audio notes."""

import io
import os

from dotenv import load_dotenv
from openai import APIStatusError, AsyncOpenAI, OpenAIError

load_dotenv()


class ASRTranscriptionError(Exception):
    """Raised when audio transcription fails through the ASR provider."""

    def __init__(self, message: str, status_code: int) -> None:
        """Initialize an ASR transcription error with a display message and status code."""
        super().__init__(message)
        self.message = message
        self.status_code = status_code


async def transcribe_audio(audio_bytes: bytes, language_code: str) -> str:
    """Transcribe audio bytes with OpenAI Whisper.

    Args:
        audio_bytes: Raw audio bytes from a temporary `.m4a` recording.
        language_code: ISO language code used to guide transcription.

    Returns:
        Transcript text returned by the Whisper API.

    Raises:
        ASRTranscriptionError: Raised when configuration is missing or OpenAI returns an error.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ASRTranscriptionError("OPENAI_API_KEY is not configured.", 500)

    audio_file = io.BytesIO(audio_bytes)
    audio_file.name = "recording.m4a"
    client = AsyncOpenAI(api_key=api_key)

    try:
        transcript = await client.audio.transcriptions.create(
            file=audio_file,
            model="whisper-1",
            language=language_code,
            response_format="text",
        )
        return str(transcript)
    except APIStatusError as exc:
        raise ASRTranscriptionError(str(exc), exc.status_code) from exc
    except OpenAIError as exc:
        raise ASRTranscriptionError(str(exc), 502) from exc


def transcribe_audio_offline_stub(audio_bytes: bytes) -> str:
    """Return a fixed ASR transcript for offline demos and tests.

    Args:
        audio_bytes: Raw audio bytes accepted for interface compatibility.

    Returns:
        A representative Hindi health visit transcript.
    """
    _ = audio_bytes
    return "Rogi ka BP 150/95 hai. Pair mein sujan hai. Pet mein dard ho raha hai 3 din se."

