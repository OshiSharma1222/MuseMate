from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ml.llm.prompts import mode_greeting

from ..core import live_feed as live_feed_mod
from ..core import visitor_manager
from ..core.serializers import session_to_json
from ..db.models import QueryRecord
from ..db.session import get_db
from ..schemas import (
    CreateVisitorRequest,
    CreateVisitorResponse,
    EndVisitRequest,
    SetLangRequest,
    SetModeRequest,
)

router = APIRouter(tags=["visitors"])


@router.post("/visitors", response_model=CreateVisitorResponse)
async def create_visitor(body: CreateVisitorRequest, db: Session = Depends(get_db)):
    session = visitor_manager.create_visitor(db, device_id=body.deviceId, lang=body.lang, group=body.group)
    await live_feed_mod.live_feed.broadcast(
        {"kind": "start", "sessionId": session.id, "deviceId": session.device_id, "lang": session.lang, "artifactId": None, "at": session.started_at}
    )
    return CreateVisitorResponse(
        visitorId=session.id,
        lang=session.lang,
        needsMode=True,
        prompt=mode_greeting(session.lang),
    )


@router.post("/visitors/{visitor_id}/mode")
def set_mode(visitor_id: str, body: SetModeRequest, db: Session = Depends(get_db)):
    try:
        session = visitor_manager.set_mode(db, visitor_id, body.mode)
    except (KeyError, ValueError) as exc:
        raise HTTPException(404 if isinstance(exc, KeyError) else 400, str(exc))
    loose = db.execute(
        select(QueryRecord).where(QueryRecord.session_id == session.id, QueryRecord.stop_id.is_(None))
    ).scalars().all()
    return session_to_json(session, list(loose))


@router.post("/visitors/{visitor_id}/lang")
def set_lang(visitor_id: str, body: SetLangRequest, db: Session = Depends(get_db)):
    try:
        session = visitor_manager.set_lang(db, visitor_id, body.lang)
    except KeyError as exc:
        raise HTTPException(404, str(exc))
    return {"visitorId": session.id, "lang": session.lang}


@router.get("/visitors/{visitor_id}")
def get_visitor(visitor_id: str, db: Session = Depends(get_db)):
    session = visitor_manager.get_session(db, visitor_id)
    if session is None:
        raise HTTPException(404, f"No such visitor '{visitor_id}'")
    loose = db.execute(
        select(QueryRecord).where(QueryRecord.session_id == session.id, QueryRecord.stop_id.is_(None))
    ).scalars().all()
    return session_to_json(session, list(loose))


@router.post("/visitors/{visitor_id}/end")
async def end_visit(visitor_id: str, body: EndVisitRequest, db: Session = Depends(get_db)):
    try:
        session = visitor_manager.end_session(
            db,
            visitor_id,
            rating=body.rating,
            review_text=body.reviewText,
            review_text_en=body.reviewTextEn,
            review_tags=body.reviewTags,
        )
    except KeyError as exc:
        raise HTTPException(404, str(exc))
    await live_feed_mod.live_feed.broadcast(
        {"kind": "end", "sessionId": session.id, "deviceId": session.device_id, "lang": session.lang, "artifactId": None, "at": session.ended_at}
    )
    loose = db.execute(
        select(QueryRecord).where(QueryRecord.session_id == session.id, QueryRecord.stop_id.is_(None))
    ).scalars().all()
    return session_to_json(session, list(loose))
