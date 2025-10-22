from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional, Dict, Any
from datetime import datetime
from uuid import UUID
import json

class SLTP(BaseModel):
    sl: float
    tp: float

class MarketOrder(BaseModel):
    group_id: UUID
    user_id: UUID
    symbol: str
    quantity: int
    action: str

class LimitOrder(MarketOrder):
    price: float

class LimitOrderWithSLTP(LimitOrder):
    sltp: SLTP