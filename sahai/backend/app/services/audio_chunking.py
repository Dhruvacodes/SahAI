"""Split a WAV file into ≤ ``chunk_seconds`` clips for chunked transcription.

Sarvam's Saarika v2.5 ``transcribe()`` endpoint rejects audio longer than
~30 seconds with HTTP 422. Visit recordings frequently exceed that, so we
split the file on the backend and concatenate the resulting transcripts.

The mobile recorder writes 16 kHz mono 16-bit PCM WAV (see
``apps/mobile/src/voice/recorder.ts``), which Python's stdlib ``wave``
module reads natively — no third-party dependency needed. If the file is
not a readable WAV (e.g. Android's DEFAULT codec produced 3GP/AMR), we
return ``[audio_path]`` unchanged so the caller still attempts a single
upload and gets a clear Sarvam-side error.
"""

from __future__ import annotations

import logging
import os
import tempfile
import wave
from typing import List, Tuple

log = logging.getLogger(__name__)

# Default chunk duration. 25 s gives a comfortable margin under Sarvam's 30 s
# cap, and short enough that a network blip on one chunk does not torpedo the
# whole transcription.
DEFAULT_CHUNK_SECONDS = 25
# Audio shorter than this never gets split.
MIN_SPLIT_SECONDS = 27


def probe_wav_duration_seconds(path: str) -> float | None:
    """Return WAV duration in seconds, or ``None`` if the file is not a WAV."""
    try:
        with wave.open(path, "rb") as wf:
            frames = wf.getnframes()
            rate = wf.getframerate() or 1
            return frames / float(rate)
    except (wave.Error, EOFError, FileNotFoundError):
        return None


def split_wav_to_chunks(
    audio_path: str,
    chunk_seconds: int = DEFAULT_CHUNK_SECONDS,
) -> Tuple[List[str], bool]:
    """Split ``audio_path`` into temp WAV files of at most ``chunk_seconds``.

    Returns ``(chunks, did_split)``:
        * ``chunks`` is a list of file paths to transcribe in order.
        * ``did_split`` is True when we actually wrote new temp files; the
          caller is responsible for ``os.unlink``ing those.
    """
    duration = probe_wav_duration_seconds(audio_path)
    if duration is None:
        # Not a WAV (or unreadable). Hand the file to Sarvam unmodified —
        # whatever error we get will be surfaced as-is to the caller.
        log.info("audio_chunking: not a WAV, skipping split for %s", audio_path)
        return [audio_path], False

    if duration <= MIN_SPLIT_SECONDS:
        return [audio_path], False

    chunks: List[str] = []
    try:
        with wave.open(audio_path, "rb") as wf:
            n_channels = wf.getnchannels()
            sampwidth = wf.getsampwidth()
            framerate = wf.getframerate()
            chunk_frames = int(chunk_seconds * framerate)
            total_frames = wf.getnframes()
            written = 0
            while written < total_frames:
                remaining = total_frames - written
                this_chunk = min(chunk_frames, remaining)
                frames = wf.readframes(this_chunk)
                with tempfile.NamedTemporaryFile(
                    suffix=".wav", delete=False
                ) as out:
                    out_path = out.name
                with wave.open(out_path, "wb") as out_wf:
                    out_wf.setnchannels(n_channels)
                    out_wf.setsampwidth(sampwidth)
                    out_wf.setframerate(framerate)
                    out_wf.writeframes(frames)
                chunks.append(out_path)
                written += this_chunk
    except wave.Error as exc:
        log.warning("audio_chunking: wave error %s; falling back to single upload", exc)
        # Best-effort cleanup of any temp files we already wrote.
        for path in chunks:
            try:
                os.unlink(path)
            except OSError:
                pass
        return [audio_path], False

    log.info(
        "audio_chunking: split %.1fs WAV into %d chunks of <= %ss",
        duration,
        len(chunks),
        chunk_seconds,
    )
    return chunks, True
