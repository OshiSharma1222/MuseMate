#!/usr/bin/env python3
"""Console demo: plays the role of the (not-yet-built) ESP32 handheld.

This script only captures mic audio and plays back speaker audio locally --
every bit of intelligence (STT, LLM, TTS) runs on the backend, exactly like
the real handheld -> edge server split described in the project README.

Usage (from the repo root, with the backend running separately):
    python backend/scripts/run_console_demo.py
    python backend/scripts/run_console_demo.py --base-url http://localhost:8000 --lang hi

Commands at the prompt:
    <Enter>            record a spoken question from the mic
    tap <code>         simulate an RFID tap, e.g. "tap A007" or a raw NFC UID
    text <question>    type a question instead of speaking it
    end                finish the visit and give a rating
    quit               exit without ending the visit
"""

from __future__ import annotations

import argparse
import io
import sys
from pathlib import Path

import requests
import soundfile as sf

_REPO_ROOT = Path(__file__).resolve().parents[2]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from ml.audio import mic, speaker  # noqa: E402


def play_base64_audio(audio_b64: str | None, sample_rate: int | None) -> None:
    if not audio_b64:
        return
    import base64

    raw = base64.b64decode(audio_b64)
    audio, sr = sf.read(io.BytesIO(raw), dtype="float32")
    speaker.play(audio, sr or sample_rate or 22050)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://localhost:8000")
    parser.add_argument("--lang", default="en")
    parser.add_argument("--device-id", default="CONSOLE-01")
    args = parser.parse_args()

    base = args.base_url.rstrip("/")

    resp = requests.post(f"{base}/visitors", json={"deviceId": args.device_id, "lang": args.lang})
    resp.raise_for_status()
    visitor = resp.json()
    visitor_id = visitor["visitorId"]
    print(f"\nVisitor id: {visitor_id}")
    print(visitor["prompt"])

    mode = input("Mode [default/quick/detailed/child]: ").strip() or "default"
    requests.post(f"{base}/visitors/{visitor_id}/mode", json={"mode": mode}).raise_for_status()
    print(f"Mode set to '{mode}'. You're all set -- tap an artifact to begin.\n")

    while True:
        cmd = input("[Enter]=speak, 'tap <code>', 'text <question>', 'end', 'quit' > ").strip()

        if cmd == "quit":
            break

        if cmd == "end":
            rating = input("Rating 1-5 (blank to skip): ").strip()
            review = input("Any comments? (blank to skip): ").strip()
            payload = {}
            if rating:
                payload["rating"] = int(rating)
            if review:
                payload["reviewText"] = review
                payload["reviewTextEn"] = review
            requests.post(f"{base}/visitors/{visitor_id}/end", json=payload).raise_for_status()
            print("Visit ended. Thank you!")
            break

        if cmd.startswith("tap "):
            code = cmd[len("tap "):].strip()
            r = requests.post(f"{base}/visitors/{visitor_id}/tap", json={"nfcTag": code})
            if r.status_code != 200:
                try:
                    detail = r.json().get('detail', r.text)
                except Exception:
                    detail = r.text or f"HTTP {r.status_code} (server may be restarting)"
                print(f"  ! {detail}")
                continue
            data = r.json()
            print(f"  Tapped: {data['name']} ({data['gallery']})")
            print(f"  Narration: {data['narration']}")
            play_base64_audio(data.get("audioBase64"), data.get("sampleRate"))
            continue

        if cmd.startswith("text "):
            question = cmd[len("text "):].strip()
            r = requests.post(f"{base}/visitors/{visitor_id}/query/text", json={"text": question})
            data = r.json()
            print(f"  Answer [{data['topic']}/{data['status']}]: {data['answer']}")
            continue

        if cmd == "":
            print("  Listening... speak now.")
            audio = mic.record_utterance()
            if audio.size == 0:
                print("  (heard nothing)")
                continue
            buf = io.BytesIO()
            sf.write(buf, audio, mic.SAMPLE_RATE, format="WAV")
            buf.seek(0)
            r = requests.post(
                f"{base}/visitors/{visitor_id}/query/audio",
                files={"file": ("clip.wav", buf, "audio/wav")},
            )
            if r.status_code != 200:
                print(f"  ! {r.json().get('detail', r.text)}")
                continue
            data = r.json()
            print(f"  You said: {data['transcript']}")
            print(f"  Answer [{data['topic']}/{data['status']}]: {data['answer']}")
            play_base64_audio(data.get("audioBase64"), data.get("sampleRate"))
            continue

        print("  Unrecognised command.")


if __name__ == "__main__":
    main()
