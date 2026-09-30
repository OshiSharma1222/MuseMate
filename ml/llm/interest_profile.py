"""Turns a visitor's tap/question history into a short personalisation summary.

Pure function of plain dicts (no DB/ORM dependency): the backend queries its
own tables, shapes them into `stops`/`queries` lists, and calls
`summarise_interests`. Kept separate from `rag.py` so it's independently
testable and reusable (e.g. a future "you might also like" feature on the
handheld or the dashboard could reuse the same scoring).
"""

from __future__ import annotations

from collections import Counter

TOPIC_LABELS: dict[str, str] = {
    "maker": "who made things",
    "age": "how old things are",
    "material": "materials",
    "technique": "how things were made",
    "meaning": "meaning and symbolism",
    "story": "stories and legends",
    "origin": "where things were found",
    "use": "what things were used for",
    "related": "related objects",
    "provenance": "how the museum acquired pieces",
    "restoration": "condition and restoration",
    "value": "market value",
    "media": "audio/visual media",
    "facilities": "facilities and directions",
}


def score_topics(queries: list[dict]) -> Counter:
    return Counter(q["topic"] for q in queries if q.get("topic"))


def score_galleries(stops: list[dict]) -> Counter:
    return Counter(s["gallery"] for s in stops if s.get("gallery"))


def summarise_interests(
    stops: list[dict],
    queries: list[dict],
    top_n: int = 2,
) -> str | None:
    """Returns a one-line natural-language summary, or None if there's too little data."""
    if len(queries) < 2 and len(stops) < 2:
        return None

    topic_counts = score_topics(queries)
    gallery_counts = score_galleries(stops)

    bits: list[str] = []
    top_topics = [TOPIC_LABELS.get(t, t) for t, _ in topic_counts.most_common(top_n)]
    if top_topics:
        bits.append("often asks about " + " and ".join(top_topics))

    top_galleries = [g for g, _ in gallery_counts.most_common(top_n)]
    if top_galleries:
        bits.append("has spent the most time in " + " and ".join(top_galleries))

    if not bits:
        return None
    return "This visitor " + "; ".join(bits) + "."
