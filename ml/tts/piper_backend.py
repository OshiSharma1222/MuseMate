"""Piper TTS backend -- fallback for languages Indic Parler-TTS doesn't cover
(French, German), and a very low-latency option for English if needed.

Piper ships per-language/per-voice ONNX models that must be downloaded
separately (see https://github.com/rhasspy/piper/blob/master/VOICES.md), e.g.:
    fr_FR-siwis-medium.onnx (+ .onnx.json)
    de_DE-thorsten-medium.onnx (+ .onnx.json)

Point `voice_models` at wherever you saved them. Uses the `piper` CLI binary
(installed by the `piper-tts` pip package) via subprocess, which is the most
stable interface across Piper versions.
"""

from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf

from .base import Synthesizer, SynthesisResult


class PiperTTS(Synthesizer):
    def __init__(self, voice_models: dict[str, str], piper_bin: str = "piper") -> None:
        """`voice_models` maps a Lang code (e.g. "fr", "de") to a local .onnx model path."""
        self.voice_models = {lang: Path(p) for lang, p in voice_models.items()}
        self.piper_bin = piper_bin
        if shutil.which(piper_bin) is None:
            raise RuntimeError(
                f"Piper binary '{piper_bin}' not found on PATH. Install with: pip install piper-tts"
            )

    def supports(self, lang: str) -> bool:
        return lang in self.voice_models and self.voice_models[lang].exists()

    def synthesize(self, text: str, lang: str) -> SynthesisResult:
        model_path = self.voice_models.get(lang)
        if model_path is None or not model_path.exists():
            raise ValueError(f"No Piper voice configured for language '{lang}'")

        with tempfile.TemporaryDirectory() as tmp:
            out_path = Path(tmp) / "out.wav"
            subprocess.run(
                [self.piper_bin, "--model", str(model_path), "--output_file", str(out_path)],
                input=text.encode("utf-8"),
                check=True,
                capture_output=True,
            )
            audio, sample_rate = sf.read(str(out_path), dtype="float32")
        if audio.ndim > 1:
            audio = audio.mean(axis=1)
        return SynthesisResult(audio=audio.astype(np.float32), sample_rate=sample_rate)
