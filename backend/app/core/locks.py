import asyncio
from contextlib import asynccontextmanager
from datetime import timedelta

from pymongo.errors import DuplicateKeyError

from app.core.clock import now
from app.core.errors import ApiError
from app.db import get_db


@asynccontextmanager
async def lock(name: str, timeout_seconds: float = 5.0, ttl_seconds: int = 30):
    """A simple distributed lock in MongoDB (works across API instances and the worker)."""
    db = get_db()
    waited = 0.0
    while True:
        try:
            await db.locks.insert_one({"_id": name, "expiresAt": now() + timedelta(seconds=ttl_seconds)})
            break
        except DuplicateKeyError:
            # Clear a lock left behind by a crashed process.
            await db.locks.delete_one({"_id": name, "expiresAt": {"$lt": now()}})
            if waited >= timeout_seconds:
                raise ApiError(409, "Someone else is updating this right now. Please try again.")
            await asyncio.sleep(0.05)
            waited += 0.05
    try:
        yield
    finally:
        await db.locks.delete_one({"_id": name})
