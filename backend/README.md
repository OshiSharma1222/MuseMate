# MuseMate backend (edge server)

FastAPI server that plays the "museum edge server" role described in the
root README: a SQLite artifact database, a local LLM (Qwen 3.5:4b via
Ollama) for narration and Q&A, local STT/TTS, visitor session tracking, and
a REST/WebSocket API the [curator dashboard](../dashboard) can read from
directly.

It imports the sibling [`ml/`](../ml) package for all inference (LLM/STT/TTS)
but owns everything stateful: the database, visitor sessions, taps,
queries, and the catalogue.

## Setup

```bash
cd backend
pip install -r requirements.txt
pip install -r ../ml/requirements.txt   # STT/TTS/LLM client deps -- see ml/README.md
cp .env.example .env                     # adjust if needed
```

Make sure Ollama is running with the model pulled:

```bash
ollama pull qwen3.5:4b
ollama serve
```

## Run

From the **repo root** (`E:\sihpart2`), so `ml` resolves as a sibling package:

```bash
uvicorn backend.app.main:app --reload --port 8000
```

On first start it creates `backend/app/data/musemate.db` and seeds it from
`backend/app/data/artifacts.json` (the National Museum, New Delhi-style
dummy catalogue). Restarting never overwrites curator edits made through
`PATCH /artifacts/:id`.

Try the console demo (needs a mic/speaker and the `ml` audio deps):

```bash
python backend/scripts/run_console_demo.py --lang en
```

## API

| Endpoint | Purpose |
|---|---|
| `POST /visitors` | Creates a new visitor id, returns a mode-selection prompt |
| `POST /visitors/{id}/mode` | Sets narration mode: `default`, `quick`, `detailed`, `child` |
| `POST /visitors/{id}/lang` | Changes the visitor's language mid-visit |
| `GET /visitors/{id}` | One visitor's full session (shape matches dashboard's `Session`) |
| `POST /visitors/{id}/end` | Ends the visit, optionally with a rating/review |
| `POST /visitors/{id}/tap` | Simulates an RFID tap (`{"nfcTag": "<uid or artifact id>"}`) -- stands in for the ESP32 until that hardware exists. Returns spoken narration (+ audio if TTS is enabled). |
| `POST /visitors/{id}/query/text` | Ask a text question (artifact Q&A or directions) |
| `POST /visitors/{id}/query/audio` | Upload a WAV/FLAC clip; runs STT -> the same answer path -> optional TTS reply |
| `GET /artifacts` / `GET /artifacts/{id}` | The catalogue |
| `PATCH /artifacts/{id}` | Curator edit (description, curator notes, history, provenance, ownership, verified, narrationLangs, ...) |
| `GET /sessions?from&to` | All visits in a time range, nested `stops -> queries`, for the dashboard |
| `WS /live` | Pushes `start` / `tap` / `query` / `end` events for the dashboard's live feed |

All of these mirror `dashboard/src/data/types.ts` exactly (see
[Wiring up the server](../README.md#wiring-up-the-server) in the root
README), so pointing `dashboard/src/data/store.ts` at this API instead of
its seeded generator should not require changing any dashboard page.

## How a query is answered

1. `query_router.answer_and_log` first checks if the question is a
   **directions** question (`core/topics.py::is_directions_query`). If so,
   it BFS-searches `core/directions_engine.py` over the graph in
   `app/data/directions.json`, anchored on the visitor's
   `last_tapped_artifact_id`'s gallery.
2. Otherwise it's an **artifact question**. If nothing has been tapped yet,
   the visitor is asked to tap an RFID tag first (`ml/llm/prompts.py`).
   Otherwise the tapped artifact's record is turned into a grounding
   "fact sheet" (`ml/llm/rag.py`), combined with a short interest-profile
   summary (`ml/llm/interest_profile.py`, built from this visitor's tap/topic
   history) and the last couple of Q&A turns at that stop, and sent to Qwen
   via `ml/llm/ollama_client.py`.
3. The question is tagged with a `topic` (`core/topics.py`, a keyword
   classifier matching the dashboard's `Topic` union) and a `status`:
   `declined` for market-value questions, `unanswered` for thin/unverified
   catalogue entries, `answered` otherwise.
4. Everything is logged to SQLite (`db/models.py`) and broadcast on `/live`.

## Known limitations (by design, for this software-only milestone)

- **No ESP32 yet**: `/tap` accepts a raw NFC UID or (for convenience) an
  artifact id directly. Swapping in the real reader is just pointing its
  WiFi POST at this same endpoint.
- **No hardware telemetry**: `dwellSec`, `listenedPct`, `replays` and
  `tapRetries` on a `Stop` stay at their defaults, since only the real
  handheld can measure how long narration actually played. The columns
  exist and are wired into the dashboard shape, ready for that data.
- **`textEn` translation**: only filled in when the visitor's language is
  already English. Wiring in IndicTrans2 (as the project README originally
  scoped) or asking the LLM itself to translate is a good next step for
  full dashboard fidelity.
- **Topic classification** is a keyword heuristic (`core/topics.py`), not a
  model call -- fast and deterministic, but will misclassify unusual
  phrasing. Good enough for stats at this catalogue size; revisit if this
  becomes a load-bearing dashboard metric.
