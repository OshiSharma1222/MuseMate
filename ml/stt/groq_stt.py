"""Groq cloud STT client.

Uses Groq's insanely fast whisper-large-v3 implementation.
"""

from __future__ import annotations

import io
import os
import time

import numpy as np
import soundfile as sf

from .base import Transcriber, TranscriptionResult


class GroqSTT(Transcriber):
    def __init__(
        self,
        api_key: str | None = None,
        model: str = "whisper-large-v3",
    ) -> None:
        self.api_key = api_key or os.environ.get("GROQ_API_KEY", "")
        self.model = model
        if not self.api_key:
            raise RuntimeError(
                "GROQ_API_KEY is not set. Get a free key at https://console.groq.com"
            )

    def transcribe(
        self,
        audio: np.ndarray,
        sample_rate: int,
        language_hint: str | None = None,
    ) -> TranscriptionResult:
        from groq import Groq  # noqa: PLC0415
        client = Groq(api_key=self.api_key)

        buf = io.BytesIO()
        sf.write(buf, audio, sample_rate, format="WAV")
        buf.seek(0)
        file_bytes = buf.read()

        kwargs: dict = {
            "file": ("clip.wav", file_bytes),
            "model": self.model,
            "response_format": "json",
        }
        if language_hint:
            kwargs["language"] = language_hint

        start = time.monotonic()
        transcription = client.audio.transcriptions.create(**kwargs)
        duration = time.monotonic() - start

        text = getattr(transcription, "text", "")
        return TranscriptionResult(
            text=text.strip(),
            language=language_hint or "en",
            duration_sec=duration,
        )
