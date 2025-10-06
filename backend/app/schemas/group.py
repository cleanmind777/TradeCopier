from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional, Dict, Any
from datetime import datetime
from uuid import UUID
import json
from app.models.broker_account import SubBrokerAccount 

class GroupCreate(BaseModel):
    user_id: UUID
    name: str
    qty: int
    sub_brokers: list[UUID]

class GroupEdit(BaseModel):
    group_id: UUID
    name: str
    qty: int
    sub_brokers: list[UUID]

class GroupInfo(BaseModel):
    id: UUID
    name: str
    qty: int
    sub_brokers: list[SubBrokerAccount]
    class Config:
        arbitrary_types_allowed = True

class GroupNameChange(BaseModel):
    group_id: UUID
    new_name: str

class GroupAddBroker(BaseModel):
    group_id: UUID
    sub_brokers: list[UUID]

class GroupSetQTY (BaseModel):
    group_id: UUID
    qty: int
