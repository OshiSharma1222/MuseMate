"""Lightweight keyword-based topic classification.

Topic ids match the dashboard's `Topic` union in
`dashboard/src/data/types.ts` exactly, so query stats feed the existing
Pain Points / content-gap logic without any translation layer.

This is a heuristic, not a model call: fast, deterministic, and good enough
for routing + stats at this catalogue size. It runs on the English-translated
question text (Whisper/LLM can translate first if needed) or directly on
English queries.
"""

from __future__ import annotations

import re

# Order matters: more specific topics are checked before generic ones.
_KEYWORDS: list[tuple[str, list[str]]] = [
    ("value", ["worth", "value", "price", "cost", "sell", "money"]),
    ("provenance", ["acquire", "provenance", "original", "copy", "replica", "how did the museum get", "authentic"]),
    ("restoration", ["restore", "restoration", "repair", "broken", "damage", "conservation"]),
    ("maker", ["who made", "maker", "artist", "sculptor", "craftsman", "workshop"]),
    ("age", ["how old", "age", "date", "when was", "century", "year"]),
    ("material", ["made of", "material", "what is it made", "metal", "stone", "clay", "wood", "made from"]),
    ("technique", ["how was this made", "how were these made", "technique", "cast", "carved", "woven", "how is it made"]),
    ("origin", ["where was this found", "where was it found", "find-spot", "excavated", "discovered"]),
    ("related", ["more like this", "similar", "related", "other examples"]),
    ("meaning", ["mean", "symbol", "represent", "significance", "why does", "who is"]),
    ("use", ["used for", "use for", "purpose", "function", "how was it used"]),
    ("story", ["story", "legend", "myth", "who was", "history of", "tell me about"]),
    ("facilities", ["washroom", "toilet", "bathroom", "restroom", "cafe", "café", "canteen",
                    "shop", "exit", "wheelchair", "lift", "elevator", "cloakroom", "locker"]),
    ("media", ["video", "audio", "listen", "hear more", "watch"]),
]

DIRECTIONS_PATTERN = re.compile(
    r"\b(how do i get|how to get|which way|where is|directions? to|take me to|find my way)\b",
    re.IGNORECASE,
)


def is_directions_query(text: str) -> bool:
    return bool(DIRECTIONS_PATTERN.search(text))


def classify_topic(text: str) -> str:
    lowered = text.lower()
    for topic, keywords in _KEYWORDS:
        if any(kw in lowered for kw in keywords):
            return topic
    return "story"  # sensible default: most open-ended questions are about the object's story
