from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta

from app.schemas.user import (
    UserInfo,
)
from app.services.user_service import (
    get_user_info,
)
from app.dependencies.database import get_db
from app.core.config import settings

router = APIRouter()


@router.get("/me", response_model=UserInfo, status_code=status.HTTP_201_CREATED)
def get_User_info(user_id: str, db: Session = Depends(get_db)):
    return get_user_info(db, user_id)
