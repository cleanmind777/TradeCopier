from app.core.config import settings
from app.schemas.email import OTP
import random
from datetime import datetime, timedelta, timezone


def generate_otp() -> OTP:
    otp = "{:06d}".format(random.randint(0, 999999))
    expiry = datetime.now(timezone.utc) + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)
    otp_data = OTP(otp=otp, expire=expiry)
    return otp_data
