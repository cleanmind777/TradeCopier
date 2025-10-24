from sqlalchemy.orm import Session
from sqlalchemy.future import select
from fastapi import HTTPException, status, BackgroundTasks
import json
from uuid import UUID
from datetime import datetime, date, time
import databento as db

async def symbol_price_stream(request: Request, symbol: str):
    ws_url = f"wss://provider.example.com/price-feed?symbol={symbol}"  # Use correct provider syntax
    try:
        async with websockets.connect(ws_url) as ws:
            while True:
                if await request.is_disconnected():
                    break
                msg = await ws.recv()
                yield f"data: {msg}\n\n"
    except Exception:
        yield "data: error\n\n"