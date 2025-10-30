import requests
from app.core.config import settings
from app.schemas.tradovate import (
    TradeDate,
    TradovateContractItemResponse,
    TradovateContractMaturityItemResponse,
    TradovateOrderListResponse,
    TradovatePositionListResponse,
    TradovateProductItemResponse,
    TradovateMarketOrder,
    TradovateLimitOrder,
    TradovateLimitOrderWithSLTP,
)

from app.schemas.broker import ExitPosition, Tokens

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
    return data


async def get_account_balance(access_token: str, account_id: str, is_demo: bool):
    headers = {
        "Authorization": f"Bearer {access_token}",
    }
    params = {"masterid": account_id}
    if is_demo:
        url = f"{TRADO_DEMO_URL}/cashBalance/deps"
    else:
        url = f"{TRADO_LIVE_URL}/cashBalance/deps"
    response = requests.get(url, headers=headers, params=params)
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


def get_renew_token(access_token: str) -> Tokens | None:
    headers = {"Authorization": f"Bearer {access_token}"}
    url = f"{TRADO_DEMO_URL}/auth/renewaccesstoken"
    response = requests.get(url, headers=headers)
    if response.status_code == 200 and response.content:
        try:
            data = response.json()
            print(data)
        except ValueError:
            # Log error or handle malformed JSON
            return None
    else:
        # Log error or handle non-200 statuses and empty responses gracefully
        return None
    tokens = Tokens(
        access_token=data["accessToken"], md_access_token=data["mdAccessToken"]
    )
    return tokens


def get_position_list_of_live_account(access_token: str):
    headers = {"Authorization": f"Bearer {access_token}"}
    url = f"{TRADO_LIVE_URL}/position/list"
    response = requests.get(url, headers=headers)
    if response.status_code == 200 and response.content:
        try:
            data = response.json()
            print(data)
        except ValueError:
            # Log error or handle malformed JSON
            return None
    else:
        # Log error or handle non-200 statuses and empty responses gracefully
        return None
    return data


def get_position_list_of_demo_account(access_token: str):
    headers = {"Authorization": f"Bearer {access_token}"}
    url = f"{TRADO_DEMO_URL}/position/list"
    response = requests.get(url, headers=headers)
    if response.status_code == 200 and response.content:
        try:
            data = response.json()
            print(data)
        except ValueError:
            # Log error or handle malformed JSON
            return None
    else:
        # Log error or handle non-200 statuses and empty responses gracefully
        return None
    return data


def get_order_list_of_demo_account(access_token: str):
    headers = {"Authorization": f"Bearer {access_token}"}
    url = f"{TRADO_DEMO_URL}/order/list"
    response = requests.get(url, headers=headers)
    if response.status_code == 200 and response.content:
        try:
            data = response.json()
            print(data)
        except ValueError:
            # Log error or handle malformed JSON
            return None
    else:
        # Log error or handle non-200 statuses and empty responses gracefully
        return None
    return data


def get_order_list_of_live_account(access_token: str):
    headers = {"Authorization": f"Bearer {access_token}"}
    url = f"{TRADO_LIVE_URL}/order/list"
    response = requests.get(url, headers=headers)
    if response.status_code == 200 and response.content:
        try:
            data = response.json()
            print(data)
        except ValueError:
            # Log error or handle malformed JSON
            return None
    else:
        # Log error or handle non-200 statuses and empty responses gracefully
        return None
    return data


async def get_contract_item(
    id: int, access_token: str, is_demo: bool
) -> TradovateContractItemResponse:
    headers = {
        "Authorization": f"Bearer {access_token}",
    }
    params = {"id": id}
    if is_demo:
        url = f"{TRADO_DEMO_URL}/contract/item"
    else:
        url = f"{TRADO_LIVE_URL}/contract/item"
    response = requests.get(url, headers=headers, params=params)
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


async def get_contract_maturity_item(
    id: int, access_token: str, is_demo: bool
) -> TradovateContractMaturityItemResponse:
    headers = {
        "Authorization": f"Bearer {access_token}",
    }
    params = {"id": id}
    if is_demo:
        url = f"{TRADO_DEMO_URL}/contractMaturity/item"
    else:
        url = f"{TRADO_LIVE_URL}/contractMaturity/item"
    response = requests.get(url, headers=headers, params=params)
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


async def get_product_item(
    id: int, access_token: str, is_demo: bool
) -> TradovateProductItemResponse:
    headers = {
        "Authorization": f"Bearer {access_token}",
    }
    params = {"id": id}
    if is_demo:
        url = f"{TRADO_DEMO_URL}/product/item"
    else:
        url = f"{TRADO_LIVE_URL}/product/item"
    response = requests.get(url, headers=headers, params=params)
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


def get_cash_balances(access_token: str, is_demo: bool):
    headers = {"Authorization": f"Bearer {access_token}"}
    if is_demo:
        url = f"{TRADO_DEMO_URL}/cashBalance/list"
    else:
        url = f"{TRADO_LIVE_URL}/cashBalance/list"
    response = requests.get(url, headers=headers)
    if response.status_code == 200 and response.content:
        try:
            data = response.json()
            print(data)
        except ValueError:
            # Log error or handle malformed JSON
            return None
    else:
        # Log error or handle non-200 statuses and empty responses gracefully
        return None
    return data


def place_order(access_token: str, is_demo: bool, order):
    print(access_token)
    print(is_demo)
    print(order)
    headers = {"Authorization": f"Bearer {access_token}"}
    url = (
        f"{TRADO_DEMO_URL}/order/placeOrder"
        if is_demo
        else f"{TRADO_LIVE_URL}/order/placeOrder"
    )

    try:
        # order is expected to be a dict with accountId, accountSpec, symbol, orderQty, orderType, action, isAutomated
        payload = order if isinstance(order, dict) else order.dict()
        response = requests.post(url, headers=headers, json=payload)
        if response.status_code in (200, 201):
            if not response.content:
                return True
            try:
                data = response.json()
                print(data)
                return data
            except ValueError:
                # Handle malformed JSON
                return True
        else:
            # Handle non-200 response
            try:
                body = response.json()
            except ValueError:
                body = response.text
            print(f"Exit order failed: {response.status_code} - {body}")
            return {"error": True, "status": response.status_code, "body": body}
    except requests.RequestException as e:
        # Log or handle request error
        return None


async def get_order_version_depends(id: int, access_token: str, is_demo: bool):
    headers = {
        "Authorization": f"Bearer {access_token}",
    }
    params = {"id": id}
    if is_demo:
        url = f"{TRADO_DEMO_URL}/orderVersion/item"
    else:
        url = f"{TRADO_LIVE_URL}/orderVersion/item"
    response = requests.get(url, headers=headers, params=params)
    if response.status_code == 200 and response.content:
        try:
            data = response.json()
            print("Data: ", data)
        except ValueError:
            # Log error or handle malformed JSON
            data = None
    else:
        # Log error or handle non-200 statuses and empty responses gracefully
        data = None
    return data


async def tradovate_execute_market_order(
    order: TradovateMarketOrder, access_token: str, is_demo: bool
):
    headers = {
        "Authorization": f"Bearer {access_token}",
    }
    if is_demo:
        url = f"{TRADO_DEMO_URL}/order/placeOrder"
    else:
        url = f"{TRADO_LIVE_URL}/order/placeOrder"
    print("Market Order: ", order)
    if hasattr(order, 'dict'):
        order_dict = order.dict()
    else:
        order_dict = order
    response = requests.post(url, headers=headers, json=order_dict)
    if response.status_code == 200 and response.content:
        try:
            data = response.json()
            print("Data: ", data)
        except ValueError:
            # Log error or handle malformed JSON
            data = None
    else:
        # Log error or handle non-200 statuses and empty responses gracefully
        data = None
    print(response.status_code)
    return data

async def tradovate_execute_limit_order(
    order: TradovateLimitOrder, access_token: str, is_demo: bool
):
    headers = {
        "Authorization": f"Bearer {access_token}",
    }
    if is_demo:
        url = f"{TRADO_DEMO_URL}/order/placeOrder"
    else:
        url = f"{TRADO_LIVE_URL}/order/placeOrder"
    print("Limit Order: ", order)
    if hasattr(order, 'dict'):
        order_dict = order.dict()
    else:
        order_dict = order
    response = requests.post(url, headers=headers, json=order_dict)
    if response.status_code == 200 and response.content:
        try:
            data = response.json()
            print("Data: ", data)
        except ValueError:
            # Log error or handle malformed JSON
            data = None
    else:
        # Log error or handle non-200 statuses and empty responses gracefully
        data = None
    print(response.status_code)
    return data

async def tradovate_execute_limit_order_with_sltp(
    order: TradovateLimitOrderWithSLTP, access_token: str, is_demo: bool
):
    headers = {
        "Authorization": f"Bearer {access_token}",
    }
    if is_demo:
        url = f"{TRADO_DEMO_URL}/order/placeoso"
    else:
        url = f"{TRADO_LIVE_URL}/order/placeoso"
    print("Limit Order with SLTP: ", order)
    if hasattr(order, 'dict'):
        order_dict = order.dict()
    else:
        order_dict = order
    response = requests.post(url, headers=headers, json=order_dict)
    if response.status_code == 200 and response.content:
        try:
            data = response.json()
            print("Data: ", data)
        except ValueError:
            # Log error or handle malformed JSON
            data = None
    else:
        # Log error or handle non-200 statuses and empty responses gracefully
        data = None
    print(response.status_code)
    return data