"""Assigning a counsellor to a student: automatically when the profile is complete (the best match with room), or by the
admin from the Assignments page. Both go through assign_counsellor, so the record, history and emails are the same.
The single Financial Aid Officer and Visa Officer are given to every new student at the same moment."""

from app import matching
from app.config import get_settings
from app.core.audit import audit
from app.core.clock import now
from app.core.locks import lock
from app.db import get_db
from app.domain import OFFICER_FIELD, OFFICER_ROLE, OFFICER_TITLE
from app.records import add_note
from app.services import notify
from app.services.students import profile_out
from app.services.workflow import close_follow_ups

# Shown as who assigned the counsellor when it was done automatically.
AUTOMATIC = "AHat (automatic)"


async def assign_default_officers(sid: str) -> None:
    """Gives a student whose profile is now complete the single Financial Aid Officer and Visa Officer. Their stages of
    the journey still start when they are reached. The officer gets a notification, not an email, for each student."""
    s = get_settings()
    if not s.auto_assign_officers:
        return
    db = get_db()
    student = await db.students.find_one({"_id": sid})
    if not student:
        return
    for area, email in (("finance", s.default_finance_officer_email), ("visa", s.default_visa_officer_email)):
        field = OFFICER_FIELD[area]
        officer = await db.users.find_one({"email": email, "role": OFFICER_ROLE[area], "status": "active"})
        if student.get(field) or not officer:
            continue
        t = now()
        entry = {"at": t, "by": AUTOMATIC, "role": area, "from": "", "to": officer["_id"], "reason": "Assigned automatically to every new student"}
        await db.students.update_one({"_id": sid}, {"$set": {field: officer["_id"], "updatedAt": t}, "$push": {"officerHistory": entry}})
        await add_note(sid, AUTOMATIC, f"Assigned {OFFICER_TITLE[area]}: {officer['name']}.")
        await notify.alert_student(sid, f"{officer['name']} is your {OFFICER_TITLE[area]}", target="counsellor", kind="team")
        await audit(None, f"student.{area}_officer", "students", sid, {"to": officer["_id"], "automatic": True})
        await notify.alert_staff(officer["_id"], f"New student assigned: {student['name']}", f"You are now their {OFFICER_TITLE[area]} ({student['reference']}).", path=f"/staff/students/{sid}", kind="assigned")


async def active_counsellor_loads() -> tuple[list[dict], dict[str, int]]:
    """Active counsellors, and how many students each looks after (not counting those already settled abroad)."""
    db = get_db()
    counsellors = await db.users.find({"role": "counsellor", "status": "active"}).sort("_id", 1).to_list(None)
    loads = {c["_id"]: await db.students.count_documents({"counsellorId": c["_id"], "stage": {"$ne": "settled"}}) for c in counsellors}
    return counsellors, loads


async def assign_counsellor(student: dict, target: dict, by: str, reason: str, actor: dict | None = None) -> None:
    """Records the assignment and tells the counsellor and the student. The caller holds the student's assign lock
    and has checked that the student has no counsellor yet."""
    db = get_db()
    sid = student["_id"]
    t = now()
    entry = {"at": t, "by": by, "from": "", "to": target["_id"], "reason": reason}
    # counsellorSeenAt: None until the counsellor first opens the record; until then it is "new" on their dashboard.
    await db.students.update_one(
        {"_id": sid},
        {"$set": {"counsellorId": target["_id"], "counsellorAssignedAt": t, "counsellorSeenAt": None, "updatedAt": t}, "$push": {"assignmentHistory": entry}},
    )
    await close_follow_ups(f"student:{sid}:assign")
    # Anything else waiting on this student (e.g. a document to check) moves to the new counsellor.
    await db.follow_ups.update_many({"personId": sid, "done": False, "counsellorId": None}, {"$set": {"counsellorId": target["_id"]}})
    await add_note(sid, by, f"Assigned to {target['name']}: {reason}")
    await notify.alert_student(sid, f"{target['name']} is your counsellor", "You can now book sessions and send messages.", target="counsellor", kind="team")
    await audit(actor, "student.assigned", "students", sid, {"to": target["_id"], "reason": reason, "automatic": actor is None})
    first = target["name"].split(" ")[0]
    await notify.email_counsellor(
        target["_id"], f"New student assigned: {student['name']}",
        f"{student['name']} ({student['reference']}) is now assigned to you. Please book their first career counselling session.", path=f"/staff/students/{sid}", kind="assigned",
    )
    await notify.email_student(
        student, f"Meet your counsellor: {target['name']}",
        f"{target['name']} is your AHat counsellor. {first} will guide you through your career plan, university shortlist and applications. "
        "You can now book your first career counselling session and message them from your dashboard.",
    )


async def auto_assign(sid: str) -> dict | None:
    """Assigns the best-matched counsellor who still has room (the same ranking the admin sees), once the profile is
    complete. Returns the counsellor, or None when automatic assignment is off or nobody has room: the student then
    waits for the admin, as before."""
    if not get_settings().auto_assign_counsellors:
        return None
    db = get_db()
    async with lock(f"student:{sid}:assign"):
        student = await db.students.find_one({"_id": sid})
        if not student or student.get("counsellorId"):
            return None
        counsellors, loads = await active_counsellor_loads()
        best = next((m for m in matching.rank(profile_out(student), counsellors, loads) if not m["atCapacity"]), None)
        if not best:
            return None
        target = next(c for c in counsellors if c["_id"] == best["counsellorId"])
        reason = f"Matched automatically on the student's profile (score {best['score']}/100: {'; '.join(best['reasons'])})"
        await assign_counsellor(student, target, AUTOMATIC, reason)
    return target
