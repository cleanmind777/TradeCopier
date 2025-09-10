import requests
from app.core.config import settings

CLIENT_ID = settings.CID
REDIRECT_URI = settings.TRADOVATE_REDIRECT_URL
AUTH_URL = settings.TRADOVATE_AUTH_URL
TRADO_LIVE_URL = settings.TRADOVATE_LIVE_API_URL
TRADO_DEMO_URL = settings.TRADOVATE_DEMO_API_URL


def get_auth_url():
    return f"{AUTH_URL}?response_type=code&client_id={CLIENT_ID}&redirect_uri={REDIRECT_URI}"


async def get_account_list(access_token: str, is_demo: bool):
    headers = {
        "Authorization": f"Bearer {access_token}",
    }
    if is_demo:
        url = f"{TRADO_DEMO_URL}/account/list"
    else:
        url = f"{TRADO_LIVE_URL}/account/list"
    response = requests.get(url, headers=headers)
    data = response.json()
    print("Account List: ", data)
    return data


async def get_account_balance(access_token: str, account_id: str, is_demo: bool):
    headers = {
        "Authorization": f"Bearer {access_token}",
    }
    params = {id: id}
    if is_demo:
        url = f"{TRADO_DEMO_URL}/cashBalance/deps"
    else:
        url = f"{TRADO_LIVE_URL}/cashBalance/deps"
    response = requests.get(url, headers=headers, params=params)
    data = response.json()
    print("Account Balance: ", data)
    return data
