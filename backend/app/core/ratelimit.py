from datetime import timedelta

from pymongo import ReturnDocument

from app.config import get_settings
from app.core.clock import now
from app.core.errors import ApiError
from app.db import get_db


async def hit(key: str, limit: int, window_seconds: int, message: str = "Too many requests. Please wait a little and try again.") -> None:
    """Fixed-window rate limit stored in MongoDB (expires automatically). Raises 429 when exceeded.
    Development allows 10x more, since testing means signing in and out a lot."""
    if get_settings().app_env == "development":
        limit *= 10
    t = now()
    window = int(t.timestamp()) // window_seconds
    doc = await get_db().rate_limits.find_one_and_update(
        {"_id": f"{key}:{window}"},
        {"$inc": {"count": 1}, "$setOnInsert": {"expiresAt": t + timedelta(seconds=window_seconds * 2)}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    if doc["count"] > limit:
        retry = window_seconds - int(t.timestamp()) % window_seconds
        raise ApiError(429, message, headers={"Retry-After": str(retry)})
