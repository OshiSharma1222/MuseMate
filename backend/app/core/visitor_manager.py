"""Visitor lifecycle: create id, mode selection, RFID taps, queries, end of visit.

This is the module `POST /visitors*` and `POST /taps*` routers call into. It
knows nothing about FastAPI; it only takes a SQLAlchemy `Session` and plain
values, which keeps it testable without spinning up the web app.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session as DbSession

from ..db.models import ArtifactRecord, QueryRecord, Stop, VisitSession

VALID_MODES = {"default", "quick", "detailed", "child"}


def _today_str() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d")


def _next_session_id(db: DbSession) -> str:
    day = _today_str()
    prefix = f"V-{day}-"
    count = db.execute(
        select(func.count()).select_from(VisitSession).where(VisitSession.id.like(f"{prefix}%"))
    ).scalar_one()
    return f"{prefix}{count + 1:03d}"


def create_visitor(db: DbSession, device_id: str = "CONSOLE-01", lang: str = "en", group: str = "solo") -> VisitSession:
    session = VisitSession(
        id=_next_session_id(db),
        device_id=device_id,
        lang=lang,
        mode=None,  # visitor must be asked; see prompts.mode_greeting
        group=group,
    )
    db.add(session)
    db.flush()
    return session


def get_session(db: DbSession, session_id: str) -> VisitSession | None:
    return db.get(VisitSession, session_id)


def set_mode(db: DbSession, session_id: str, mode: str) -> VisitSession:
    if mode not in VALID_MODES:
        raise ValueError(f"Unknown mode '{mode}'. Valid: {sorted(VALID_MODES)}")
    session = get_session(db, session_id)
    if session is None:
        raise KeyError(f"No such visitor session '{session_id}'")
    session.mode = mode
    db.flush()
    return session


def set_lang(db: DbSession, session_id: str, lang: str) -> VisitSession:
    session = get_session(db, session_id)
    if session is None:
        raise KeyError(f"No such visitor session '{session_id}'")
    session.lang = lang
    db.flush()
    return session


def find_artifact_by_tag(db: DbSession, nfc_tag_or_id: str) -> ArtifactRecord | None:
    artifact = db.get(ArtifactRecord, nfc_tag_or_id)
    if artifact:
        return artifact
    return db.execute(
        select(ArtifactRecord).where(ArtifactRecord.nfc_tag == nfc_tag_or_id)
    ).scalar_one_or_none()


def record_tap(db: DbSession, session_id: str, nfc_tag_or_id: str) -> tuple[ArtifactRecord, Stop]:
    session = get_session(db, session_id)
    if session is None:
        raise KeyError(f"No such visitor session '{session_id}'")
    artifact = find_artifact_by_tag(db, nfc_tag_or_id)
    if artifact is None:
        raise LookupError(f"No artifact matches tag/id '{nfc_tag_or_id}'")

    stop = Stop(session_id=session.id, artifact_id=artifact.id)
    db.add(stop)
    session.last_tapped_artifact_id = artifact.id
    db.flush()
    return artifact, stop


def latest_stop(db: DbSession, session_id: str) -> Stop | None:
    return db.execute(
        select(Stop).where(Stop.session_id == session_id).order_by(Stop.at.desc()).limit(1)
    ).scalar_one_or_none()


def recent_queries_for_stop(db: DbSession, stop_id: int, limit: int = 3) -> list[QueryRecord]:
    rows = db.execute(
        select(QueryRecord).where(QueryRecord.stop_id == stop_id).order_by(QueryRecord.at.desc()).limit(limit)
    ).scalars().all()
    return list(reversed(rows))


def add_query(
    db: DbSession,
    *,
    session_id: str,
    artifact_id: str | None,
    stop_id: int | None,
    lang: str,
    text: str,
    text_en: str,
    answer: str,
    topic: str,
    status: str,
    latency_ms: int,
) -> QueryRecord:
    record = QueryRecord(
        id=f"Q-{uuid.uuid4().hex[:10]}",
        session_id=session_id,
        stop_id=stop_id,
        artifact_id=artifact_id,
        lang=lang,
        text=text,
        text_en=text_en,
        answer=answer,
        topic=topic,
        status=status,
        latency_ms=latency_ms,
    )
    db.add(record)
    db.flush()
    return record


def end_session(
    db: DbSession,
    session_id: str,
    rating: int | None = None,
    review_text: str | None = None,
    review_text_en: str | None = None,
    review_tags: list[str] | None = None,
) -> VisitSession:
    session = get_session(db, session_id)
    if session is None:
        raise KeyError(f"No such visitor session '{session_id}'")
    session.ended_at = int(datetime.now(timezone.utc).timestamp() * 1000)
    session.rating = rating
    session.review_text = review_text
    session.review_text_en = review_text_en
    session.review_tags = review_tags or []
    db.flush()
    return session
