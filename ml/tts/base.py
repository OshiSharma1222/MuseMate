"""Common interface every TTS backend implements."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass

import numpy as np


@dataclass
class SynthesisResult:
    audio: np.ndarray  # mono float32 PCM in [-1, 1]
    sample_rate: int


class Synthesizer(ABC):
    @abstractmethod
    def supports(self, lang: str) -> bool:
        """Whether this backend has a voice for the given language code."""
        raise NotImplementedError

    @abstractmethod
    def synthesize(self, text: str, lang: str) -> SynthesisResult:
        raise NotImplementedError
