"""Lazily-constructed singletons for the heavy ML engines.

Import failures (e.g. torch/faster-whisper not installed yet) are caught and
logged rather than crashing the app, so `GET /artifacts` and the dashboard
endpoints keep working even before the ML dependencies are set up. Voice/LLM
routes will return a clear 503 in that case (see routers/query.py).
"""

from __future__ import annotations

import sys
from functools import lru_cache

from ..config import get_settings


def _warn(msg: str) -> None:
    print(f"[engines] {msg}", file=sys.stderr)


@lru_cache
def get_llm():
    import os

    # Prefer Groq cloud (fast, free tier) when an API key is configured
    groq_key = os.environ.get("GROQ_API_KEY", "")
    if groq_key:
        from ml.llm.groq_client import GroqClient

        groq_model = os.environ.get("GROQ_MODEL", "openai/gpt-oss-20b")
        print(f"[engines] Using Groq cloud LLM: {groq_model}", flush=True)
        return GroqClient(model=groq_model, api_key=groq_key)

    # Fall back to local Ollama
    from ml.llm.ollama_client import OllamaClient

    settings = get_settings()
    client = OllamaClient(model=settings.ollama_model, base_url=settings.ollama_base_url)
    if not client.is_reachable():
        _warn(
            f"Ollama not reachable at {settings.ollama_base_url}. "
            "Start it with `ollama serve` and make sure the model is pulled: "
            f"`ollama pull {settings.ollama_model}`."
        )
    return client


@lru_cache
def get_stt():
    settings = get_settings()
    if not settings.enable_stt:
        return None
    try:
        from ml.stt.moonshine_stt import MoonshineSTT
        print("[engines] Using local Moonshine STT", flush=True)
        return MoonshineSTT(model_arch="base")
    except Exception as exc:  # noqa: BLE001 - deliberately broad, this is a soft dependency
        _warn(f"STT unavailable ({exc}). Install with: pip install moonshine-voice")
        return None


@lru_cache
def get_tts():
    settings = get_settings()
    if not settings.enable_tts:
        return None
    try:
        from ml.tts.router import MultilingualTTS
        from ml.tts.kokoro_tts import KokoroTTS
        
        print("[engines] Using local Kokoro TTS", flush=True)
        backends = [KokoroTTS(lang_code="a", voice="af_heart")]
        return MultilingualTTS(backends)
    except Exception as exc:  # noqa: BLE001 - soft dependency
        _warn(f"TTS unavailable ({exc}). Install with: pip install kokoro>=0.9.4 soundfile")
        return None
