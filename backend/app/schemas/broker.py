from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional, Dict, Any
from datetime import datetime
from uuid import UUID
import json


class BrokerBase(BaseModel):
    user_id: UUID
    nickname: Optional[str] = None
    type: str


class BrokerConnect(BrokerBase):
    name: str
    password: str


class BrokerAdd(BrokerBase):
    user_broker_id: str
    access_token: str
    expire_in: int


class BrokerInfo(BrokerBase):
    id: UUID
    last_sync: datetime
    status: bool


class RespondTradoVate(BaseModel):
    accessToken: str
    mdAccessToken: str
    userId: str


class BrokerFilter(BaseModel):
    id: Optional[UUID] = None
    user_id: Optional[UUID] = None
    nickname: Optional[str] = None
    type: Optional[str] = None
    status: Optional[bool] = None
