from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class UserContractCreate(BaseModel):
    user_id: UUID
    symbol: str


class UserContractInfo(BaseModel):
    id: UUID
    user_id: UUID
    symbol: str
    created_at: datetime

    class Config:
        from_attributes = True


class UserContractResponse(BaseModel):
    id: UUID
    symbol: str
    created_at: datetime

    class Config:
        from_attributes = True

