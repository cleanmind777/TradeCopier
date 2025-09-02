from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from app.models.user import User
from app.schemas.user import UserBase
from app.schemas.email import OTP
from app.core.security import hash_password
import json
import secrets
from datetime import datetime, timezone
from uuid import UUID


def get_user_by_email(db: Session, email: str) -> User:
    print(email)
    return db.query(User).filter(User.email == email).first()


def get_user_by_id(db: Session, user_id: str) -> User:
    return db.query(User).filter(User.id == user_id).first()


def create_user(db: Session, user_create: UserBase):
    db_user = User(
        email=user_create.email,
        name=user_create.name,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def user_create_otp_code(db: Session, email: str, otp: OTP):
    db_user = db.query(User).filter(User.email == email).first()
    db_user.otp_code = otp.otp
    db_user.otp_expire = otp.expire
    db.commit()
    db.refresh(db_user)
    return db_user


def user_verify_otp_code(db: Session, email: str, otp: str):
    db_user = db.query(User).filter(User.email == email).first()
    if db_user.otp_code != otp:
        return 0
    now = datetime.now(timezone.utc)
    print(now, db_user.otp_expire.astimezone(timezone.utc))
    if db_user.otp_expire.astimezone(timezone.utc) < now:
        return 1
    return db_user
