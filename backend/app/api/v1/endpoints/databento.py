from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from uuid import UUID
from app.dependencies.database import get_db
from app.core.config import settings
from app.services.databento_service import databento_price_stream
from fastapi.responses import StreamingResponse
from app.schemas.broker import Symbols
import databento as db
import asyncio, json
router = APIRouter()

# @router.post("/sse/current-price")
# async def sse_endpoint(request: Request, data: Symbols):
#     return StreamingResponse(databento_price_stream(request, data.symbols), media_type="text/event-stream")

user_subscriptions = {}


@router.post("/sse/current-price")
async def subscribe_symbols(request: Request, symbols_req: Symbols):
    # Save user's subscribed symbols keyed by client IP or session (sample: client host)
    client_host = request.client.host
    user_subscriptions[client_host] = symbols_req.symbols
    return {"message": "Subscribed to symbols", "symbols": symbols_req.symbols}

@router.get("/sse/current-price")
async def sse_price_stream(request: Request):
    client_host = request.client.host
    symbols = user_subscriptions.get(client_host)
    if not symbols:
        raise HTTPException(status_code=400, detail="No subscription found for client")

    async def event_generator():
        client = db.Live(key=settings.DATABENTO_KEY)
        client.subscribe(
            dataset="GLBX.MDP3",
            schema="trades",
            stype_in="parent",
            symbols=",".join(symbols)
        )
        stream = client.start()
        if stream is None:
            raise HTTPException(status_code=500, detail="Failed to start data stream")

        try:
            for record in stream:
                if await request.is_disconnected():
                    break
                data = record.asdict()
                event_name = data.get("symbol", "message")
                yield f"event: {event_name}\ndata: {json.dumps(data)}\n\n"
                await asyncio.sleep(0)
        except Exception as e:
            print(f"Stream error: {e}")

    return StreamingResponse(event_generator(), media_type="text/event-stream")