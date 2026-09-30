"""Picks the right backend for a given language.

Indic Parler-TTS handles the 8 Indian languages + English; Piper (optional)
covers French/German. Construct once at app startup and reuse.
"""

from __future__ import annotations

from .base import Synthesizer, SynthesisResult


class MultilingualTTS:
    def __init__(self, backends: list[Synthesizer]) -> None:
        if not backends:
            raise ValueError("MultilingualTTS needs at least one backend")
        self.backends = backends

    def synthesize(self, text: str, lang: str, mode: str = "default") -> SynthesisResult:
        for backend in self.backends:
            if backend.supports(lang):
                try:
                    return backend.synthesize(text, lang, mode=mode)  # type: ignore[call-arg]
                except TypeError:
                    return backend.synthesize(text, lang)
        raise ValueError(
            f"No configured TTS backend supports language '{lang}'. "
            "Add a Piper voice model for it or fall back to English."
        )

    def supports(self, lang: str) -> bool:
        return any(b.supports(lang) for b in self.backends)
