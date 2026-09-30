#!/usr/bin/env python3
"""Hands-free hardware kiosk client.

This script acts as the "brain" for the physical ESP32. It connects to the 
backend's WebSocket to listen for physical RFID taps and PTT button presses. 
When a tap occurs, it fetches the artifact narration. When PTT is pressed, 
it records from the laptop mic and sends the question when released.

Usage (with backend running):
    pip install websockets sounddevice numpy
    python backend/scripts/run_handsfree.py
"""

import argparse
import base64
import io
import json
import sys
import threading
from pathlib import Path

import numpy as np
import requests
import soundfile as sf
import websockets.sync.client
import sounddevice as sd

_REPO_ROOT = Path(__file__).resolve().parents[2]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from ml.audio import speaker  # noqa: E402


class AudioRecorder:
    def __init__(self):
        self.frames = []
        self.stream = None

    def _callback(self, indata, frames, time, status):
        self.frames.append(indata.copy())

    def start(self):
        self.frames = []
        self.stream = sd.InputStream(samplerate=16000, channels=1, dtype="int16", callback=self._callback)
        self.stream.start()
        print("[Voice] Recording... Speak now.", flush=True)

    def stop(self):
        if self.stream:
            self.stream.stop()
            self.stream.close()
            self.stream = None
        print("[Voice] Recording stopped. Processing...", flush=True)
        if not self.frames:
            return np.zeros(0, dtype=np.float32)
        pcm = np.concatenate(self.frames).reshape(-1).astype(np.float32) / 32768.0
        return pcm


def play_base64_audio(audio_b64: str | None, sample_rate: int | None, block: bool = True) -> None:
    if not audio_b64:
        return
    raw = base64.b64decode(audio_b64)
    audio, sr = sf.read(io.BytesIO(raw), dtype="float32")
    speaker.play(audio, sr or sample_rate or 22050, block=block)


def send_audio(base_url: str, visitor_id: str, audio: np.ndarray) -> None:
    if audio.size == 0:
        return
    buf = io.BytesIO()
    sf.write(buf, audio, 16000, format="WAV")
    buf.seek(0)
    
    try:
        r = requests.post(
            f"{base_url}/visitors/{visitor_id}/query/audio",
            files={"file": ("clip.wav", buf, "audio/wav")},
        )
        r.raise_for_status()
        data = r.json()
        print(f"  You said: {data['transcript']}")
        print(f"  Answer:   {data['answer']}")
        
        # Stop any currently playing audio before answering
        sd.stop()
        
        play_base64_audio(data.get("audioBase64"), data.get("sampleRate"), block=True)
        print("\n[Voice] Ready for next question (press PTT or scan a new artifact).")
    except Exception as e:
        print(f"[Voice] Error getting answer: {e}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://localhost:8000")
    parser.add_argument("--lang", default="en")
    args = parser.parse_args()

    base_http = args.base_url.rstrip("/")
    base_ws = base_http.replace("http://", "ws://").replace("https://", "wss://")

    print("Initializing kiosk session...")
    resp = requests.post(f"{base_http}/visitors", json={"deviceId": "KIOSK-01", "lang": args.lang})
    resp.raise_for_status()
    visitor_id = resp.json()["visitorId"]
    
    requests.post(f"{base_http}/visitors/{visitor_id}/mode", json={"mode": "default"}).raise_for_status()
    print(f"Kiosk ready! Visitor ID: {visitor_id}\n")
    print("Waiting for physical RFID taps or PTT presses from the ESP32...")

    recorder = AudioRecorder()
    ws_url = f"{base_ws}/live"

    with websockets.sync.client.connect(ws_url, ping_interval=None) as ws:
        for message in ws:
            event = json.loads(message)
            kind = event.get("kind")
            
            if kind == "hardware_tap":
                uid = event["uid"]
                print(f"\n[RFID] Scanned UID: {uid}")
                
                sd.stop()
                if recorder.stream:
                    recorder.stop()

                def handle_tap(uid):
                    try:
                        r = requests.post(f"{base_http}/visitors/{visitor_id}/tap", json={"nfcTag": uid})
                        if r.status_code != 200:
                            print(f"[RFID] Error: {r.json().get('detail', r.text)}")
                            return
                        
                        data = r.json()
                        print(f"[RFID] Artifact: {data['name']} ({data['gallery']})")
                        print(f"       Narration: {data['narration']}")
                        
                        play_base64_audio(data.get("audioBase64"), data.get("sampleRate"), block=True)
                    except Exception as e:
                        print(f"[RFID] Failed to process tap: {e}")
                
                threading.Thread(target=handle_tap, args=(uid,), daemon=True).start()

            elif kind == "ptt":
                active = event.get("active", False)
                if active:
                    sd.stop()
                    recorder.start()
                else:
                    audio = recorder.stop()
                    threading.Thread(target=send_audio, args=(base_http, visitor_id, audio), daemon=True).start()

if __name__ == "__main__":
    main()
