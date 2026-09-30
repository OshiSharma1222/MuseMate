"""Plays synthesized audio out of the default speaker."""

from __future__ import annotations

import numpy as np

try:
    import sounddevice as sd
except ImportError:  # pragma: no cover
    sd = None  # type: ignore[assignment]


def play(audio: np.ndarray, sample_rate: int, block: bool = True) -> None:
    if sd is None:
        raise RuntimeError("sounddevice is not installed. Run: pip install -r ml/requirements.txt")
    sd.play(audio, sample_rate)
    if block:
        sd.wait()
