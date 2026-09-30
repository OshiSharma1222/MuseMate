"""WebSocket the dashboard subscribes to for its live feed of
start/tap/query/end events (see dashboard/src/data/store.ts::FeedEvent).
"""

from __future__ import annotations

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..core.live_feed import live_feed

router = APIRouter(tags=["live"])


@router.websocket("/live")
async def live_ws(ws: WebSocket):
    await live_feed.connect(ws)
    try:
        while True:
            # The dashboard doesn't need to send anything; just keep the socket open.
            await ws.receive_text()
    except WebSocketDisconnect:
        live_feed.disconnect(ws)
