import asyncio
import io
import json
from typing import Dict, Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import soundfile as sf
import numpy as np

from backend.app.core.engines import get_stt, get_llm, get_tts
from backend.app.core import visitor_manager
from backend.app.db.session import SessionLocal
from backend.app.core.museum_data import load_museum_data
from ml.llm.rag import build_answer_messages, build_artifact_fact_sheet

router = APIRouter(prefix="/kiosk", tags=["kiosk"])

# Audio format for ESP32 INMP441/MAX98357A: 16 kHz, 16-bit, mono
SAMPLE_RATE = 16000

@router.websocket("/ws")
async def kiosk_websocket(websocket: WebSocket):
    await websocket.accept()
    print("[kiosk_ws] ESP32 connected to WebSocket!", flush=True)

    # State
    visitor_id = "V-KIOSK-01"
    lang = "en"
    mode = "default"
    audio_buffer = bytearray()
    
    # Fake session history for now
    recent_conversation = []
    current_artifact_id = None
    
    # Make sure kiosk visitor exists
    db = SessionLocal()
    # For a kiosk, we just create a new visit session on connect, or we can use the latest one.
    # To keep it simple, we create one.
    try:
        session = visitor_manager.create_visitor(db, device_id="KIOSK-01", lang="en")
        visitor_id = session.id
        visitor_manager.set_mode(db, visitor_id, "default")
        db.commit()
    finally:
        db.close()

    try:
        while True:
            message = await websocket.receive()
            
            if "bytes" in message:
                # Binary frame from ESP32 (Microphone audio during PTT)
                audio_buffer.extend(message["bytes"])
                
            elif "text" in message:
                # Text frame from ESP32 (Control signals)
                try:
                    data = json.loads(message["text"])
                except json.JSONDecodeError:
                    continue

                msg_type = data.get("type")

                if msg_type == "rfid":
                    uid = data.get("uid")
                    print(f"[kiosk_ws] RFID Scanned: {uid}")
                    
                    db = SessionLocal()
                    try:
                        artifact, stop = visitor_manager.record_tap(db, visitor_id, uid)
                        db.commit()
                        current_artifact_id = artifact.id
                        
                        data_cache = load_museum_data()
                        gallery_name = data_cache.node_name(artifact.gallery)
                        
                        fact_sheet = build_artifact_fact_sheet({
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
                        })
                        
                        messages = build_answer_messages(
                            mode=mode,
                            lang=lang,
                            question="Introduce this artifact to the visitor as opening narration, unprompted.",
                            context_block=fact_sheet
                        )
                        
                        llm = get_llm()
                        print(f"[kiosk_ws] Generating narration for {artifact.name}...")
                        narration = await asyncio.to_thread(llm.chat, messages)
                        print(f"[kiosk_ws] Narration: {narration}")
                        
                        await send_tts(websocket, narration, lang, mode)
                        
                    except Exception as e:
                        print(f"[kiosk_ws] Tap error: {e}")
                    finally:
                        db.close()
                    
                elif msg_type == "ptt_start":
                    print("[kiosk_ws] PTT pressed, recording started...")
                    audio_buffer.clear()
                    
                elif msg_type == "ptt_end":
                    print(f"[kiosk_ws] PTT released. Received {len(audio_buffer)} bytes of audio.")
                    if len(audio_buffer) < 4000: # Too short
                        continue
                        
                    raw_audio = np.frombuffer(bytes(audio_buffer), dtype=np.int16)
                    float_audio = raw_audio.astype(np.float32) / 32768.0
                    
                    stt = get_stt()
                    if not stt:
                        print("[kiosk_ws] STT not enabled.")
                        continue
                        
                    print("[kiosk_ws] Transcribing audio...")
                    transcript_result = await asyncio.to_thread(stt.transcribe, float_audio, SAMPLE_RATE)
                    transcript_text = transcript_result.text
                    print(f"[kiosk_ws] User asked: {transcript_text}")
                    
                    if not transcript_text.strip():
                        continue
                        
                    if not current_artifact_id:
                        await send_tts(websocket, "Please tap an artifact first.", lang, mode)
                        continue
                    
                    db = SessionLocal()
                    try:
                        from backend.app.db.models import ArtifactRecord
                        artifact = db.get(ArtifactRecord, current_artifact_id)
                        
                        data_cache = load_museum_data()
                        gallery_name = data_cache.node_name(artifact.gallery)
                        
                        fact_sheet = build_artifact_fact_sheet({
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
                        })
                        
                        messages = build_answer_messages(
                            mode=mode,
                            lang=lang,
                            question=transcript_text,
                            context_block=fact_sheet,
                            recent_conversation=recent_conversation
                        )
                        
                        llm = get_llm()
                        print("[kiosk_ws] Generating answer...")
                        answer = await asyncio.to_thread(llm.chat, messages)
                        print(f"[kiosk_ws] Answer: {answer}")
                        
                        recent_conversation.append({"text": transcript_text, "answer": answer})
                        
                        # Add query to DB for tracking (optional, but good practice)
                        visitor_manager.add_query(
                            db,
                            session_id=visitor_id,
                            artifact_id=current_artifact_id,
                            stop_id=None,
                            lang=lang,
                            text=transcript_text,
                            text_en=transcript_text,
                            answer=answer,
                            topic="kiosk_qa",
                            status="success",
                            latency_ms=0
                        )
                        db.commit()
                        
                        await send_tts(websocket, answer, lang, mode)
                    except Exception as e:
                        print(f"[kiosk_ws] Error processing voice query: {e}")
                    finally:
                        db.close()

    except WebSocketDisconnect:
        print("[kiosk_ws] ESP32 disconnected.")
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"[kiosk_ws] Error: {e}")

async def send_tts(websocket: WebSocket, text: str, lang: str, mode: str):
    tts = get_tts()
    if not tts or not tts.supports(lang):
        print(f"[kiosk_ws] TTS not supported for {lang}")
        return
        
    print("[kiosk_ws] Generating TTS audio...")
    result = await asyncio.to_thread(tts.synthesize, text, lang, mode=mode)
    
    # Needs resample to 16000 for ESP32
    import librosa
    audio_16k = librosa.resample(result.audio, orig_sr=result.sample_rate, target_sr=SAMPLE_RATE)
    audio_int16 = (audio_16k * 32767).astype(np.int16)
    raw_pcm = audio_int16.tobytes()
    
    print(f"[kiosk_ws] Sending {len(raw_pcm)} bytes of PCM audio to ESP32...")
    
    chunk_size = 4096
    for i in range(0, len(raw_pcm), chunk_size):
        chunk = raw_pcm[i:i+chunk_size]
        await websocket.send_bytes(chunk)
        await asyncio.sleep(0.01)
        
    print("[kiosk_ws] Finished sending audio.")
