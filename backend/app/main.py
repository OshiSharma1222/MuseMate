"""FastAPI app entrypoint.

Run from the repo root (`E:\\sihpart2`) so both `backend` and the sibling
`ml` package resolve as top-level imports:

    uvicorn backend.app.main:app --reload --port 8000

Serial bridge
─────────────
On startup the app auto-detects the ESP32 on the first CP210x (Silicon Labs)
USB-UART port and starts a background thread that reads:
  TAG,<UID>,<type>   → calls the internal tap helper for the kiosk session
  PTT_PRESS/RELEASE  → broadcasts a {kind: "ptt", active: bool} WS event

Override the port with:  RFID_COM_PORT=COM5  (in .env or environment).
"""

from __future__ import annotations

import asyncio
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

# Make the repo root importable as a package root, so `import ml...` works
# regardless of the working directory uvicorn was launched from.
_REPO_ROOT = Path(__file__).resolve().parents[2]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from .config import get_settings  # noqa: E402
from .core.live_feed import live_feed  # noqa: E402
from .core.serial_reader import SerialReader  # noqa: E402
from .db.init_db import init_db  # noqa: E402
from .routers import artifacts, live, query, sessions, taps, visitors, kiosk  # noqa: E402

def _on_tag(uid: str) -> None:
    """Called from the serial reader thread when a TAG line is received."""
    print(f"[serial] Hardware tap detected: {uid}", flush=True)
    asyncio.run_coroutine_threadsafe(
        live_feed.broadcast({"kind": "hardware_tap", "uid": uid}),
        _loop,
    )



def _on_ptt(pressed: bool) -> None:
    """Called from the serial reader thread on PTT_PRESS / PTT_RELEASE."""
    asyncio.run_coroutine_threadsafe(
        live_feed.broadcast({"kind": "ptt", "active": pressed}),
        _loop,
    )


_loop: asyncio.AbstractEventLoop  # captured in lifespan
_serial_reader: SerialReader | None = None


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    global _loop, _serial_reader
    init_db()
    _loop = asyncio.get_running_loop()

    _serial_reader = SerialReader(on_tag=_on_tag, on_ptt=_on_ptt)
    try:
        _serial_reader.start()
        print("[serial] Reader started.", flush=True)
    except Exception as exc:  # noqa: BLE001
        print(f"[serial] Could not start serial reader: {exc}", flush=True)

    yield

    if _serial_reader is not None:
        _serial_reader.stop()


app = FastAPI(title="MuseMate Edge Server", version="0.1.0", lifespan=lifespan)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(visitors.router)
app.include_router(taps.router)
app.include_router(query.router)
app.include_router(artifacts.router)
app.include_router(sessions.router)
app.include_router(live.router)
app.include_router(kiosk.router)


# startup is now handled by the lifespan context manager above.


@app.get("/health")
def health():
    return {"status": "ok"}
