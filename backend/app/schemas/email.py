from pydantic import BaseModel, EmailStr
from datetime import datetime


class EmailRequest(BaseModel):
    email: EmailStr


class OTP(BaseModel):
    otp: str
    expire: datetime


class OTPVerifyRequest(EmailRequest):
    otp: str
