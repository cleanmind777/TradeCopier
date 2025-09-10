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
    params = {"masterid": account_id}
    if is_demo:
        url = f"{TRADO_DEMO_URL}/cashBalance/item"
    else:
        url = f"{TRADO_LIVE_URL}/cashBalance/item"
    response = requests.get(url, headers=headers, params=params)
    print("111111111111111111111111111111111111111", response)
    if response.status_code == 200 and response.content:
        try:
            data = response.json()
        except ValueError:
            # Log error or handle malformed JSON
            data = None
    else:
        # Log error or handle non-200 statuses and empty responses gracefully
        data = None
    return data


def get_renew_token(access_token: str):
    headers = {"Authorization": f"Bearer {access_token}"}
    url = f"{TRADO_DEMO_URL}/auth/renewaccesstoken"
    response = requests.get(url, headers=headers)
    if response.status_code == 200 and response.content:
        try:
            data = response.json()
        except ValueError:
            # Log error or handle malformed JSON
            data = None
    else:
        # Log error or handle non-200 statuses and empty responses gracefully
        data = None
    return data
