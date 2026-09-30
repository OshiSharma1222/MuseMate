"""Simulates the RFID tap event an ESP32 + PN532 reader will eventually send
over WiFi. Until that hardware exists, `POST /visitors/{id}/tap` accepts
either a raw NFC tag UID or (for easy testing) an artifact id like "A007".
"""

from __future__ import annotations

import base64
import io

import soundfile as sf
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ml.llm import interest_profile, rag

from ..core import live_feed as live_feed_mod
from ..core import visitor_manager
from ..core.engines import get_llm, get_tts
from ..core.museum_data import load_museum_data
from ..db.models import ArtifactRecord
from ..db.session import get_db
from ..schemas import TapRequest, TapResponse

router = APIRouter(tags=["taps"])


@router.post("/visitors/{visitor_id}/tap", response_model=TapResponse)
async def tap_artifact(visitor_id: str, body: TapRequest, db: Session = Depends(get_db)):
    session = visitor_manager.get_session(db, visitor_id)
    if session is None:
        raise HTTPException(404, f"No such visitor '{visitor_id}'")

    try:
        artifact, stop = visitor_manager.record_tap(db, visitor_id, body.nfcTag)
    except LookupError as exc:
        raise HTTPException(404, str(exc))

    data = load_museum_data()
    gallery_name = data.node_name(artifact.gallery)
    context_block = rag.build_artifact_fact_sheet(
        {
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
        }
    )

    audio_b64, sample_rate, narration = None, None, None

    # First check if there is a pre-generated narration file
    import json
    import os
    pregen_file = f"backend/data/narrations/{artifact.id}_{session.lang}_{session.mode or 'default'}.json"
    if os.path.exists(pregen_file):
        try:
            with open(pregen_file, "r", encoding="utf-8") as f:
                pregen = json.load(f)
                narration = pregen.get("narration")
                audio_b64 = pregen.get("audioBase64")
                sample_rate = pregen.get("sampleRate")
        except Exception as e:
            print(f"Failed to load pregenerated narration: {e}")

    # Fallback to generating on the fly if pre-generation not found
    if not narration:
        stops_hist = []
        for s in session.stops:
            stop_artifact = db.get(ArtifactRecord, s.artifact_id)
            gallery_id = stop_artifact.gallery if stop_artifact else ""
            stops_hist.append({"gallery": data.node_name(gallery_id) if gallery_id else ""})
        queries_hist: list[dict] = []
        interest_summary = interest_profile.summarise_interests(stops_hist, queries_hist)

        messages = rag.build_answer_messages(
            mode=session.mode or "default",
            lang=session.lang,
            question="Introduce this artifact to the visitor as opening narration, unprompted.",
            context_block=context_block,
            interest_summary=interest_summary,
        )
        narration = get_llm().chat(messages)

    await live_feed_mod.live_feed.broadcast(
        {
            "kind": "tap",
            "sessionId": session.id,
            "deviceId": session.device_id,
            "lang": session.lang,
            "artifactId": artifact.id,
            "at": stop.at,
        }
    )

    if audio_b64 is None:
        tts = get_tts()
        if tts is not None and tts.supports(session.lang):
            try:
                synth = tts.synthesize(narration, session.lang, mode=session.mode or "default")
                buf = io.BytesIO()
                sf.write(buf, synth.audio, synth.sample_rate, format="WAV")
                audio_b64 = base64.b64encode(buf.getvalue()).decode("ascii")
                sample_rate = synth.sample_rate
            except Exception:  # noqa: BLE001 - narration text still returned if TTS fails
                pass

    return TapResponse(
        artifactId=artifact.id,
        name=artifact.name,
        gallery=gallery_name,
        narration=narration,
        audioBase64=audio_b64,
        sampleRate=sample_rate,
    )
