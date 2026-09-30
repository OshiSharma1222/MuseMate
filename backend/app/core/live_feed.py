"""In-memory WebSocket fan-out for the dashboard's live feed.

Mirrors the shape of `FeedEvent` in `dashboard/src/data/store.ts`:
kind is "start" | "tap" | "query" | "end".
"""

from __future__ import annotations

import itertools
from typing import Any

from fastapi import WebSocket

_counter = itertools.count(1)


class LiveFeed:
    def __init__(self) -> None:
        self._connections: list[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self._connections.append(ws)

    def disconnect(self, ws: WebSocket) -> None:
        if ws in self._connections:
            self._connections.remove(ws)

    async def broadcast(self, event: dict[str, Any]) -> None:
        event = {"id": f"F{next(_counter)}", **event}
        dead: list[WebSocket] = []
        for ws in self._connections:
            try:
                await ws.send_json(event)
            except Exception:  # noqa: BLE001 - connection likely closed
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


live_feed = LiveFeed()
