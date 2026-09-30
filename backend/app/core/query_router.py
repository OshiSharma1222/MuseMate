"""Ties together: directions vs artifact-question classification, RAG context
building, the Ollama LLM call, topic/status tagging, and DB logging.

This is the single place `routers/query.py` and `routers/taps.py` call into,
so the text-query and audio-query endpoints (and later, a WebSocket
streaming endpoint) all share the exact same behaviour.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field

from sqlalchemy.orm import Session as DbSession

from ml.llm import interest_profile, rag
from ml.llm.ollama_client import ChatMessage

from ..db.models import ArtifactRecord, VisitSession
from . import visitor_manager
from .directions_engine import find_path
from .engines import get_llm
from .museum_data import load_museum_data
from .topics import classify_topic, is_directions_query


@dataclass
class QueryOutcome:
    answer: str
    topic: str
    status: str  # answered | unanswered | declined
    artifact_id: str | None
    stop_id: int | None
    needs_tap: bool = False
    lang: str = "en"
    latency_ms: int = 0
    extra: dict = field(default_factory=dict)


def _artifact_to_dict(artifact: ArtifactRecord, gallery_name: str) -> dict:
    return {
        "name": artifact.name,
        "accession": artifact.accession,
        "gallery": artifact.gallery,
        "galleryName": gallery_name,
        "period": artifact.period,
        "region": artifact.region,
        "material": artifact.material,
        "dimensions": artifact.dimensions,
        "description": artifact.description,
        "history": artifact.history,
        "provenance": artifact.provenance,
        "ownership": artifact.ownership,
        "curatorNotes": artifact.curator_notes,
        "verified": artifact.verified,
    }


def _session_history(db: DbSession, session: VisitSession) -> tuple[list[dict], list[dict]]:
    """Shapes this visitor's tap/question history for the interest profile."""
    data = load_museum_data()
    stops: list[dict] = []
    for s in session.stops:
        gallery_id = _gallery_of(db, s.artifact_id)
        stops.append({"gallery": data.node_name(gallery_id) if gallery_id else ""})
    queries = [{"topic": q.topic} for s in session.stops for q in s.queries]
    return stops, queries


def _gallery_of(db: DbSession, artifact_id: str) -> str:
    artifact = db.get(ArtifactRecord, artifact_id)
    return artifact.gallery if artifact else ""


def handle_directions_query(db: DbSession, session: VisitSession, question: str) -> QueryOutcome:
    data = load_museum_data()

    if not session.last_tapped_artifact_id:
        return QueryOutcome(
            answer=_tap_first_message(session.lang, for_directions=True),
            topic="facilities",
            status="unanswered",
            artifact_id=None,
            stop_id=None,
            needs_tap=True,
            lang=session.lang,
        )

    artifact = db.get(ArtifactRecord, session.last_tapped_artifact_id)
    origin_id = artifact.gallery if artifact else "entrance"
    destination_id = data.match_destination(question)

    if destination_id is None:
        return QueryOutcome(
            answer=_no_destination_message(session.lang),
            topic="facilities",
            status="unanswered",
            artifact_id=None,
            stop_id=None,
            lang=session.lang,
        )

    result = find_path(origin_id, destination_id, data)
    if not result.found:
        return QueryOutcome(
            answer=_no_route_message(session.lang),
            topic="facilities",
            status="unanswered",
            artifact_id=None,
            stop_id=None,
            lang=session.lang,
        )

    context = rag.build_directions_context(result.origin_name, result.destination_name, result.steps)
    started = time.monotonic()
    llm = get_llm()
    messages = [
        ChatMessage(
            role="system",
            content=(
                "You are the National Museum's voice guide giving walking directions. "
                f"Reply only in the visitor's language (code: {session.lang}). "
                "Turn the numbered steps below into 2-4 natural spoken sentences, in order. "
                "Do not invent any turn or landmark not listed."
            ),
        ),
        ChatMessage(role="user", content=f"{context}\n\nVisitor asked: {question}"),
    ]
    answer = llm.chat(messages)
    latency_ms = int((time.monotonic() - started) * 1000)

    return QueryOutcome(
        answer=answer,
        topic="facilities",
        status="answered",
        artifact_id=None,
        stop_id=None,
        lang=session.lang,
        latency_ms=latency_ms,
    )


def handle_artifact_query(db: DbSession, session: VisitSession, question: str) -> QueryOutcome:
    if not session.last_tapped_artifact_id:
        return QueryOutcome(
            answer=_tap_first_message(session.lang),
            topic=classify_topic(question),
            status="unanswered",
            artifact_id=None,
            stop_id=None,
            needs_tap=True,
            lang=session.lang,
        )

    artifact = db.get(ArtifactRecord, session.last_tapped_artifact_id)
    if artifact is None:
        return QueryOutcome(
            answer=_tap_first_message(session.lang),
            topic=classify_topic(question),
            status="unanswered",
            artifact_id=None,
            stop_id=None,
            needs_tap=True,
            lang=session.lang,
        )

    stop = visitor_manager.latest_stop(db, session.id)
    stop_id = stop.id if stop and stop.artifact_id == artifact.id else None
    topic = classify_topic(question)

    data = load_museum_data()
    gallery_name = data.node_name(artifact.gallery)
    context_block = rag.build_artifact_fact_sheet(_artifact_to_dict(artifact, gallery_name))

    stops_hist, queries_hist = _session_history(db, session)
    interest_summary = interest_profile.summarise_interests(stops_hist, queries_hist)

    recent = []
    if stop_id:
        for q in visitor_manager.recent_queries_for_stop(db, stop_id):
            recent.append({"text": q.text, "answer": q.answer})

    messages = rag.build_answer_messages(
        mode=session.mode or "default",
        lang=session.lang,
        question=question,
        context_block=context_block,
        interest_summary=interest_summary,
        recent_conversation=recent,
    )

    started = time.monotonic()
    answer = get_llm().chat(messages)
    latency_ms = int((time.monotonic() - started) * 1000)

    if topic == "value":
        status = "declined"
    elif not artifact.verified:
        status = "unanswered"
    else:
        status = "answered"

    return QueryOutcome(
        answer=answer,
        topic=topic,
        status=status,
        artifact_id=artifact.id,
        stop_id=stop_id,
        lang=session.lang,
        latency_ms=latency_ms,
    )


def answer_and_log(db: DbSession, session: VisitSession, question: str, text_en: str | None = None) -> QueryOutcome:
    if is_directions_query(question):
        outcome = handle_directions_query(db, session, question)
    else:
        outcome = handle_artifact_query(db, session, question)

    visitor_manager.add_query(
        db,
        session_id=session.id,
        artifact_id=outcome.artifact_id,
        stop_id=outcome.stop_id,
        lang=session.lang,
        text=question,
        text_en=text_en or (question if session.lang == "en" else ""),
        answer=outcome.answer,
        topic=outcome.topic,
        status=outcome.status,
        latency_ms=outcome.latency_ms,
    )
    return outcome


def _tap_first_message(lang: str, for_directions: bool = False) -> str:
    if for_directions:
        messages = {
            "en": "I don't know where you are yet -- please tap the RFID tag on a nearby artifact first.",
            "hi": "मुझे अभी नहीं पता कि आप कहाँ हैं -- कृपया पहले पास की किसी वस्तु के RFID टैग को टैप करें।",
        }
    else:
        messages = {
            "en": "Please tap the RFID tag on the artifact you'd like to ask about first.",
            "hi": "कृपया पहले उस वस्तु के RFID टैग को टैप करें जिसके बारे में आप जानना चाहते हैं।",
        }
    return messages.get(lang, messages["en"])


def _no_destination_message(lang: str) -> str:
    messages = {
        "en": "I'm not sure which place you mean. You can ask for the washroom, café, museum shop, cloakroom, exit, lift, or any gallery by name.",
        "hi": "मुझे समझ नहीं आया आप किस जगह की बात कर रहे हैं। आप शौचालय, कैफ़े, संग्रहालय की दुकान, क्लॉकरूम, निकास, लिफ़्ट या किसी गैलरी का नाम लेकर पूछ सकते हैं।",
    }
    return messages.get(lang, messages["en"])


def _no_route_message(lang: str) -> str:
    messages = {
        "en": "I don't have a route for that on record yet -- please ask a museum staff member nearby.",
        "hi": "मेरे पास अभी इसके लिए रास्ता दर्ज नहीं है -- कृपया पास के किसी संग्रहालय कर्मचारी से पूछें।",
    }
    return messages.get(lang, messages["en"])
