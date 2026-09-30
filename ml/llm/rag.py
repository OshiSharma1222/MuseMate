"""Grounding context builders.

Deliberately dependency-free of the backend's ORM: everything here takes and
returns plain dicts/strings so `ml/` never has to import `backend/`. The
backend converts its SQLAlchemy rows to dicts before calling these.

Retrieval here is simple by design: the catalogue is a few dozen artifacts,
so a direct id lookup (done by the caller) plus a light keyword match over
`description`/`curatorNotes`/`history` is enough grounding. No vector DB is
needed at this scale; swap in embeddings later if the catalogue grows large.
"""

from __future__ import annotations

from .prompts import build_system_prompt
from .ollama_client import ChatMessage


def build_artifact_fact_sheet(artifact: dict) -> str:
    """Turns one artifact row (as a dict) into a compact fact sheet for the LLM."""
    lines = [
        f"Name: {artifact.get('name')}",
        f"Accession number: {artifact.get('accession')}",
        f"Gallery: {artifact.get('galleryName') or artifact.get('gallery')}",
        f"Period: {artifact.get('period')}",
        f"Region / find-spot: {artifact.get('region')}",
        f"Material: {artifact.get('material')}",
        f"Dimensions: {artifact.get('dimensions')}",
        f"Description: {artifact.get('description')}",
    ]
    if artifact.get("history"):
        lines.append(f"History: {artifact['history']}")
    if artifact.get("provenance"):
        lines.append(f"Provenance / how the museum acquired it: {artifact['provenance']}")
    if artifact.get("ownership"):
        lines.append(f"Ownership: {artifact['ownership']}")
    if artifact.get("curatorNotes"):
        lines.append(f"Curator notes: {artifact['curatorNotes']}")
    if not artifact.get("verified", True):
        lines.append("Note: this catalogue entry is not yet curator-verified; answer cautiously.")
    return "\n".join(lines)


def build_directions_context(origin_name: str, destination_name: str, steps: list[str]) -> str:
    if not steps:
        return (
            f"No known route from {origin_name} to {destination_name}. "
            "Tell the visitor you don't have directions for that on record and suggest asking museum staff."
        )
    numbered = "\n".join(f"{i + 1}. {s}" for i, s in enumerate(steps))
    return (
        f"Route from {origin_name} to {destination_name} (walk it in this order):\n{numbered}"
    )


def build_recent_conversation(recent: list[dict]) -> list[ChatMessage]:
    """Recent Q/A pairs at the same stop, so follow-up questions have context."""
    messages: list[ChatMessage] = []
    for item in recent[-3:]:
        if item.get("text"):
            messages.append(ChatMessage(role="user", content=item["text"]))
        if item.get("answer"):
            messages.append(ChatMessage(role="assistant", content=item["answer"]))
    return messages


def build_answer_messages(
    *,
    mode: str,
    lang: str,
    question: str,
    context_block: str,
    interest_summary: str | None = None,
    recent_conversation: list[dict] | None = None,
) -> list[ChatMessage]:
    """Assembles the full message list ready to send to `OllamaClient.chat*`."""
    system = build_system_prompt(mode=mode, lang=lang, interest_summary=interest_summary)
    messages = [ChatMessage(role="system", content=system)]
    messages.extend(build_recent_conversation(recent_conversation or []))
    messages.append(
        ChatMessage(
            role="user",
            content=f"CONTEXT:\n{context_block}\n\nVISITOR QUESTION: {question}",
        )
    )
    return messages
