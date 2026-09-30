"""Converts ORM rows into the exact JSON shapes
`dashboard/src/data/types.ts` expects, so the dashboard can eventually read
straight from this API with no transformation on its side.
"""

from __future__ import annotations

from ..db.models import ArtifactRecord, QueryRecord, Stop, VisitSession


def artifact_to_json(a: ArtifactRecord) -> dict:
    return {
        "id": a.id,
        "accession": a.accession,
        "nfcTag": a.nfc_tag,
        "name": a.name,
        "kind": a.kind,
        "gallery": a.gallery,
        "period": a.period,
        "region": a.region,
        "material": a.material,
        "dimensions": a.dimensions,
        "description": a.description,
        "history": a.history,
        "provenance": a.provenance,
        "ownership": a.ownership,
        "curatorNotes": a.curator_notes,
        "verified": a.verified,
        "narrationLangs": a.narration_langs,
        "updatedAt": a.updated_at,
    }


def query_to_json(q: QueryRecord) -> dict:
    return {
        "id": q.id,
        "sessionId": q.session_id,
        "artifactId": q.artifact_id,
        "at": q.at,
        "lang": q.lang,
        "text": q.text,
        "textEn": q.text_en,
        "answer": q.answer,
        "topic": q.topic,
        "status": q.status,
        "latencyMs": q.latency_ms,
    }


def stop_to_json(s: Stop) -> dict:
    return {
        "artifactId": s.artifact_id,
        "at": s.at,
        "dwellSec": s.dwell_sec,
        "listenedPct": s.listened_pct,
        "skipped": s.skipped,
        "replays": s.replays,
        "tapRetries": s.tap_retries,
        "queries": [query_to_json(q) for q in s.queries],
    }


def session_to_json(session: VisitSession, loose_queries: list[QueryRecord]) -> dict:
    review = None
    if session.review_text is not None:
        review = {
            "rating": session.rating,
            "text": session.review_text,
            "textEn": session.review_text_en or "",
            "tags": session.review_tags or [],
        }
    return {
        "id": session.id,
        "deviceId": session.device_id,
        "lang": session.lang,
        "mode": session.mode,
        "group": session.group,
        "startedAt": session.started_at,
        "endedAt": session.ended_at,
        "stops": [stop_to_json(s) for s in session.stops],
        "looseQueries": [query_to_json(q) for q in loose_queries],
        "rating": session.rating,
        "review": review,
        # extra, backend-only convenience field (harmless for the dashboard to ignore)
        "lastTappedArtifactId": session.last_tapped_artifact_id,
    }
