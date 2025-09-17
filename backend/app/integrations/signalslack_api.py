import requests
import os
from app.core.config import settings

URL = settings.SIGNAL_SLACK_URL


def get_token():
    data = {"secret": settings.SIGNAL_SLACK_SECRET}
    header = {"content-type": "application/json"}
    response = requests.post(f"{URL}/token", headers=header, json=data)
    data = response.json()
    return data
