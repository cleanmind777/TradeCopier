import requests
import asyncio
import time
from typing import Any, Optional, Tuple
import httpx
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


# Lightweight in-memory TTL cache for GET endpoints that are polled frequently
_ttl_cache: dict[Tuple[str, str], Tuple[float, Any]] = {}
_DEFAULT_TTL_SECONDS = 2.0


async def _get_async_client() -> httpx.AsyncClient:
    # Module-level singleton client for connection reuse
    global _async_client
    try:
        client = _async_client  # type: ignore[name-defined]
    except NameError:
        _async_client = httpx.AsyncClient(
            timeout=10.0,
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=50),
            headers={"Connection": "keep-alive"},
        )
        client = _async_client
    return client


def _cache_get(key: Tuple[str, str]) -> Optional[Any]:
    cached = _ttl_cache.get(key)
    if not cached:
        return None
    expires_at, value = cached
    if time.time() < expires_at:
        return value
    # expired
    _ttl_cache.pop(key, None)
    return None


def _cache_set(key: Tuple[str, str], value: Any, ttl: float = _DEFAULT_TTL_SECONDS) -> None:
    _ttl_cache[key] = (time.time() + ttl, value)


async def _get_json(url: str, headers: dict[str, str], params: Optional[dict[str, Any]] = None) -> Optional[Any]:
    client = await _get_async_client()
    try:
        resp = await client.get(url, headers=headers, params=params)
        if resp.status_code == 200 and resp.content:
            try:
                return resp.json()
            except ValueError:
                return None
        return None
    except httpx.HTTPError:
        return None


async def get_account_list(access_token: str, is_demo: bool):
    headers = {
        "Authorization": f"Bearer {access_token}",
    }
    if is_demo:
        url = f"{TRADO_DEMO_URL}/account/list"
    else:
        url = f"{TRADO_LIVE_URL}/account/list"
    cache_key = ("account_list", f"{is_demo}:{access_token}")
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached
    data = await _get_json(url, headers)
    if data is not None:
        _cache_set(cache_key, data)
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
    cache_key = ("cashBalance_deps", f"{is_demo}:{access_token}:{account_id}")
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached
    data = await _get_json(url, headers, params=params)
    if data is not None:
        _cache_set(cache_key, data)
    return data


def get_renew_token(access_token: str) -> Tokens | None:
    headers = {"Authorization": f"Bearer {access_token}"}
    # Try DEMO first
    url_demo = f"{TRADO_DEMO_URL}/auth/renewaccesstoken"
    response = requests.get(url_demo, headers=headers)
    data = None
    if response.status_code == 200 and response.content:
        try:
            data = response.json()
        except ValueError:
            data = None
    if data is None:
        # Fallback: try LIVE
        url_live = f"{TRADO_LIVE_URL}/auth/renewaccesstoken"
        response = requests.get(url_live, headers=headers)
        if response.status_code == 200 and response.content:
            try:
                data = response.json()
            except ValueError:
                data = None
    if not data:
        return None
    tokens = Tokens(
        access_token=data["accessToken"], md_access_token=data["mdAccessToken"]
    )
    return tokens


async def get_position_list_of_live_account(access_token: str):
    headers = {"Authorization": f"Bearer {access_token}"}
    url = f"{TRADO_LIVE_URL}/position/list"
    cache_key = ("position_list", f"live:{access_token}")
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached
    data = await _get_json(url, headers)
    if data is not None:
        _cache_set(cache_key, data)
    return data


async def get_position_list_of_demo_account(access_token: str):
    headers = {"Authorization": f"Bearer {access_token}"}
    url = f"{TRADO_DEMO_URL}/position/list"
    cache_key = ("position_list", f"demo:{access_token}")
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached
    data = await _get_json(url, headers)
    if data is not None:
        _cache_set(cache_key, data)
    return data


async def get_order_list_of_demo_account(access_token: str):
    headers = {"Authorization": f"Bearer {access_token}"}
    url = f"{TRADO_DEMO_URL}/order/list"
    cache_key = ("order_list", f"demo:{access_token}")
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached
    data = await _get_json(url, headers)
    if data is not None:
        _cache_set(cache_key, data)
    return data


async def get_order_list_of_live_account(access_token: str):
    headers = {"Authorization": f"Bearer {access_token}"}
    url = f"{TRADO_LIVE_URL}/order/list"
    cache_key = ("order_list", f"live:{access_token}")
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached
    data = await _get_json(url, headers)
    if data is not None:
        _cache_set(cache_key, data)
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
    cache_key = ("contract_item", f"{is_demo}:{access_token}:{id}")
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached
    data = await _get_json(url, headers, params=params)
    if data is not None:
        _cache_set(cache_key, data)
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
    cache_key = ("contract_maturity_item", f"{is_demo}:{access_token}:{id}")
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached
    data = await _get_json(url, headers, params=params)
    if data is not None:
        _cache_set(cache_key, data)
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
    cache_key = ("product_item", f"{is_demo}:{access_token}:{id}")
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached
    data = await _get_json(url, headers, params=params)
    if data is not None:
        _cache_set(cache_key, data)
    return data


async def get_cash_balances(access_token: str, is_demo: bool):
    headers = {"Authorization": f"Bearer {access_token}"}
    if is_demo:
        url = f"{TRADO_DEMO_URL}/cashBalance/list"
    else:
        url = f"{TRADO_LIVE_URL}/cashBalance/list"
    cache_key = ("cashBalance_list", f"{is_demo}:{access_token}")
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached
    data = await _get_json(url, headers)
    if data is not None:
        _cache_set(cache_key, data)
    return data


def place_order(access_token: str, is_demo: bool, order):
    headers = {"Authorization": f"Bearer {access_token}"}
    def make_url(demo: bool) -> str:
        return f"{TRADO_DEMO_URL}/order/placeOrder" if demo else f"{TRADO_LIVE_URL}/order/placeOrder"
    url = make_url(is_demo)

    try:
        # order is expected to be a dict with accountId, accountSpec, symbol, orderQty, orderType, action, isAutomated
        payload = order if isinstance(order, dict) else order.dict()
        response = requests.post(url, headers=headers, json=payload)
        if response.status_code in (200, 201):
            if not response.content:
                return True
            try:
                data = response.json()
                return data
            except ValueError:
                # Handle malformed JSON
                return True
        # If unauthorized, retry once against the opposite venue in case is_demo flag is stale
        if response.status_code == 401:
            alt_url = make_url(not is_demo)
            response2 = requests.post(alt_url, headers=headers, json=payload)
            if response2.status_code in (200, 201):
                if not response2.content:
                    return True
                try:
                    data2 = response2.json()
                    return data2
                except ValueError:
                    return True
            try:
                body2 = response2.json()
            except ValueError:
                body2 = response2.text
            return {"error": True, "status": response2.status_code, "body": body2}
        # Handle non-200 response
        try:
            body = response.json()
        except ValueError:
            body = response.text
        return {"error": True, "status": response.status_code, "body": body}
    except requests.RequestException as e:
        # Log or handle request error
        return {"error": True, "exception": str(e)}


async def get_order_version_depends(id: int, access_token: str, is_demo: bool):
    headers = {
        "Authorization": f"Bearer {access_token}",
    }
    params = {"id": id}
    if is_demo:
        url = f"{TRADO_DEMO_URL}/orderVersion/item"
    else:
        url = f"{TRADO_LIVE_URL}/orderVersion/item"
    cache_key = ("orderVersion_item", f"{is_demo}:{access_token}:{id}")
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached
    data = await _get_json(url, headers, params=params)
    if data is not None:
        _cache_set(cache_key, data)
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
    if hasattr(order, 'dict'):
        order_dict = order.dict()
    else:
        order_dict = order
    response = requests.post(url, headers=headers, json=order_dict)
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
    if hasattr(order, 'dict'):
        order_dict = order.dict()
    else:
        order_dict = order
    response = requests.post(url, headers=headers, json=order_dict)
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
    if hasattr(order, 'dict'):
        order_dict = order.dict()
    else:
        order_dict = order
    response = requests.post(url, headers=headers, json=order_dict)
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