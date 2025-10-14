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
    sl: float
    tp: float

class GroupEdit(BaseModel):
    id: UUID
    name: str
    sub_brokers: list[SubBrokersWithQty]
    sl: float
    tp: float

class GroupInfo(BaseModel):
    id: UUID
    name: str
    sub_brokers: list[SubBrokerSumary]
    sl: float
    tp: float

class GroupNameChange(BaseModel):
    group_id: UUID
    new_name: str

class GroupAddBroker(BaseModel):
    group_id: UUID
    sub_brokers: list[SubBrokersWithQty]

