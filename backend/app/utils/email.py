import requests
import os
from app.core.config import settings


def send_otp_email(to_email, verify_code):
    data = {
        "service_id": settings.EMAILJS_SERVICE_ID,
        "template_id": settings.EMAILJS_OTP_TEMPLATE_ID,
        "user_id": settings.EMAILJS_PUBLIC_KEY,
        "template_params": {"email": to_email, "passcode": verify_code},
        "accessToken": settings.EMAILJS_RRIVATE_KEY,
    }
    header = {"content-type": "application/json"}
    response = requests.post(
        "https://api.emailjs.com/api/v1.0/email/send", headers=header, json=data
    )
    response.raise_for_status()
