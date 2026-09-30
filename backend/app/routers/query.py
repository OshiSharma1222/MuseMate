"""Text and voice question answering.

`/query/text` is what the dashboard or any text client can call directly.
`/query/audio` is what the console demo (laptop mic) calls: it runs STT on
the uploaded clip server-side, then follows the exact same answer path as
`/query/text` -- matching the real architecture where the handheld only
captures audio and the edge server does all the AI work.
"""

from __future__ import annotations

import base64
import io

import numpy as np
import soundfile as sf
from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..core import live_feed as live_feed_mod
from ..core import visitor_manager
from ..core.engines import get_stt, get_tts
from ..core.query_router import answer_and_log
from ..db.session import get_db
from ..schemas import QueryResponse, TextQueryRequest

router = APIRouter(tags=["query"])


@router.post("/visitors/{visitor_id}/query/text", response_model=QueryResponse)
async def query_text(visitor_id: str, body: TextQueryRequest, db: Session = Depends(get_db)):
    session = visitor_manager.get_session(db, visitor_id)
    if session is None:
        raise HTTPException(404, f"No such visitor '{visitor_id}'")
    if body.lang:
        session.lang = body.lang

    outcome = answer_and_log(db, session, body.text)
    await live_feed_mod.live_feed.broadcast(
        {
            "kind": "query",
            "sessionId": session.id,
            "deviceId": session.device_id,
            "lang": session.lang,
            "artifactId": outcome.artifact_id,
            "at": None,
        }
    )
    return QueryResponse(
        answer=outcome.answer,
        topic=outcome.topic,
        status=outcome.status,
        artifactId=outcome.artifact_id,
        needsTap=outcome.needs_tap,
    )


@router.post("/visitors/{visitor_id}/query/audio")
async def query_audio(visitor_id: str, db: Session = Depends(get_db), file: UploadFile | None = None):
    session = visitor_manager.get_session(db, visitor_id)
    if session is None:
        raise HTTPException(404, f"No such visitor '{visitor_id}'")
    if file is None:
        raise HTTPException(400, "Upload a wav/flac audio clip as 'file'.")

    stt = get_stt()
    if stt is None:
        raise HTTPException(503, "STT engine is not available. Install ml/requirements.txt dependencies.")

    raw = await file.read()
    audio, sample_rate = sf.read(io.BytesIO(raw), dtype="float32")
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    audio = audio.astype(np.float32)

    result = stt.transcribe(audio, sample_rate, language_hint=session.lang)
    if not result.text.strip():
        raise HTTPException(400, "Could not make out any speech in that clip.")

    outcome = answer_and_log(db, session, result.text)
    await live_feed_mod.live_feed.broadcast(
        {
            "kind": "query",
            "sessionId": session.id,
            "deviceId": session.device_id,
            "lang": session.lang,
            "artifactId": outcome.artifact_id,
            "at": None,
        }
    )

    response: dict = {
        "transcript": result.text,
        "detectedLang": result.language,
        "answer": outcome.answer,
        "topic": outcome.topic,
        "status": outcome.status,
        "artifactId": outcome.artifact_id,
        "needsTap": outcome.needs_tap,
    }

    tts = get_tts()
    if tts is not None and tts.supports(session.lang):
        try:
            synth = tts.synthesize(outcome.answer, session.lang, mode=session.mode or "default")
            buf = io.BytesIO()
            sf.write(buf, synth.audio, synth.sample_rate, format="WAV")
            response["audioBase64"] = base64.b64encode(buf.getvalue()).decode("ascii")
            response["sampleRate"] = synth.sample_rate
        except Exception as exc:  # noqa: BLE001 - TTS failure shouldn't break the text answer
            response["audioError"] = str(exc)

    return response
