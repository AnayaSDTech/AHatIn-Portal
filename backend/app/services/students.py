"""Creating student records and checking who may act on one."""

from datetime import date

from app.core.auth import is_staff
from app.core.clock import now
from app.core.errors import ApiError, not_found
from app.core.scope import visible_student
from app.core.security import decrypt, encrypt
from app.db import get_db, new_id
from app.domain import DESTINATION_LABELS, STARTER_DOCUMENTS, blank_profile, empty_journey, format_mobile, mobile_digits, profile_complete
from app.records import serialize_counsellor
from app.services.workflow import next_reference


def intake_label(value: str | None) -> str:
    """'2027-09' → 'September 2027'."""
    try:
        y, m = (value or "").split("-")
        return date(int(y), int(m), 1).strftime("%B %Y")
    except ValueError:
        return "To be decided"


async def create_student_record(user: dict, *, destination: str | None, intake: str | None) -> dict:
    """The staff-side record for a new student, with the starter document checklist.
    No counsellor yet: the admin assigns one once the student's profile is complete.
    An open website enquiry with the same email is marked as registered and linked to the record."""
    db = get_db()
    t = now()
    lead = await db.leads.find_one({"email": user["email"], "convertedStudentId": None}, sort=[("createdAt", -1)])
    record = {
        "_id": new_id(),
        "userId": user["_id"],
        "counsellorId": None,
        "assignmentHistory": [],
        "reference": await next_reference(),
        "name": user["name"],
        "email": user["email"],
        "mobile": format_mobile(mobile_digits(user["mobile"])),
        "mobileDigits": mobile_digits(user["mobile"]),
        "goal": "To be decided",
        "destination": DESTINATION_LABELS.get(destination or "", "Not decided"),
        "intake": intake_label(intake),
        "stage": "registered",
        "journey": empty_journey(),
        "profile": blank_profile(),
        "createdAt": t,
        "updatedAt": t,
    }
    if lead:
        record["leadId"] = lead["_id"]
    await db.students.insert_one(record)
    await db.documents.insert_many(
        [{"_id": new_id(), "studentId": record["_id"], "name": n, "state": "missing", "category": "general", "createdAt": t} for n in STARTER_DOCUMENTS]
    )
    await db.notes.insert_one({"_id": new_id(), "studentId": record["_id"], "at": t, "by": "System", "text": "Registered online.", "kind": "event"})
    if lead:
        await db.leads.update_one(
            {"_id": lead["_id"]},
            {
                "$set": {"stage": "registered", "convertedStudentId": record["_id"], "updatedAt": t},
                "$push": {"activities": {"$each": [{"at": t, "channel": "System", "outcome": "Registered as a student"}], "$position": 0}},
            },
        )
        await db.follow_ups.update_many({"personId": lead["_id"], "done": False}, {"$set": {"done": True, "doneAt": t}})
        await db.notes.insert_one({"_id": new_id(), "studentId": record["_id"], "at": t, "by": "System", "text": "Linked to their earlier website enquiry.", "kind": "event"})
    return record


async def own_record(user: dict) -> dict:
    record = await get_db().students.find_one({"userId": user["_id"]})
    if not record:
        raise not_found("Your student record was not found. Please contact AHat.")
    return record


async def student_for(user: dict, student_id: str, *, who: str = "both") -> dict:
    """The student record if `user` may act on it. who: 'student' (only the student), 'staff' (only staff), 'both'."""
    if is_staff(user["role"]):
        if who == "student":
            raise ApiError(403, "Only the student can do this.")
        return await visible_student(user, student_id)
    if who == "staff":
        raise ApiError(403, "Only your counsellor can do this.")
    record = await get_db().students.find_one({"_id": student_id})
    if not record or record.get("userId") != user["_id"]:
        raise not_found("Student not found.")
    return record


def profile_out(record: dict) -> dict:
    p = {**blank_profile(), **(record.get("profile") or {})}
    enc = p.pop("passportNumberEnc", None)
    p["passportNumber"] = decrypt(enc) if enc else p.get("passportNumber", "")
    return p


def profile_in(p: dict) -> dict:
    """Passport numbers are encrypted at rest."""
    out = dict(p)
    passport = out.pop("passportNumber", "")
    out["passportNumberEnc"] = encrypt(passport) if passport else None
    return out


async def counsellor_of(record: dict) -> dict | None:
    """The student's counsellor, or None until the admin assigns one."""
    if not record.get("counsellorId"):
        return None
    c = await get_db().users.find_one({"_id": record["counsellorId"]})
    return serialize_counsellor(c) if c else {"id": record["counsellorId"], "name": "Unassigned", "email": "", "phone": "", "meetingLink": ""}


def has_complete_profile(record: dict) -> bool:
    return profile_complete(record.get("profile"))


def require_ready_to_start(record: dict, what: str) -> None:
    """A student's journey starts once their profile is complete and the admin has assigned their counsellor."""
    if not has_complete_profile(record):
        raise ApiError(403, f"Please complete your profile before you {what}.", {"form": "Please complete your profile first."})
    if not record.get("counsellorId"):
        raise ApiError(403, f"You can {what} once your counsellor is assigned. We'll email you when they are.", {"form": "Your counsellor hasn't been assigned yet."})
