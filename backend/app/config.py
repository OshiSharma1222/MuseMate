"""Central, .env-driven settings. Change the model tag or engine paths here only."""

from __future__ import annotations

import os
from pathlib import Path
from functools import lru_cache

try:
    from dotenv import load_dotenv
    
    APP_DIR = Path(__file__).resolve().parent
    env_path = APP_DIR.parent / ".env"
    load_dotenv(dotenv_path=env_path)
except ImportError:
    APP_DIR = Path(__file__).resolve().parent
    pass  # python-dotenv is optional; env vars can be set another way

APP_DIR = Path(__file__).resolve().parent
DATA_DIR = APP_DIR / "data"


def _env(name: str, default: str) -> str:
    return os.environ.get(name, default)


class Settings:
    # LLM
    ollama_base_url: str = _env("OLLAMA_BASE_URL", "http://localhost:11434")
    ollama_model: str = _env("OLLAMA_MODEL", "qwen3.5:0.8b")
    llm_temperature: float = float(_env("LLM_TEMPERATURE", "0.4"))

    # STT
    whisper_model_size: str = _env("WHISPER_MODEL_SIZE", "tiny")
    whisper_device: str = _env("WHISPER_DEVICE", "cpu")
    whisper_compute_type: str = _env("WHISPER_COMPUTE_TYPE", "int8")

    # TTS
    indic_parler_model: str = _env("INDIC_PARLER_MODEL", "ai4bharat/indic-parler-tts")
    piper_voice_en: str = _env("PIPER_VOICE_EN", "en_US-amy-medium.onnx")
    piper_voice_fr: str = _env("PIPER_VOICE_FR", "")  # path to fr_FR-*.onnx, optional
    piper_voice_de: str = _env("PIPER_VOICE_DE", "")  # path to de_DE-*.onnx, optional
    enable_tts: bool = _env("ENABLE_TTS", "true").lower() == "true"
    enable_stt: bool = _env("ENABLE_STT", "true").lower() == "true"

    # DB / data
    database_url: str = _env("DATABASE_URL", f"sqlite:///{APP_DIR / 'data' / 'musemate.db'}")
    artifacts_json: Path = DATA_DIR / "artifacts.json"
    museum_json: Path = DATA_DIR / "museum.json"
    directions_json: Path = DATA_DIR / "directions.json"

    # Server
    cors_origins: list[str] = _env("CORS_ORIGINS", "http://localhost:5173").split(",")
    device_id_default: str = _env("DEVICE_ID_DEFAULT", "CONSOLE-01")


@lru_cache
def get_settings() -> Settings:
    return Settings()
