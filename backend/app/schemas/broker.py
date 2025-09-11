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
    user_broker_id: str


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
    user_broker_id: Optional[str] = None


class SubBrokerAdd(BaseModel):
    user_id: UUID
    user_broker_id: str
    sub_account_id: str
    nickname: Optional[str] = None
    sub_account_name: str
    type: str
    account_type: str
    is_demo: bool
    status: bool


class SubBrokerInfo(SubBrokerAdd):
    id: UUID
    last_sync: datetime
    is_active: bool


class SubBrokerInfoPlus(SubBrokerInfo):
    balance: float


class SubBrokerFilter(BaseModel):
    id: Optional[UUID] = None
    user_id: Optional[UUID] = None
    user_broker_id: Optional[str] = None
    sub_account_id: Optional[str] = None
    nickname: Optional[str] = None
    sub_account_name: Optional[str] = None
    type: Optional[str] = None
    is_demo: Optional[bool] = None
    status: Optional[bool] = None
    is_active: Optional[bool] = None


class BrokerChange(BaseModel):
    id: UUID
    nickname: Optional[str] = None
    status: Optional[bool] = None


class SubBrokerChange(BaseModel):
    id: UUID
    nickname: Optional[str] = None
    is_active: Optional[bool] = None
