from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from uuid import UUID
from app.schemas.user import UserData, UserFilter
from app.services.admin_service import get_users_data, accept_user
from app.dependencies.database import get_db
from app.core.config import settings

router = APIRouter()


@router.post(
    "/token", response_model=list[UserData], status_code=status.HTTP_201_CREATED
)
def get_Users_data(user_filter: UserFilter, db: Session = Depends(get_db)):
    return get_users_data(db, user_filter)


@router.post("/accept-user", status_code=status.HTTP_201_CREATED)
def accept_User(data: dict, db: Session = Depends(get_db)):
    result = accept_user(db, data["id"])
    if result == False:
        raise HTTPException(
            status_code=400, detail="You don't have account. Plz register!"
        )
    else:
        return result
