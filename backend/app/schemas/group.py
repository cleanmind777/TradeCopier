from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional, Dict, Any, List
from datetime import datetime
from uuid import UUID
import json
from app.schemas.broker import SubBrokerSumary, SubBrokersWithQty

class GroupCreate(BaseModel):
    user_id: UUID
    name: str
    sub_brokers: list[SubBrokersWithQty]
    sl: Optional[float] = 0.0
    tp: Optional[float] = 0.0

class GroupEdit(BaseModel):
    id: UUID
    name: str
    sub_brokers: list[SubBrokersWithQty]
    sl: Optional[float] = 0.0
    tp: Optional[float] = 0.0

class GroupInfo(BaseModel):
    id: UUID
    name: str
    sub_brokers: list[SubBrokerSumary]
    sl: Optional[float] = 0.0
    tp: Optional[float] = 0.0

class GroupNameChange(BaseModel):
    group_id: UUID
    new_name: str

class GroupAddBroker(BaseModel):
    group_id: UUID
    sub_brokers: list[SubBrokersWithQty]

