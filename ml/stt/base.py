"""Common interface every STT backend implements.

Keeping this tiny means `backend/` can depend on `Transcriber` without caring
whether the concrete engine is faster-whisper, IndicWhisper or Vosk.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass

import numpy as np


@dataclass
class TranscriptionResult:
    text: str
    language: str  # ISO-639-1 code detected or forced, e.g. "hi"
    duration_sec: float


class Transcriber(ABC):
    @abstractmethod
    def transcribe(
        self,
        audio: np.ndarray,
        sample_rate: int,
        language_hint: str | None = None,
    ) -> TranscriptionResult:
        """`audio` is mono float32 PCM in [-1, 1]. `language_hint` forces decoding
        in that language when the visitor's session already has one set;
        pass None to let the model auto-detect (first utterance of a session).
        """
        raise NotImplementedError
