from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional, Dict, Any
from datetime import datetime
from uuid import UUID
import json


class UserBase(BaseModel):
    email: EmailStr
    name: str


class UserRespond(UserBase):
    id: UUID


class UserInfo(UserBase):
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


class UserResponse(UserBase):
    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str
    account_id: str


class TokenData(BaseModel):
    email: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
