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
        f"{settings.TRADOVATE_API_URL}/auth/accesstokenrequest",
        headers=header,
        json=data,
    )
    return response.data
