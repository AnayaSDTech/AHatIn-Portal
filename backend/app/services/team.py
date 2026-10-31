"""Who looks after which part of a student's journey, and the handovers between them.

- Counsellor: services 1-3 (career counselling, shortlist, applications). Stays the student's main contact.
- Financial Aid Officer: service 4. The admin assigns one once Application Assistance is complete (offer accepted).
- Visa Officer: services 5-7. The admin assigns one once Scholarship & Financial Guidance is complete
  (proof of funds verified, or the service marked "Not needed").
Once an officer is assigned, their services are read-only for the counsellor. Until then the counsellor can act on them
(students who were already under way before officers existed keep working as before).
"""

from app.core.clock import now
from app.core.errors import ApiError
from app.db import get_db
from app.domain import AREA_OF_ROLE, OFFICER_FIELD, OFFICER_TITLE
from app.records import add_note, serialize_counsellor
from app.services import notify
from app.services.workflow import close_follow_ups, create_follow_up, one_working_day_from_now

DONE = ("completed", "not_needed")


def _override(student: dict, code: str) -> str | None:
    return ((student.get("journey") or {}).get("overrides") or {}).get(code, {}).get("status")


async def applications_done(student: dict) -> bool:
    """Service 3 is complete: the student has accepted an offer (or staff marked it complete / not needed)."""
    o = _override(student, "S3")
    if o:
        return o in DONE
    return bool(await get_db().applications.find_one({"studentId": student["_id"], "state": "accepted"}))


async def funding_done(student: dict) -> bool:
    """Service 4 is complete: the funding plan covers the estimated cost and every proof-of-funds document is verified
    (scholarships are optional), or staff marked it complete / not needed."""
    o = _override(student, "S4")
    if o:
        return o in DONE
    funding = (student.get("journey") or {}).get("funding") or {}
    cost = funding.get("estimatedCost")
    if not cost or sum(x["amount"] for x in funding.get("sources", [])) < cost:
        return False
    funds = await get_db().documents.find({"studentId": student["_id"], "category": "funds", "deletedAt": None}, {"state": 1}).to_list(None)
    return bool(funds) and all(d["state"] == "verified" for d in funds)


async def waiting_for(student: dict) -> str | None:
    """'finance' or 'visa' when the student is ready for that officer and doesn't have one yet."""
    if not await applications_done(student):
        return None
    if not student.get("visaOfficerId") and await funding_done(student):
        return "visa"
    if not student.get("financeOfficerId") and not await funding_done(student):
        return "finance"
    return None


async def check_handover(sid: str) -> None:
    """After an event that can complete service 3 or 4: tells the admin (once) that an officer is needed."""
    student = await get_db().students.find_one({"_id": sid})
    if not student:
        return
    area = await waiting_for(student)
    if not area:
        return
    title = OFFICER_TITLE[area]
    done = "Application Assistance" if area == "finance" else "Scholarship & Financial Guidance"
    event = f"student:{sid}:assign-{area}"
    if await get_db().follow_ups.find_one({"sourceEvent": event}):
        return  # already raised
    await create_follow_up(
        counsellor_id=None, person=student["name"], person_id=sid, person_type="student",
        action=f"Assign a {title}", rule=f"{done} complete · 1 working day", due_at=one_working_day_from_now(), type_="reminder", source_event=event,
    )
    await add_note(sid, "System", f"{done} complete. Waiting for the admin to assign a {title}.")
    await notify.email_admins(
        f"Assign a {title}: {student['name']}",
        f"{student['name']} ({student['reference']}) has completed {done}. Please assign a {title} in the staff portal: {notify.portal_link('/admin/assign')}",
        dedupe_key=event,
        alert_path="/admin/assign",
        alert_text=f"{student['name']} ({student['reference']}) has completed {done}.",
    )


def owner_for(student: dict, area: str) -> str | None:
    """The staff member responsible for an area of this student's journey (their counsellor until an officer is assigned)."""
    if area in OFFICER_FIELD and student.get(OFFICER_FIELD[area]):
        return student[OFFICER_FIELD[area]]
    return student.get("counsellorId")


def require_area(user: dict, student: dict, area: str) -> None:
    """May this staff member change this part of the student's journey? (Seeing it is checked by the scope.)"""
    role = user["role"]
    if role == "admin":
        return
    if role in AREA_OF_ROLE:
        if AREA_OF_ROLE[role] != area:
            what = "funding" if AREA_OF_ROLE[role] == "finance" else "visa, pre-departure and arrival"
            raise ApiError(403, f"You look after this student's {what} only. Their counsellor handles this.")
        return
    if area in OFFICER_FIELD and student.get(OFFICER_FIELD[area]):
        raise ApiError(403, f"The student's {OFFICER_TITLE[area]} looks after this now. You can view it, but not change it.")


async def team_of(student: dict) -> dict:
    """The people looking after a student, as the student sees them (None until assigned)."""
    db = get_db()
    out = {}
    for key, field in (("counsellor", "counsellorId"), ("finance", "financeOfficerId"), ("visa", "visaOfficerId")):
        u = await db.users.find_one({"_id": student[field]}) if student.get(field) else None
        out[key] = serialize_counsellor(u) if u else None
    return out


async def assign_officer(student: dict, area: str, officer: dict, by: dict, reason: str) -> None:
    db = get_db()
    field = OFFICER_FIELD[area]
    title = OFFICER_TITLE[area]
    previous = student.get(field)
    t = now()
    entry = {"at": t, "by": by["name"], "role": area, "from": previous or "", "to": officer["_id"], "reason": reason}
    await db.students.update_one({"_id": student["_id"]}, {"$set": {field: officer["_id"], "updatedAt": t}, "$push": {"officerHistory": entry}})
    await close_follow_ups(f"student:{student['_id']}:assign-{area}")
    sid = student["_id"]
    if previous:
        await db.follow_ups.update_many({"personId": sid, "done": False, "counsellorId": previous}, {"$set": {"counsellorId": officer["_id"]}})
        await db.staff_alerts.delete_many({"userId": previous, "studentId": sid})
    await add_note(sid, by["name"], f"{'Changed' if previous else 'Assigned'} {title}: {officer['name']}. {reason}")
    first = officer["name"].split(" ")[0]
    what = "scholarships, your funding plan and proof of funds" if area == "finance" else "your visa, getting ready to travel and settling in after you arrive"
    await notify.email_counsellor(
        officer["_id"], f"New student assigned: {student['name']}",
        f"You are now {student['name']}'s {title} ({student['reference']}). Reason: {reason}", path=f"/staff/students/{sid}", kind="assigned",
    )
    await notify.email_student(
        student, f"Meet your {title}: {officer['name']}",
        f"{officer['name']} is your {title} and will help you with {what}. You can message {first} and book sessions from your dashboard. "
        "Your counsellor stays your main contact.",
    )
    if student.get("counsellorId"):
        await notify.email_counsellor(student["counsellorId"], f"{title} assigned for {student['name']}", f"{officer['name']} is now {student['name']}'s {title}. You can still see this part of their journey.", path=f"/staff/students/{sid}")
