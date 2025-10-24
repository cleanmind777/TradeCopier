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

router = APIRouter()

@router.post("/sse/current-price")
async def sse_endpoint(request: Request, data: Symbols):
    return StreamingResponse(databento_price_stream(request, data.symbols), media_type="text/event-stream")
