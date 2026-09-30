# `ml/` — local inference engines

Pure Python inference wrappers with **no FastAPI/DB dependency**, so they can
be unit-tested, reused, or swapped independently of `backend/`.

| Module | Purpose | Engine |
|---|---|---|
| `llm/ollama_client.py` | Streaming chat client | Ollama, model `qwen3.5:4b` |
| `llm/prompts.py` | System prompts per mode × language | — |
| `llm/rag.py` | Builds grounded context from artifact/direction dicts | — |
| `llm/interest_profile.py` | Visitor topic/gallery affinity summary | — |
| `stt/whisper_backend.py` | Speech-to-text | faster-whisper (`medium`) |
| `tts/indic_parler_backend.py` | Text-to-speech, 8 Indian languages + English | AI4Bharat `indic-parler-tts` |
| `tts/piper_backend.py` | Text-to-speech fallback, French/German | Piper |
| `tts/router.py` | Picks the right TTS backend per language | — |
| `audio/mic.py`, `audio/speaker.py` | Local mic capture (VAD-gated) / playback | sounddevice, webrtcvad |

## Install

```bash
cd ml
pip install -r requirements.txt
pip install git+https://github.com/huggingface/parler-tts.git   # Indic Parler-TTS
```

Pick a PyTorch build matching your hardware (CPU or CUDA) from
https://pytorch.org/get-started/locally/ *before* the line above if you want GPU acceleration.

Ollama must be running locally with the model already pulled:

```bash
ollama pull qwen3.5:4b
ollama serve   # if not already running as a service
```

For Piper (French/German voices), download voice models from
https://github.com/rhasspy/piper/blob/master/VOICES.md, e.g. `fr_FR-siwis-medium.onnx`
and `de_DE-thorsten-medium.onnx`, and point `PiperTTS(voice_models={...})` at them.

## Why these choices

See the root `README.md` implementation plan for the full comparison table.
Short version: faster-whisper covers all 11 dashboard languages with one
model and decent CPU-only latency; Indic Parler-TTS is the best linguistic
match for the 8 Indian languages the museum actually serves; Piper plugs the
two remaining European languages with a tiny, fast model.

## Swapping engines later

Every engine sits behind a small interface (`stt/base.py::Transcriber`,
`tts/base.py::Synthesizer`). To swap faster-whisper for an AI4Bharat
IndicWhisper checkpoint, or add a Vosk fallback, implement the interface and
change one line in `backend/app/config.py` — no other file needs to change.
