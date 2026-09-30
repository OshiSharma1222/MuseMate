#!/usr/bin/env python3
"""Pregenerates narrations and audio for all artifacts to avoid LLM/TTS latency
during the tap event. 

Saves the outputs to backend/data/narrations/.

Usage:
    python backend/scripts/pregenerate_narrations.py
"""

import os
import sys
import json
import base64
import io
from pathlib import Path
import soundfile as sf

_REPO_ROOT = Path(__file__).resolve().parents[2]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from backend.app.config import get_settings
from backend.app.db.session import SessionLocal
from backend.app.db.models import ArtifactRecord
from backend.app.core.museum_data import load_museum_data
from backend.app.core.engines import get_llm, get_tts
from ml.llm import rag

def main():
    db = SessionLocal()
    artifacts = db.query(ArtifactRecord).all()
    data = load_museum_data()
    llm = get_llm()
    tts = get_tts()
    
    out_dir = Path("backend/data/narrations")
    out_dir.mkdir(parents=True, exist_ok=True)
    
    lang = "en"
    mode = "default"
    
    print(f"Generating narrations for {len(artifacts)} artifacts...")
    for artifact in artifacts:
        filename = out_dir / f"{artifact.id}_{lang}_{mode}.json"
        if filename.exists():
            print(f"Skipping {artifact.id}, already pre-generated.")
            continue
            
        print(f"Generating for {artifact.id}: {artifact.name}...")
        
        gallery_name = data.node_name(artifact.gallery)
        context_block = rag.build_artifact_fact_sheet({
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
        
        # Empty interest summary since it's pregenerated
        messages = rag.build_answer_messages(
            mode=mode,
            lang=lang,
            question="Introduce this artifact to the visitor as opening narration, unprompted.",
            context_block=context_block,
            interest_summary="",
        )
        
        narration = llm.chat(messages)
        
        audio_b64, sample_rate = None, None
        if tts is not None and tts.supports(lang):
            try:
                synth = tts.synthesize(narration, lang, mode=mode)
                buf = io.BytesIO()
                sf.write(buf, synth.audio, synth.sample_rate, format="WAV")
                audio_b64 = base64.b64encode(buf.getvalue()).decode("ascii")
                sample_rate = synth.sample_rate
            except Exception as e:
                print(f"TTS failed for {artifact.id}: {e}")
        
        output = {
            "narration": narration,
            "audioBase64": audio_b64,
            "sampleRate": sample_rate,
        }
        
        with open(filename, "w", encoding="utf-8") as f:
            json.dump(output, f)
            
        # Optional: Save WAV as well for manual playing/inspection
        if audio_b64:
            wav_filename = out_dir / f"{artifact.id}_{lang}_{mode}.wav"
            with open(wav_filename, "wb") as f:
                f.write(base64.b64decode(audio_b64))

    print("Done pre-generating narrations.")

if __name__ == "__main__":
    main()
