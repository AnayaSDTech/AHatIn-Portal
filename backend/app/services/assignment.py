"""Assigning a counsellor to a student: automatically when the profile is complete (the best match with room), or by the
admin from the Assignments page. Both go through assign_counsellor, so the record, history and emails are the same."""

from app import matching
from app.config import get_settings
from app.core.audit import audit
from app.core.clock import now
from app.core.locks import lock
from app.db import get_db
from app.records import add_note
from app.services import notify
from app.services.students import profile_out
from app.services.workflow import close_follow_ups

# Shown as who assigned the counsellor when it was done automatically.
AUTOMATIC = "AHat (automatic)"


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
