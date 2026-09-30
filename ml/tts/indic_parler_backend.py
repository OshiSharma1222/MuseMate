"""AI4Bharat Indic Parler-TTS backend.

Covers hi, ta, bn, mr, te, kn, ml, gu and en with one model
(`ai4bharat/indic-parler-tts` on Hugging Face) -- exactly the Indian-language
half of the dashboard's `Lang` union plus English. German and French are not
covered by this model; use `PiperTTS` for those (see `piper_backend.py`).

Install:
    pip install git+https://github.com/huggingface/parler-tts.git
    pip install -r ml/requirements.txt

The model is pulled from the Hugging Face Hub on first use and cached locally
(no internet needed after that).
"""

from __future__ import annotations

import numpy as np

from .base import Synthesizer, SynthesisResult

SUPPORTED_LANGS = {"hi", "ta", "bn", "mr", "te", "kn", "ml", "gu", "en"}

# Voice "description" prompts control delivery (pace, pitch, mood), not language;
# language comes from the script of `text` itself. One preset per narration mode.
MODE_VOICE_DESCRIPTIONS: dict[str, str] = {
    "default": (
        "A warm, clear female voice speaks at a moderate, natural pace with "
        "good expression, as if guiding a visitor through a museum."
    ),
    "quick": (
        "A clear female voice speaks briskly and efficiently, getting straight to the point."
    ),
    "detailed": (
        "A calm, articulate female voice speaks slowly and clearly, with a thoughtful, "
        "curator-like tone, pausing naturally between ideas."
    ),
    "child": (
        "A friendly, gentle female voice speaks slowly and warmly, as if telling a "
        "story to a child, with a light, playful tone."
    ),
}


class IndicParlerTTS(Synthesizer):
    def __init__(self, model_name: str = "ai4bharat/indic-parler-tts", device: str | None = None) -> None:
        import torch  # local import: keeps `ml` importable without torch installed

        from parler_tts import ParlerTTSForConditionalGeneration
        from transformers import AutoTokenizer

        self._torch = torch
        self.device = device or ("cuda:0" if torch.cuda.is_available() else "cpu")
        self.model = ParlerTTSForConditionalGeneration.from_pretrained(model_name).to(self.device)
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.description_tokenizer = AutoTokenizer.from_pretrained(
            self.model.config.text_encoder._name_or_path
        )

    def supports(self, lang: str) -> bool:
        return lang in SUPPORTED_LANGS

    def synthesize(self, text: str, lang: str, mode: str = "default") -> SynthesisResult:
        description = MODE_VOICE_DESCRIPTIONS.get(mode, MODE_VOICE_DESCRIPTIONS["default"])

        description_ids = self.description_tokenizer(description, return_tensors="pt").to(self.device)
        prompt_ids = self.tokenizer(text, return_tensors="pt").to(self.device)

        with self._torch.no_grad():
            generation = self.model.generate(
                input_ids=description_ids.input_ids,
                attention_mask=description_ids.attention_mask,
                prompt_input_ids=prompt_ids.input_ids,
                prompt_attention_mask=prompt_ids.attention_mask,
            )
        audio = generation.cpu().numpy().squeeze().astype(np.float32)
        return SynthesisResult(audio=audio, sample_rate=self.model.config.sampling_rate)
