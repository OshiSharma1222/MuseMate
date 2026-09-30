"""SQLAlchemy models mirroring dashboard/src/data/types.ts exactly, so
`GET /sessions` and `GET /artifacts` can be serialized straight into the
shapes the dashboard already expects (Session -> Stop -> Query, Artifact).
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


def now_ms() -> int:
    return int(datetime.now(timezone.utc).timestamp() * 1000)


class ArtifactRecord(Base):
    __tablename__ = "artifacts"

    id: Mapped[str] = mapped_column(String, primary_key=True)  # "A001"
    accession: Mapped[str] = mapped_column(String)
    nfc_tag: Mapped[str] = mapped_column(String, unique=True, index=True)
    name: Mapped[str] = mapped_column(String)
    kind: Mapped[str] = mapped_column(String)
    gallery: Mapped[str] = mapped_column(String, index=True)
    period: Mapped[str] = mapped_column(String, default="")
    region: Mapped[str] = mapped_column(String, default="")
    material: Mapped[str] = mapped_column(String, default="")
    dimensions: Mapped[str] = mapped_column(String, default="")
    description: Mapped[str] = mapped_column(Text, default="")
    history: Mapped[str] = mapped_column(Text, default="")
    provenance: Mapped[str] = mapped_column(Text, default="")
    ownership: Mapped[str] = mapped_column(Text, default="")
    curator_notes: Mapped[str] = mapped_column(Text, default="")
    verified: Mapped[bool] = mapped_column(Boolean, default=True)
    narration_langs: Mapped[list] = mapped_column(JSON, default=list)
    common_questions: Mapped[list] = mapped_column(JSON, default=list)
    updated_at: Mapped[int] = mapped_column(Integer, default=now_ms)


class VisitSession(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True)  # "V-20260214-001"
    device_id: Mapped[str] = mapped_column(String, default="CONSOLE-01")
    lang: Mapped[str] = mapped_column(String, default="en")
    mode: Mapped[str | None] = mapped_column(String, nullable=True)  # set after mode prompt
    group: Mapped[str] = mapped_column(String, default="solo")
    started_at: Mapped[int] = mapped_column(Integer, default=now_ms)
    ended_at: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    review_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    review_text_en: Mapped[str | None] = mapped_column(Text, nullable=True)
    review_tags: Mapped[list] = mapped_column(JSON, default=list)

    # Not part of the dashboard's Session type, but needed internally to answer
    # "tap the RFID tag first" logic and follow-up questions at the same stop.
    last_tapped_artifact_id: Mapped[str | None] = mapped_column(String, nullable=True)

    stops: Mapped[list["Stop"]] = relationship(
        back_populates="session", order_by="Stop.at", cascade="all, delete-orphan"
    )
    # Loose (not-artifact-tied) queries are fetched with an explicit query in
    # code (see db/queries.py) rather than a relationship, to keep the mapping simple.


class Stop(Base):
    __tablename__ = "stops"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(ForeignKey("sessions.id"), index=True)
    artifact_id: Mapped[str] = mapped_column(ForeignKey("artifacts.id"))
    at: Mapped[int] = mapped_column(Integer, default=now_ms)
    dwell_sec: Mapped[float] = mapped_column(Float, default=0.0)
    listened_pct: Mapped[float] = mapped_column(Float, default=0.0)
    skipped: Mapped[bool] = mapped_column(Boolean, default=False)
    replays: Mapped[int] = mapped_column(Integer, default=0)
    tap_retries: Mapped[int] = mapped_column(Integer, default=0)

    session: Mapped[VisitSession] = relationship(back_populates="stops")
    queries: Mapped[list["QueryRecord"]] = relationship(
        back_populates="stop", order_by="QueryRecord.at", cascade="all, delete-orphan"
    )


class QueryRecord(Base):
    __tablename__ = "queries"

    id: Mapped[str] = mapped_column(String, primary_key=True)  # "Q-xxxxxxxx"
    session_id: Mapped[str] = mapped_column(ForeignKey("sessions.id"), index=True)
    stop_id: Mapped[int | None] = mapped_column(ForeignKey("stops.id"), nullable=True)
    artifact_id: Mapped[str | None] = mapped_column(String, nullable=True)
    at: Mapped[int] = mapped_column(Integer, default=now_ms)
    lang: Mapped[str] = mapped_column(String, default="en")
    text: Mapped[str] = mapped_column(Text)
    text_en: Mapped[str] = mapped_column(Text, default="")
    answer: Mapped[str] = mapped_column(Text, default="")
    topic: Mapped[str] = mapped_column(String, default="story")
    status: Mapped[str] = mapped_column(String, default="answered")  # answered|unanswered|declined
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)

    stop: Mapped[Stop | None] = relationship(back_populates="queries")
