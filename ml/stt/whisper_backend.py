"""faster-whisper backend (default STT engine).

Model size is configurable; "medium" is the recommended default from the
implementation plan (good multilingual accuracy on CPU, no GPU required).
Swap in an AI4Bharat IndicWhisper CTranslate2 checkpoint later by pointing
`model_size_or_path` at that checkpoint's directory -- the rest of the
backend does not need to change since it only talks to `Transcriber`.
"""

from __future__ import annotations

import time

import numpy as np

from .base import Transcriber, TranscriptionResult

try:
    from faster_whisper import WhisperModel
except ImportError:  # pragma: no cover - only needed once dependency is installed
    WhisperModel = None  # type: ignore[assignment]

# Whisper's own language codes line up 1:1 with the dashboard's Lang union
# (hi, en, ta, bn, mr, te, kn, ml, gu, de, fr), so no translation table is needed.
SUPPORTED_LANGS = {"hi", "en", "ta", "bn", "mr", "te", "kn", "ml", "gu", "de", "fr"}


class WhisperSTT(Transcriber):
    def __init__(
        self,
        model_size_or_path: str = "medium",
        device: str = "auto",
        compute_type: str = "int8",
    ) -> None:
        if WhisperModel is None:
            raise RuntimeError(
                "faster-whisper is not installed. Run: pip install -r ml/requirements.txt"
            )
        self._model = WhisperModel(model_size_or_path, device=device, compute_type=compute_type)

    def transcribe(
        self,
        audio: np.ndarray,
        sample_rate: int,
        language_hint: str | None = None,
    ) -> TranscriptionResult:
        if sample_rate != 16000:
            audio = _resample_to_16k(audio, sample_rate)

        started = time.monotonic()
        lang = language_hint if language_hint in SUPPORTED_LANGS else None
        segments, info = self._model.transcribe(
            audio,
            language=lang,
            vad_filter=True,
            vad_parameters={"min_silence_duration_ms": 400},
        )
        text = " ".join(seg.text.strip() for seg in segments).strip()
        duration = time.monotonic() - started
        detected_lang = lang or getattr(info, "language", "en") or "en"
        return TranscriptionResult(text=text, language=detected_lang, duration_sec=duration)


def _resample_to_16k(audio: np.ndarray, sample_rate: int) -> np.ndarray:
    """Linear-interpolation resample; good enough for speech, avoids a scipy dependency."""
    if sample_rate == 16000:
        return audio
    duration = len(audio) / sample_rate
    target_len = int(duration * 16000)
    x_old = np.linspace(0, duration, num=len(audio), endpoint=False)
    x_new = np.linspace(0, duration, num=target_len, endpoint=False)
    return np.interp(x_new, x_old, audio).astype(np.float32)
