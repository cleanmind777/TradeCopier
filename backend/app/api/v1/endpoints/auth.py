from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
    Form,
    Response,
    BackgroundTasks,
)
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from datetime import timedelta
from app.models.user import User
from uuid import UUID
import json, random
from datetime import datetime

from app.schemas.user import UserBase, UserResponse, UserInfo, UserRespond
from app.schemas.oauth import TokenData
from app.schemas.email import EmailRequest, OTP, OTPVerifyRequest
from app.services.user_service import (
    authenticate_user,
    register_user,
    get_user_by_email,
    verify_otp,
)
from app.dependencies.database import get_db
from app.core.security import create_access_token
from app.core.config import settings
from app.utils.oauth import verify_token

router = APIRouter()

FRONTEND_URL = settings.FRONTEND_URL
OTP_EXPIRE_MINUTES = settings.OTP_EXPIRE_MINUTES


@router.post(
    "/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED
)
def sign_up(user_create: UserBase, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user_create.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    return register_user(db, user_create)


@router.post("/email-otp")
async def login(
    email: EmailRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    response = authenticate_user(db, email.email)
    if response == None:
        raise HTTPException(status_code=400, detail="You should register Account")
    elif response == False:
        raise HTTPException(
            status_code=400, detail="Your account has not yet been approved."
        )
    else:
        return "Plz verify email inbox"


@router.post("/verify-email-otp")
async def verify_otp_code(
    data: OTPVerifyRequest, db: Session = Depends(get_db)
) -> UserRespond:
    user = verify_otp(db, data.email, data.otp)
    if user == None:
        raise HTTPException(status_code=400, detail="You don't have Account")
    elif user == 0:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    elif user == 1:
        raise HTTPException(status_code=400, detail="OTP expired")
    else:
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.email}, expires_delta=access_token_expires
        )
        userinfo = get_user_by_email(db, user.email)
        # Set JWT in HttpOnly cookie
        user_info_model = UserInfo.from_orm(userinfo)
        response = JSONResponse(content=jsonable_encoder(user_info_model))
        response.set_cookie(
            key="access_token",
            value=f"Bearer {access_token}",
            domain=FRONTEND_URL.replace("https://", "").replace(
                "http://", ""
            ),  # Remove protocol
            httponly=True,
            secure=settings.ENVIRONMENT == "production",  # Set based on environment
            samesite="lax",  # Changed to lax for better compatibility
            max_age=1800,  # 30 minutes in seconds
        )
        response.set_cookie(
            key="refresh_token",
            value="your_refresh_token_value",
            domain=FRONTEND_URL.replace("https://", "").replace(
                "http://", ""
            ),  # Remove protocol
            httponly=True,
            secure=settings.ENVIRONMENT == "production",  # Set based on environment
            samesite="lax",  # Changed to lax for better compatibility
            max_age=86400,  # 24 hours
        )
        print(response.headers)
        return response


# Sign out with JWT is stateless; token invalidation requires blacklist (not implemented here)
@router.post("/signout")
def sign_out():
    return {"msg": "Sign out handled client-side by deleting the token"}


@router.post("/google", response_model=UserRespond)
async def google_login(token: str = Form(...), db: Session = Depends(get_db)):
    # 1. Verify Google ID token -> extract user details
    user_info = await verify_token(token)  # expects dict with email, name, picture etc.
    email = user_info.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Email not found in token")

    # 2. Fetch user from DB or create if not exists
    user = get_user_by_email(db, email)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found. Plz sign up")
        # OR auto-create:
        # user = User(email=email, name=user_info.get("name"), picture=user_info.get("picture"))
        # db.add(user); db.commit(); db.refresh(user)

    return user
