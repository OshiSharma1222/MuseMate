"""Serial bridge between the ESP32 (USB/CP210x) and the MuseMate back-end.

The ESP32 sends newline-terminated ASCII frames at 115 200 baud:

    READY,RFID_PTT,1          – boot greeting (logged, not forwarded)
    MFRC522_VERSION,<hex>     – chip version  (logged, not forwarded)
    TAG,<UID>,<PICC type>     – RFID tap      → triggers tap API
    PTT_PRESS                 – touch pressed → calls on_ptt(True)
    PTT_RELEASE               – touch released→ calls on_ptt(False)
    ERROR,*                   – read error    (logged)

Auto-detects the first Silicon Labs CP210x port (VID 0x10C4) if
RFID_COM_PORT is not set in the environment.  Set it explicitly when
multiple CP210x devices are present:

    RFID_COM_PORT=COM5

The class is intentionally framework-agnostic: it just calls the
callbacks you pass in, so it works regardless of the FastAPI lifespan
setup around it.
"""

from __future__ import annotations

import os
import re
import threading
from typing import Callable, Optional

import serial
from serial import SerialException
from serial.tools import list_ports

# ── env config ──────────────────────────────────────────────────────────────
RFID_COM_PORT: str | None = os.getenv("RFID_COM_PORT")
SERIAL_BAUD: int = int(os.getenv("RFID_BAUD", "115200"))

# Regex for a valid NFC UID (4-10 colon-separated hex bytes, e.g. 04:A1:B2:C3)
_UID_RE = re.compile(r"^[0-9A-F]{2}(?::[0-9A-F]{2}){3,9}$")


def _normalise_uid(raw: str) -> str:
    uid = raw.strip().upper().replace("-", ":").replace(" ", ":")
    uid = re.sub(r":+", ":", uid)
    if not _UID_RE.fullmatch(uid):
        raise ValueError(f"Malformed UID: {raw!r}")
    return uid


class SerialReader:
    """Background thread that reads lines from the ESP32 and dispatches them."""

    def __init__(
        self,
        on_tag: Callable[[str], None],
        on_ptt: Callable[[bool], None] | None = None,
    ) -> None:
        self.on_tag = on_tag
        self.on_ptt = on_ptt
        self._stop = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._port: Optional[serial.Serial] = None

    # ── public API ──────────────────────────────────────────────────────────

    def start(self) -> None:
        self._thread = threading.Thread(target=self._run, daemon=True, name="serial-reader")
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._port is not None:
            try:
                self._port.close()
            except Exception:
                pass
        if self._thread is not None:
            self._thread.join(timeout=3)

    # ── internals ───────────────────────────────────────────────────────────

    @staticmethod
    def _detect_port() -> str:
        if RFID_COM_PORT:
            return RFID_COM_PORT
        candidates = [p.device for p in list_ports.comports() if p.vid == 0x10C4]
        if len(candidates) == 1:
            return candidates[0]
        if len(candidates) > 1:
            raise RuntimeError(
                f"Multiple CP210x ports found: {candidates}. "
                "Set RFID_COM_PORT=COMx to pick one."
            )
        raise RuntimeError(
            "No CP210x (Silicon Labs) port found and RFID_COM_PORT is not set."
        )

    def _run(self) -> None:
        while not self._stop.is_set():
            try:
                port = self._detect_port()
                self._port = serial.Serial(port=port, baudrate=SERIAL_BAUD, timeout=1)
                print(f"[serial] ESP32 connected on {port} @ {SERIAL_BAUD} baud", flush=True)

                while not self._stop.is_set():
                    raw = self._port.readline()
                    if not raw:
                        continue
                    line = raw.decode("utf-8", errors="replace").strip()
                    if line:
                        self._dispatch(line)

            except (SerialException, RuntimeError) as exc:
                print(f"[serial] {exc} — retrying in 2 s", flush=True)
                self._stop.wait(2)
            finally:
                if self._port is not None:
                    try:
                        self._port.close()
                    except Exception:
                        pass
                    self._port = None

    def _dispatch(self, line: str) -> None:
        # PTT events (no comma)
        if line == "PTT_PRESS":
            if self.on_ptt:
                self.on_ptt(True)
            return
        if line == "PTT_RELEASE":
            if self.on_ptt:
                self.on_ptt(False)
            return

        parts = line.split(",", 2)
        verb = parts[0]

        if verb == "TAG" and len(parts) >= 2:
            raw_uid = parts[1].strip()
            try:
                uid = _normalise_uid(raw_uid)
                self.on_tag(uid)
            except ValueError as exc:
                print(f"[serial] Ignoring bad UID: {exc}", flush=True)
            return

        # Informational frames — just log them
        print(f"[serial] ESP32: {line}", flush=True)
