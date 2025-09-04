from sqlalchemy.orm import Session
from fastapi import HTTPException, status, BackgroundTasks
from app.db.repositories.user_repository import (
    get_user_by_id,
    get_user_by_email,
    create_user,
    user_create_otp_code,
    user_verify_otp_code,
    get_users_by_filter,
    admin_accept_user,
)
from app.utils.email import send_otp_email
from app.utils.otp import generate_otp
from app.schemas.user import UserBase
from app.models.user import User
from app.schemas.user import UserData, UserFilter
from app.schemas.email import OTP
import json
from uuid import UUID
from datetime import datetime, date, time


def get_users_data(db: Session, user_filter: UserFilter) -> list[UserData]:
    return get_users_by_filter(db, user_filter)


def accept_user(db: Session, id: UUID) -> bool | list[UserData]:
    return admin_accept_user(db, id)
