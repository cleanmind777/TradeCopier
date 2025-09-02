from sqlalchemy.orm import Session
from fastapi import HTTPException, status, BackgroundTasks
from app.db.repositories.user_repository import (
    get_user_by_id,
    get_user_by_email,
    create_user,
    user_create_otp_code,
    user_verify_otp_code,
)
from app.utils.email import send_otp_email
from app.utils.otp import generate_otp
from app.schemas.user import UserBase
from app.models.user import User
from app.schemas.email import OTP
import json
from uuid import UUID
from datetime import datetime, date, time


def get_user_info(db: Session, user_id) -> User:
    return get_user_by_id(db, user_id)


def register_user(db: Session, user_create: UserBase) -> User:
    return create_user(db, user_create)


def authenticate_user(db: Session, email: str) -> User | None:
    user = get_user_by_email(db, email)
    if not user:
        return None
    else:
        otp_data = generate_otp()
        user_create_otp_code(db, email, otp_data)
        send_otp_email(email, otp_data.otp)
        print(otp_data)
    return user


def verify_otp(db: Session, email: str, otp: str) -> int | User | None:
    user = get_user_by_email(db, email)
    print(user)
    if not user:
        return None
    return user_verify_otp_code(db, email, otp)


def get_account_id(db: Session, email: str) -> str:
    user = get_user_by_email(db, email)
    return user.id
