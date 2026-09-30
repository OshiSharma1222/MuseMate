"""Moonshine STT backend.

Moonshine is a highly efficient, fast local STT model by Useful Sensors.
Requires: pip install moonshine-voice
"""

from __future__ import annotations

import os
import tempfile
import time
import numpy as np
import soundfile as sf

from .base import Transcriber, TranscriptionResult


class MoonshineSTT(Transcriber):
    def __init__(self, model_arch: str = "base"):
        try:
            from moonshine_voice import Transcriber as MoonshineTranscriber
            from moonshine_voice import get_model_for_language, get_model_path, ModelArch
        except ImportError:
            raise RuntimeError("Please install moonshine: pip install moonshine-voice")
        
        print(f"[engines] Loading/verifying Moonshine {model_arch} model...", flush=True)
        # Convert string to ModelArch enum (e.g. ModelArch.BASE)
        arch_enum = getattr(ModelArch, model_arch.upper())
        name, _ = get_model_for_language("en", arch_enum)
        model_path = get_model_path(name)
        self.transcriber = MoonshineTranscriber(model_path=str(model_path))
        print(f"[engines] Moonshine {model_arch} loaded.", flush=True)

    def transcribe(
        self,
        audio: np.ndarray,
        sample_rate: int,
        language_hint: str | None = None,
    ) -> TranscriptionResult:
        start = time.monotonic()
        
        # moonshine_voice takes a list of floats
        audio_list = audio.tolist()
        
        transcript = self.transcriber.transcribe_without_streaming(audio_list, sample_rate=sample_rate)
        text = " ".join([line.text for line in transcript.lines])
            
        duration = time.monotonic() - start
        
        return TranscriptionResult(
            text=text.strip(),
            language=language_hint or "en",
            duration_sec=duration,
        )
