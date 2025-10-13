import requests
import os
from app.core.config import settings
from app.schemas.broker import BrokerConnect, RespondTradoVate


def getAccessTokenForTradoVate(broker_connect: BrokerConnect) -> RespondTradoVate:
    data = {
        "name": broker_connect.name,
        "password": broker_connect.password,
        "appId": settings.APP_ID,
        "appVersion": settings.APP_VERSION,
        "cid": settings.CID,
        "sec": settings.SEC,
    }
    header = {"content-type": "application/json"}
    response = requests.post(
        f"{settings.TRADOVATE_LIVE_API_URL}/auth/accesstokenrequest",
        headers=header,
        json=data,
    )
    return response.data

def get_access_token_for_websocket(username: str, password: str):
    payload = {
        "name": username,
        "password": password,
        "environment": "demo",
        "appId": "tradovate_trader(web)",
        "appVersion": "3.251003.0",
        "deviceId": "3b6b76f6-4464-7092-9409-dc3981a1318c",
        "cid": "1",
        "chl": "179049855469",
        "sec": "90cf58560437a76451567392df55d8f5e924c73c62e165c6bd8992d0a8382adb",
        "enc": True
    }
    header = {"content-type": "application/json"}
    response = requests.post(
        f"{settings.TRADOVATE_LIVE_API_URL}/auth/accesstokenrequest",
        headers=header,
        json=payload,
    )
    if response.status_code == 200:
        data = response.json()
        return {"access_token": data['accessToken'], "md_access_token": data['mdAccessToken']}
    else:
        return None