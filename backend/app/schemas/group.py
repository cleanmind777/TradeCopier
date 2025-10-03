from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional, Dict, Any
from datetime import datetime
from uuid import UUID
import json

class GroupCreate(BaseModel):
    user_id: UUID
    name: str

class GroupNameChange(BaseModel):
    group_id: UUID
    new_name: str

class GroupAddBroker(BaseModel):
    group_id: UUID
    sub_brokers: list[UUID]

class GroupSetQTY (BaseModel):
    group_id: UUID
    qty: int
