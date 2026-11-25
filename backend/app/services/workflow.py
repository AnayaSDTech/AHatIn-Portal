"""Follow-ups and student reference numbers."""

import re
from datetime import datetime, timedelta

from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.core import policy
from app.core.clock import add_working_hours, local_now, now
from app.db import get_db, new_id


async def next_reference() -> str:
    year = local_now().year
    doc = await get_db().counters.find_one_and_update(
        {"_id": f"student_ref_{year}"}, {"$inc": {"seq": 1}}, upsert=True, return_document=ReturnDocument.AFTER
    )
    return f"AH-{year}-{doc['seq']:05d}"


def first_contact_due(at: datetime) -> datetime:
    """New enquiry: within N minutes during working hours; otherwise by a set time on the next working day (Settings page)."""
    rules = policy.current()
    wh, fu = rules["workingHours"], rules["followUps"]
    days = set(wh["days"]) or {0, 1, 2, 3, 4, 5}
    start, end = policy.minutes(wh["start"]), policy.minutes(wh["end"])
    local = at.astimezone(local_now().tzinfo)
    mins = local.hour * 60 + local.minute
    working_day = local.weekday() in days
    if working_day and start <= mins and mins + fu["firstContactMinutes"] < end:
        return at + timedelta(minutes=fu["firstContactMinutes"])
    # Before opening on a working day: later that morning. Otherwise: the next working day.
    nxt = local if working_day and mins < start else local + timedelta(days=1)
    while nxt.weekday() not in days:
        nxt += timedelta(days=1)
    h, m = (int(x) for x in fu["firstContactNextDay"].split(":"))
    return nxt.replace(hour=h, minute=m, second=0, microsecond=0)


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


def working_days_from_now(days: float) -> datetime:
    """`days` full working days from now (a working day is as long as the working hours on the Settings page)."""
    return add_working_hours(now(), days * policy.working_day_hours())


def one_working_day_from_now() -> datetime:
    return working_days_from_now(1)
