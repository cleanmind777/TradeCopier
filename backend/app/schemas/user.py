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
    admin_role: bool


class UserInfo(UserBase):
    id: UUID
    created_at: datetime
    admin_role: bool

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


class UserData(BaseModel):
    id: UUID
    name: str
    email: str
    admin_role: bool
    created_at: datetime
    is_verified: bool
    is_accepted: bool


class UserFilter(BaseModel):
    id: Optional[UUID] = None
    name: Optional[str] = None
    email: Optional[str] = None
    admin_role: Optional[bool] = None
    created_at: Optional[datetime] = None
    is_verified: Optional[bool] = None
    is_accepted: Optional[bool] = None
