"""Thin streaming client for a local Ollama server.

Only depends on `httpx`. Kept separate from prompt-building (`prompts.py`) and
retrieval (`rag.py`) so it can be reused or swapped (e.g. for llama.cpp's own
server) without touching the rest of the ml package.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Generator, Iterable

import httpx

DEFAULT_OLLAMA_URL = "http://localhost:11434"


@dataclass
class ChatMessage:
    role: str  # "system" | "user" | "assistant"
    content: str

    def to_dict(self) -> dict:
        return {"role": self.role, "content": self.content}


class OllamaClient:
    """Talks to `POST /api/chat` on a local Ollama daemon.

    Example:
        client = OllamaClient(model="qwen3.5:4b")
        for chunk in client.chat_stream(messages):
            print(chunk, end="", flush=True)
    """

    def __init__(
        self,
        model: str = "qwen3.5:0.8b",
        base_url: str = DEFAULT_OLLAMA_URL,
        timeout: float = 300.0,
        num_ctx: int = 2048,
    ) -> None:
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.num_ctx = num_ctx

    def chat_stream(
        self,
        messages: Iterable[ChatMessage],
        temperature: float = 0.4,
    ) -> Generator[str, None, None]:
        """Yields response text chunks as the model generates them."""
        payload = {
            "model": self.model,
            "messages": [m.to_dict() for m in messages],
            "stream": True,
            "options": {
                "temperature": temperature,
                "num_ctx": self.num_ctx,
            },
        }
        with httpx.stream(
            "POST",
            f"{self.base_url}/api/chat",
            json=payload,
            timeout=self.timeout,
        ) as response:
            response.raise_for_status()
            for line in response.iter_lines():
                if not line:
                    continue
                data = json.loads(line)
                if data.get("done"):
                    break
                piece = data.get("message", {}).get("content", "")
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
        """Yields whole sentences as soon as they're complete.

        This is what lets TTS start speaking before the LLM has finished
        generating the full answer: each sentence is handed to the
        synthesizer the moment a sentence-ending punctuation mark arrives.
        """
        buffer = ""
        enders = (".", "!", "?", "\u0964", "\n")  # \u0964 = Devanagari danda "।"
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

    def is_reachable(self) -> bool:
        try:
            r = httpx.get(f"{self.base_url}/api/tags", timeout=3.0)
            return r.status_code == 200
        except httpx.HTTPError:
            return False
