"""Background jobs: sending queued emails, escalating overdue follow-ups, reminders and clean-up.

Runs inside the API process when RUN_BACKGROUND_JOBS=true (development, single server), or on its own with
`python -m app.worker` (production: one worker next to any number of API instances). Each job takes a lock,
so running it in several places at once is safe.
"""

import asyncio
import logging
from datetime import timedelta

from app.config import get_settings
from app.core.clock import local_dt, now, today, today_iso
from app.core.locks import lock
from app.core.errors import ApiError
from app.db import ensure_indexes, get_db
from app.services import notify, storage
from app.services.calendar import format_date
from app.services.team import owner_for
from app.services.workflow import create_follow_up

log = logging.getLogger("ahat.worker")


async def escalate_overdue() -> None:
    """Overdue follow-ups alert the managers once."""
    db = get_db()
    async for f in db.follow_ups.find({"done": False, "dueAt": {"$lt": now()}, "escalatedAt": None}).limit(50):
        c = await db.users.find_one({"_id": f["counsellorId"]}, {"name": 1})
        await notify.email_admins(
            f"Overdue follow-up: {f['person']}",
            f"{f['action']} ({f['person']}) for {c['name'] if c else 'an unassigned counsellor'} was due {f['dueAt']:%d %b %H:%M} UTC.\nRule: {f['rule']}",
            dedupe_key=f"escalate:{f['_id']}",
        )
        await db.follow_ups.update_one({"_id": f["_id"]}, {"$set": {"escalatedAt": now()}})


async def session_reminders() -> None:
    """Students get a reminder the day before a session (and on the day if it was booked late)."""
    db = get_db()
    soon = now() + timedelta(hours=24)
    async for s in db.sessions.find({"status": "booked", "startsAt": {"$gt": now(), "$lte": soon}, "remindedAt": None}).limit(100):
        student = await db.students.find_one({"_id": s["studentId"]})
        if student:
            await notify.email_student(
                student,
                f"Reminder: {s['type']} on {format_date(s['date'])} at {s['time']}",
                f"Your {s['type'].lower()} session is on {format_date(s['date'])} at {s['time']} IST "
                + (f"online. Join here: {get_settings().meeting_link}" if s["mode"] == "online" else "at the AHat office."),
                dedupe_key=f"remind:{s['_id']}:{s['date']}:{s['time']}",
            )
        await db.sessions.update_one({"_id": s["_id"]}, {"$set": {"remindedAt": now()}})


async def deadline_reminders() -> None:
    """Application and scholarship deadlines: follow-ups 14, 7 and 2 days before."""
    db = get_db()
    t = today()
    for days in (14, 7, 2):
        target = (t + timedelta(days=days)).isoformat()
        async for a in db.applications.find({"deadline": target, "state": "draft"}):
            s = await db.students.find_one({"_id": a["studentId"]})
            if not s:
                continue
            await create_follow_up(
                counsellor_id=s["counsellorId"], person=s["name"], person_id=s["_id"], person_type="student",
                action=f"Submit {a['university']} application (deadline in {days} days)", rule=f"Application deadline · {days} days before",
                due_at=local_dt(t.isoformat(), "18:00"), type_="reminder", source_event=f"deadline:app:{a['_id']}:{days}",
            )
            if days == 2:
                await notify.email_admins(f"Deadline in 2 days: {s['name']}", f"{a['university']} ({a['course']}) is still a draft; the deadline is {format_date(target)}.", dedupe_key=f"deadline:app:{a['_id']}:2")
        async for s in db.students.find({"journey.funding.scholarships": {"$elemMatch": {"deadline": target, "status": "to_apply"}}}):
            for sch in s["journey"]["funding"]["scholarships"]:
                if sch.get("deadline") == target and sch["status"] == "to_apply":
                    await create_follow_up(
                        counsellor_id=owner_for(s, "finance"), person=s["name"], person_id=s["_id"], person_type="student",
                        action=f"Remind about scholarship: {sch['name']} (deadline in {days} days)", rule=f"Scholarship deadline · {days} days before",
                        due_at=local_dt(t.isoformat(), "18:00"), type_="reminder", source_event=f"deadline:sch:{sch['id']}:{days}",
                    )
                    await notify.email_student(s, f"Scholarship deadline in {days} days", f"The deadline for {sch['name']} is {format_date(target)}.", dedupe_key=f"deadline:sch:{sch['id']}:{days}:student")


async def clean_up() -> None:
    db = get_db()
    # Files uploaded but never completed.
    async for up in db.uploads.find({"expiresAt": {"$lt": now()}}).limit(100):
        try:
            await storage.delete(up["key"])
        except Exception:  # noqa: BLE001
            log.warning("Could not delete abandoned upload %s", up["key"])
        await db.uploads.delete_one({"_id": up["_id"]})
    # Accounts registered but never confirmed within 7 days.
    cutoff = now() - timedelta(days=7)
    async for u in db.users.find({"role": "student", "emailVerifiedAt": None, "createdAt": {"$lt": cutoff}}).limit(50):
        record = await db.students.find_one({"userId": u["_id"]})
        if record:
            for coll in ("documents", "notes", "applications", "messages", "sessions"):
                await db[coll].delete_many({"studentId": record["_id"]})
            await db.follow_ups.delete_many({"personId": record["_id"]})
            await db.students.delete_one({"_id": record["_id"]})
        await db.users.delete_one({"_id": u["_id"]})


JOBS = [
    ("notifications", notify.send_due, 5),
    ("escalations", escalate_overdue, 60),
    ("session-reminders", session_reminders, 300),
    ("deadlines", deadline_reminders, 3600),
    ("clean-up", clean_up, 3600),
]


async def _loop(name: str, fn, every: int) -> None:
    while True:
        try:
            async with lock(f"job:{name}", timeout_seconds=0, ttl_seconds=max(every * 2, 60)):
                await fn()
        except ApiError:
            pass  # another process is running this job
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001 - keep the loop alive
            log.exception("Background job %s failed", name)
        await asyncio.sleep(every)


def start(loop_tasks: list) -> None:
    for name, fn, every in JOBS:
        loop_tasks.append(asyncio.create_task(_loop(name, fn, every)))


async def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    await ensure_indexes()
    tasks: list = []
    start(tasks)
    log.info("Worker running (%s jobs), today is %s", len(tasks), today_iso())
    await asyncio.gather(*tasks)


if __name__ == "__main__":
    asyncio.run(main())
