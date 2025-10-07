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

class GroupEdit(BaseModel):
    id: UUID
    name: str
    qty: int
    sub_brokers: list[SubBrokersWithQty]

class GroupInfo(BaseModel):
    id: UUID
    name: str
    qty: int
    sub_brokers: list[SubBrokerSumary]

class GroupNameChange(BaseModel):
    group_id: UUID
    new_name: str

class GroupAddBroker(BaseModel):
    group_id: UUID
    sub_brokers: list[SubBrokersWithQty]

class GroupSetQTY (BaseModel):
    group_id: UUID
    qty: int
