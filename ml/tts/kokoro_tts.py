"""Kokoro TTS backend.

Lightweight, extremely high-quality local TTS model.
Requires: pip install kokoro>=0.9.4 soundfile
"""

from __future__ import annotations

import warnings
import numpy as np

from .base import Synthesizer, SynthesisResult

# Suppress harmless PyTorch warnings from Kokoro's internal model layers
warnings.filterwarnings("ignore", category=UserWarning, module="torch.nn.modules.rnn")
warnings.filterwarnings("ignore", category=FutureWarning, module="torch.nn.utils.weight_norm")
warnings.filterwarnings("ignore", category=FutureWarning, module="torch.jit._script")

class KokoroTTS(Synthesizer):
    def __init__(self, lang_code: str = "a", voice: str = "af_heart"):
        try:
            from kokoro import KPipeline
        except ImportError:
            raise RuntimeError("Please install kokoro: pip install kokoro>=0.9.4 soundfile")
        
        self.pipeline = KPipeline(lang_code=lang_code)
        self.voice = voice

    def supports(self, lang: str) -> bool:
        # Kokoro mainly supports English (en-US 'a', en-GB 'b') for now, plus some experimental languages.
        # We'll claim 'en' support.
        return lang.startswith("en")

    def synthesize(self, text: str, lang: str, mode: str = "default") -> SynthesisResult:
        generator = self.pipeline(text, voice=self.voice, speed=1)
        audio_chunks = []
        sample_rate = 24000
        
        for i, (gs, ps, audio) in enumerate(generator):
            if audio is not None and len(audio) > 0:
                audio_chunks.append(audio)
        
        if not audio_chunks:
            return SynthesisResult(audio=np.zeros(0, dtype=np.float32), sample_rate=sample_rate)
            
        full_audio = np.concatenate(audio_chunks).astype(np.float32)
        return SynthesisResult(audio=full_audio, sample_rate=sample_rate)
