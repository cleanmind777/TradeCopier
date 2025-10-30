import json
from typing import Any, Optional

from app.core.config import settings

try:
    from redis import asyncio as redis
except Exception:
    redis = None  # type: ignore

_redis_client: Optional["redis.Redis"] = None


async def get_redis_client() -> Optional["redis.Redis"]:
    global _redis_client
    if not settings.REDIS_URL or redis is None:
        return None
    if _redis_client is None:
        _redis_client = redis.from_url(settings.REDIS_URL, encoding="utf-8", decode_responses=True)
    return _redis_client


async def cache_get_json(key: str) -> Optional[Any]:
    client = await get_redis_client()
    if not client:
        return None
    val = await client.get(key)
    if val is None:
        return None
    try:
        return json.loads(val)
    except Exception:
        return None


async def cache_set_json(key: str, value: Any, ttl_seconds: int | None = None) -> None:
    client = await get_redis_client()
    if not client:
        return
    try:
        s = json.dumps(value, default=str)
        if ttl_seconds and ttl_seconds > 0:
            await client.set(key, s, ex=ttl_seconds)
        else:
            await client.set(key, s)
    except Exception:
        return


