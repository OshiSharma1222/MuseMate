from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..db.models import QueryRecord, Stop, VisitSession
from ..db.session import get_db
from ..core.serializers import session_to_json

router = APIRouter(tags=["sessions"])


@router.get("/sessions")
def list_sessions(
    from_: int | None = Query(default=None, alias="from"),
    to: int | None = Query(default=None),
    db: Session = Depends(get_db),
):
    stmt = select(VisitSession).options(selectinload(VisitSession.stops).selectinload(Stop.queries))
    if from_ is not None:
        stmt = stmt.where(VisitSession.started_at >= from_)
    if to is not None:
        stmt = stmt.where(VisitSession.started_at <= to)
    stmt = stmt.order_by(VisitSession.started_at)

    sessions = db.execute(stmt).scalars().all()
    out = []
    for s in sessions:
        loose = db.execute(
            select(QueryRecord).where(QueryRecord.session_id == s.id, QueryRecord.stop_id.is_(None))
        ).scalars().all()
        out.append(session_to_json(s, list(loose)))
    return out


@router.get("/sessions/{session_id}")
def get_session_detail(session_id: str, db: Session = Depends(get_db)):
    s = db.get(VisitSession, session_id)
    if s is None:
        return {"error": f"No session '{session_id}'"}
    loose = db.execute(
        select(QueryRecord).where(QueryRecord.session_id == s.id, QueryRecord.stop_id.is_(None))
    ).scalars().all()
    return session_to_json(s, list(loose))
