from sqlalchemy.orm import Session
from sqlalchemy.future import select
from fastapi import HTTPException, status, BackgroundTasks, Request
import json
from uuid import UUID
from datetime import datetime, date, time
import asyncio
import databento as db
from app.core.config import settings
from app.utils.databento import convert_rawsymbol_intrument_id

async def databento_price_stream(request: Request, symbols: list[str]):
    # Initialize Databento live client with your API key
    client = db.Live(key=settings.DATABENTO_KEY)

    # Subscribe to the desired symbol
    client.subscribe(
        dataset="GLBX.MDP3",
        schema="mbp-1",
        stype_in="raw_symbol",
        symbols=symbols,
    )

    # Start streaming data (blocking generator)
    stream = client.start()

    try:
        for record in stream:
            # Check if client disconnected
            if await request.is_disconnected():
                break

            # Format the record as JSON string or plain text
            data_str = record.asdict()  # Convert record object to dict
            print(f"data: {data_str}\n\n")
            # You can improve formatting here (e.g., JSON serialize)
            yield f"data: {data_str}\n\n"

            # Yield control to event loop
            await asyncio.sleep(0)
    except Exception as e:
        # optionally log or handle errors
        print(f"Error in stream: {e}")
