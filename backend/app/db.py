from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import ASCENDING, DESCENDING, IndexModel

from app.config import get_settings

_client: AsyncIOMotorClient | None = None


def client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(get_settings().mongodb_uri, tz_aware=True, uuidRepresentation="standard")
    return _client


def get_db() -> AsyncIOMotorDatabase:
    return client()[get_settings().mongodb_db]


def new_id() -> str:
    """Document IDs are ObjectId hex strings (sortable by creation time)."""
    return str(ObjectId())


INDEXES: dict[str, list[IndexModel]] = {
    "users": [
        IndexModel([("email", ASCENDING)], unique=True),
        IndexModel([("role", ASCENDING), ("status", ASCENDING)]),
    ],
    "students": [
        IndexModel([("userId", ASCENDING)], unique=True, partialFilterExpression={"userId": {"$type": "string"}}),
        IndexModel([("reference", ASCENDING)], unique=True),
        IndexModel([("counsellorId", ASCENDING), ("stage", ASCENDING)]),
        IndexModel([("email", ASCENDING)]),
        IndexModel([("mobileDigits", ASCENDING)]),
    ],
    "documents": [IndexModel([("studentId", ASCENDING), ("deletedAt", ASCENDING)]), IndexModel([("state", ASCENDING)])],
    "applications": [
        IndexModel([("studentId", ASCENDING)]),
        IndexModel([("studentId", ASCENDING), ("university", ASCENDING), ("course", ASCENDING)], unique=True),
    ],
    "notes": [IndexModel([("studentId", ASCENDING), ("at", DESCENDING)])],
    "sessions": [
        IndexModel([("counsellorId", ASCENDING), ("date", ASCENDING), ("status", ASCENDING)]),
        IndexModel([("studentId", ASCENDING), ("status", ASCENDING)]),
        IndexModel([("status", ASCENDING), ("startsAt", ASCENDING)]),
    ],
    # Short-lived locks so two bookings for the same counsellor and day are checked one at a time.
    "locks": [IndexModel([("expiresAt", ASCENDING)], expireAfterSeconds=0)],
    "time_off": [IndexModel([("counsellorId", ASCENDING), ("date", ASCENDING)])],
    "messages": [IndexModel([("studentId", ASCENDING), ("at", ASCENDING)]), IndexModel([("studentId", ASCENDING), ("from", ASCENDING), ("readAt", ASCENDING)])],
    "leads": [
        IndexModel([("counsellorId", ASCENDING), ("stage", ASCENDING)]),
        IndexModel([("email", ASCENDING)]),
        IndexModel([("mobileDigits", ASCENDING)]),
        IndexModel([("createdAt", DESCENDING)]),
    ],
    "follow_ups": [
        IndexModel([("counsellorId", ASCENDING), ("done", ASCENDING), ("dueAt", ASCENDING)]),
        IndexModel([("done", ASCENDING), ("dueAt", ASCENDING), ("escalatedAt", ASCENDING)]),
        IndexModel([("sourceEvent", ASCENDING)], unique=True, partialFilterExpression={"sourceEvent": {"$type": "string"}}),
    ],
    "access_grants": [IndexModel([("granteeId", ASCENDING), ("until", ASCENDING)])],
    "agencies": [IndexModel([("name", ASCENDING)], unique=True)],
    "otp_codes": [IndexModel([("expiresAt", ASCENDING)], expireAfterSeconds=0), IndexModel([("email", ASCENDING)], unique=True)],
    "staff_challenges": [IndexModel([("expiresAt", ASCENDING)], expireAfterSeconds=0)],
    "auth_sessions": [
        IndexModel([("tokenHash", ASCENDING)], unique=True),
        IndexModel([("userId", ASCENDING)]),
        IndexModel([("absoluteExpiresAt", ASCENDING)], expireAfterSeconds=0),
    ],
    "invites": [IndexModel([("tokenHash", ASCENDING)], unique=True), IndexModel([("expiresAt", ASCENDING)], expireAfterSeconds=0)],
    # Kept a day past expiry so the worker can delete abandoned files before the record goes.
    "uploads": [IndexModel([("expiresAt", ASCENDING)], expireAfterSeconds=86400)],
    "rate_limits": [IndexModel([("expiresAt", ASCENDING)], expireAfterSeconds=0)],
    "notifications": [
        IndexModel([("status", ASCENDING), ("sendAfter", ASCENDING)]),
        IndexModel([("dedupeKey", ASCENDING)], unique=True, partialFilterExpression={"dedupeKey": {"$type": "string"}}),
    ],
    "audit_log": [IndexModel([("entity", ASCENDING), ("entityId", ASCENDING), ("at", DESCENDING)]), IndexModel([("actorId", ASCENDING), ("at", DESCENDING)])],
}


async def ensure_indexes() -> None:
    db = get_db()
    for name, models in INDEXES.items():
        await db[name].create_indexes(models)
