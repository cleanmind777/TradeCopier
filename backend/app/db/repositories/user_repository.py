from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from sqlalchemy.future import select
from app.models.user import User
from app.schemas.user import UserBase, UserRespond, UserFilter, UserData
from app.schemas.email import OTP
from app.core.security import hash_password
import json
import secrets
from datetime import datetime, timezone
from uuid import UUID


def get_user_by_email(db: Session, email: str) -> UserData:
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
    if db_user.otp_expire.astimezone(timezone.utc) < now:
        return 1
    return db_user


def get_users_by_filter(db: Session, user_filter: UserFilter) -> list[UserData]:
    query = select(User)
    # Filter by is_active if not "All"
    if user_filter.id != None:
        query = query.filter(User.id == user_filter.id)
    if user_filter.name != None:
        query = query.filter(User.name == user_filter.name)
    if user_filter.email != None:
        query = query.filter(User.email == user_filter.email)
    if user_filter.is_accepted != None:
        query = query.filter(User.is_accepted == user_filter.is_accepted)
    # db_user = db.query(User).all()
    result = db.execute(query)
    users = result.scalars().all()
    return users


def admin_accept_user(db: Session, id: UUID) -> bool:
    db_user = db.query(User).filter(User.id == id).first()
    if db_user == None:
        return False
    else:
        db_user.is_accepted = True
        db.commit()
        db.refresh(db_user)
    return True
