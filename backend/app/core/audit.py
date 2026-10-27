from typing import Any

from app.core.clock import now
from app.core.errors import trace_id_var
from app.db import get_db, new_id


async def audit(actor: dict | None, action: str, entity: str, entity_id: str, data: dict[str, Any] | None = None) -> None:
    """Append-only security log (logins, permission changes, verifications, corrections, decisions)."""
    await get_db().audit_log.insert_one(
        {
            "_id": new_id(),
            "at": now(),
            "actorId": actor["_id"] if actor else None,
            "actorRole": actor["role"] if actor else None,
            "action": action,
            "entity": entity,
            "entityId": entity_id,
            "data": data or {},
            "traceId": trace_id_var.get(),
        }
    )
