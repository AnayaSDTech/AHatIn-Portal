"""Follow-ups and student reference numbers."""

import re
from datetime import datetime, timedelta

from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.core.clock import add_working_hours, local_now, now
from app.db import get_db, new_id


async def next_reference() -> str:
    year = local_now().year
    doc = await get_db().counters.find_one_and_update(
        {"_id": f"student_ref_{year}"}, {"$inc": {"seq": 1}}, upsert=True, return_document=ReturnDocument.AFTER
    )
    return f"AH-{year}-{doc['seq']:05d}"


def first_contact_due(at: datetime) -> datetime:
    """New enquiry: 15 minutes in working hours; otherwise 11:00 the next working day."""
    local = at.astimezone(local_now().tzinfo)
    if local.weekday() != 6 and 10 <= local.hour < 19 and (local + timedelta(minutes=15)).hour < 19:
        return at + timedelta(minutes=15)
    nxt = local + timedelta(days=1) if local.hour >= 10 else local
    while nxt.weekday() == 6:
        nxt += timedelta(days=1)
    return nxt.replace(hour=11, minute=0, second=0, microsecond=0)


async def create_follow_up(
    *,
    counsellor_id: str | None,
    person: str,
    person_id: str,
    person_type: str,
    action: str,
    rule: str,
    due_at: datetime,
    type_: str,
    source_event: str | None = None,
) -> None:
    doc = {
        "_id": new_id(),
        "counsellorId": counsellor_id,
        "person": person,
        "personId": person_id,
        "personType": person_type,
        "action": action,
        "rule": rule,
        "dueAt": due_at,
        "type": type_,
        "done": False,
        "createdAt": now(),
    }
    if source_event:
        doc["sourceEvent"] = source_event
    try:
        await get_db().follow_ups.insert_one(doc)
    except DuplicateKeyError:
        pass


async def close_follow_ups(source_prefix: str) -> None:
    """Closes open follow-ups created by an event once the underlying work is done."""
    await get_db().follow_ups.update_many(
        {"sourceEvent": {"$regex": "^" + re.escape(source_prefix)}, "done": False}, {"$set": {"done": True, "doneAt": now()}}
    )


def one_working_day_from_now() -> datetime:
    return add_working_hours(now(), 9)
