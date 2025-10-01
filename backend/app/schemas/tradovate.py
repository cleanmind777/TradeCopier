from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional, Dict, Any
from datetime import datetime
from uuid import UUID
import json

class TradovateOrderListResponse(BaseModel):
    id: int
    accountId: int
    contractId: int
    timestamp: datetime
    action: str
    ordStatus: str
    executionProviderId: int
    archived: bool
    external: bool
    admin: bool

class TradeDate(BaseModel):
    year: int
    month: int
    day: int

class TradovatePositionListResponse(BaseModel):
    id: int
    accountId: int
    contractId: int
    timestamp: datetime
    tradeDate: TradeDate
    netPos: int
    netPrice: float
    bought: int
    boughtValue: float
    sold: int
    soldValue: float
    archived: bool
    prevPos: int