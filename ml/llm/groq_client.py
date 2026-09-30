"""Groq cloud LLM client — drop-in replacement for OllamaClient.

Groq's free tier runs llama-3.1-8b-instant at ~500 tokens/second,
making it orders of magnitude faster than CPU-based Ollama for museum
narration on a laptop without a GPU.

Requires:  pip install groq
API key:   https://console.groq.com -> Create API Key -> set GROQ_API_KEY env var
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Generator, Iterable

from .ollama_client import ChatMessage  # reuse the same dataclass

DEFAULT_MODEL = "openai/gpt-oss-20b"


class GroqClient:
    """Talks to Groq's OpenAI-compatible chat endpoint.

    Example:
        client = GroqClient()
        for chunk in client.chat_stream(messages):
            print(chunk, end="", flush=True)
    """

    def __init__(
        self,
        model: str = DEFAULT_MODEL,
        api_key: str | None = None,
        timeout: float = 60.0,
    ) -> None:
        self.model = model
        self.timeout = timeout
        self._api_key = api_key or os.environ.get("GROQ_API_KEY", "")
        if not self._api_key:
            raise RuntimeError(
                "GROQ_API_KEY is not set. "
                "Get a free key at https://console.groq.com and set it as an environment variable."
            )

    def is_reachable(self) -> bool:
        try:
            from groq import Groq  # noqa: PLC0415

            client = Groq(api_key=self._api_key)
            client.models.list()
            return True
        except Exception:  # noqa: BLE001
            return False

    def chat_stream(
        self,
        messages: Iterable[ChatMessage],
        temperature: float = 0.4,
    ) -> Generator[str, None, None]:
        """Yields response text chunks as the model generates them."""
        from groq import Groq  # noqa: PLC0415

        client = Groq(api_key=self._api_key)
        stream = client.chat.completions.create(
            model=self.model,
            messages=[m.to_dict() for m in messages],
            temperature=temperature,
            stream=True,
        )
        for chunk in stream:
            piece = chunk.choices[0].delta.content or ""
            if piece:
                yield piece

    def chat(self, messages: Iterable[ChatMessage], temperature: float = 0.4) -> str:
        """Blocking convenience wrapper: returns the full response text."""
        return "".join(self.chat_stream(messages, temperature=temperature))

    def chat_sentences(
        self,
        messages: Iterable[ChatMessage],
        temperature: float = 0.4,
    ) -> Generator[str, None, None]:
        """Yields whole sentences as soon as they're complete (for streaming TTS)."""
        buffer = ""
        enders = (".", "!", "?", "\u0964", "\n")
        for chunk in self.chat_stream(messages, temperature=temperature):
            buffer += chunk
            while True:
                cut = -1
                for ender in enders:
                    idx = buffer.find(ender)
                    if idx != -1 and (cut == -1 or idx < cut):
                        cut = idx
                if cut == -1:
                    break
                sentence, buffer = buffer[: cut + 1], buffer[cut + 1 :]
                sentence = sentence.strip()
                if sentence:
                    yield sentence
        remainder = buffer.strip()
        if remainder:
            yield remainder
