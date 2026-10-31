"""Sessions, counsellor availability and time off."""

from fastapi import APIRouter

from app.config import get_settings
from app.core.audit import audit
from app.core.auth import CurrentUser, Staff, is_staff
from app.core.clock import now, today_iso
from app.core.errors import ApiError, not_found
from app.core.locks import lock
from app.core.scope import scope_for
from app.db import get_db, new_id
from app.records import actor_name, add_note, serialize_availability, serialize_session, serialize_time_off
from app.schemas import AvailabilityBody, CancelBody, CompleteBody, NoShowBody, RescheduleBody, SessionBody, TimeOffBody
from app.services import notify
from app.services.calendar import format_date, session_ics
from app.services.scheduling import MAX_UPCOMING, check_slot, has_ended, has_started, session_times, validate_weekly
from app.domain import OFFICER_FIELD, OFFICER_TITLE, SESSION_AREA
from app.services.students import own_record, require_ready_to_start, student_for
from app.services.team import owner_for

router = APIRouter(tags=["schedule"])


def _busy(s: dict) -> dict:
    """Another student's booking, as a student sees it: only that the time is taken."""
    return {
        "id": f"busy-{s['_id']}",
        "studentId": "",
        "counsellorId": s["counsellorId"],
        "type": "",
        "date": s["date"],
        "time": s["time"],
        "durationMinutes": s["durationMinutes"],
        "mode": s["mode"],
        "status": "booked",
        "bookedBy": "student",
        "history": [],
    }


async def _can_manage(user: dict, counsellor_id: str) -> None:
    """Admins manage any schedule; counsellors their own (and, for sessions, those they cover)."""
    if user["role"] == "admin" or counsellor_id == user["_id"]:
        return
    scope = await scope_for(user)
    if counsellor_id not in scope.owner_ids:
        raise ApiError(403, "You can only manage your own schedule.")


# ---------------------------------------------------------------- reading


def _team_ids(record: dict) -> list[str]:
    """The people a student books sessions with: their counsellor and, once assigned, their officers."""
    return [x for x in (record.get("counsellorId"), record.get("financeOfficerId"), record.get("visaOfficerId")) if x]


HOST_ROLES = ["counsellor", "admin", "finance_officer", "visa_officer"]


@router.get("/sessions")
async def list_sessions(user: CurrentUser):
    db = get_db()
    if not is_staff(user["role"]):
        record = await own_record(user)
        mine = await db.sessions.find({"studentId": record["_id"]}).to_list(None)
        others = await db.sessions.find({"counsellorId": {"$in": _team_ids(record)}, "status": "booked", "date": {"$gte": today_iso()}, "studentId": {"$ne": record["_id"]}}).to_list(None)
        return [serialize_session(s) for s in mine] + [_busy(s) for s in others]
    scope = await scope_for(user)
    if scope.all_students:
        found = await db.sessions.find({}).to_list(None)
    else:
        students = [s["_id"] async for s in db.students.find(scope.student_filter(), {"_id": 1})]
        found = await db.sessions.find({"$or": [{"counsellorId": {"$in": scope.owner_ids}}, {"studentId": {"$in": students}}]}).to_list(None)
    return [serialize_session(s) for s in found]


@router.get("/availability")
async def list_availability(user: CurrentUser):
    db = get_db()
    if not is_staff(user["role"]):
        record = await own_record(user)
        found = await db.availability.find({"counsellorId": {"$in": _team_ids(record)}}).to_list(None)
    else:
        found = await db.availability.find({}).to_list(None)
    return [serialize_availability(a) for a in found]


@router.get("/time-off")
async def list_time_off(user: CurrentUser):
    db = get_db()
    if not is_staff(user["role"]):
        record = await own_record(user)
        found = await db.time_off.find({"counsellorId": {"$in": _team_ids(record)}, "date": {"$gte": today_iso()}}).to_list(None)
        return [{**serialize_time_off(t), "reason": ""} for t in found]  # students only see that the time is unavailable
    return [serialize_time_off(t) for t in await db.time_off.find({}).to_list(None)]


# ---------------------------------------------------------------- booking


async def _send_invites(session: dict, student: dict, counsellor: dict, subject: str, text: str, *, cancel: bool = False, notify_student: bool = True, notify_counsellor: bool = True):
    seq = len(session.get("history", []))
    ics = session_ics(session, student, counsellor, cancel=cancel, sequence=seq)
    when = f"{format_date(session['date'])} at {session['time']} IST"
    place = f"Online meeting: {get_settings().meeting_link}" if session["mode"] == "online" else "At the AHat office"
    full = f"{text}\n\n{session['type']} · {when} · {place}"
    if notify_student:
        await notify.email_student(student, subject, full, attachments=[ics])
    if notify_counsellor:
        await notify.email_counsellor(counsellor["_id"], subject, full, path="/staff/schedule", attachments=[ics], kind="session")


@router.post("/sessions")
async def book_session(body: SessionBody, user: CurrentUser):
    db = get_db()
    staff = is_staff(user["role"])
    if staff:
        if not body.studentId:
            raise ApiError(400, "Choose a student.", {"studentId": "Choose a student."})
        student = await student_for(user, body.studentId, who="staff")
        if not student.get("counsellorId"):
            raise ApiError(400, "Assign a counsellor to this student before booking a session.")
        counsellor_id = body.counsellorId or owner_for(student, SESSION_AREA.get(body.type, "counsellor"))
        await _can_manage(user, counsellor_id)
    else:
        student = await own_record(user)
        require_ready_to_start(student, "book a session")
        # Each kind of session is with the person who looks after it.
        area = SESSION_AREA.get(body.type, "counsellor")
        counsellor_id = student.get(OFFICER_FIELD[area]) if area in OFFICER_FIELD else student["counsellorId"]
        if not counsellor_id:
            msg = f"You can book a {body.type.lower()} session once your {OFFICER_TITLE[area]} is assigned."
            raise ApiError(400, msg, {"form": msg})
    counsellor = await db.users.find_one({"_id": counsellor_id, "role": {"$in": HOST_ROLES}})
    if not counsellor:
        raise not_found("Counsellor not found.")

    async with lock(f"slot:{counsellor_id}:{body.date}"):
        if not staff:
            upcoming = await db.sessions.count_documents({"studentId": student["_id"], "status": "booked", "date": {"$gte": today_iso()}})
            if upcoming >= MAX_UPCOMING:
                msg = f"You can have up to {MAX_UPCOMING} upcoming sessions. Cancel one to book another."
                raise ApiError(400, msg, {"form": msg})
        av = await check_slot(counsellor_id, body.date, body.time, body.mode, ignore_notice=staff)
        start, end = session_times(body.date, body.time, av["slotMinutes"])
        session = {
            "_id": new_id(),
            "studentId": student["_id"],
            "counsellorId": counsellor_id,
            "type": body.type,
            "date": body.date,
            "time": body.time,
            "durationMinutes": av["slotMinutes"],
            "mode": body.mode,
            "status": "booked",
            "bookedBy": "counsellor" if staff else "student",
            "history": [{"at": now(), "by": user["name"], "text": f"Booked on behalf of {student['name']}." if staff else "Session booked."}],
            "startsAt": start,
            "endsAt": end,
            "createdAt": now(),
        }
        if body.studentNote and not staff:
            session["studentNote"] = body.studentNote
        await db.sessions.insert_one(session)

    if staff:
        await _send_invites(session, student, counsellor, f"Session booked: {body.type}", f"{user['name']} booked a session for you.", notify_counsellor=counsellor_id != user["_id"])
    else:
        await _send_invites(session, student, counsellor, f"Session booked: {body.type}", f"{student['name']} booked a session.")
    return serialize_session(session)


async def _session(user: dict, session_id: str) -> tuple[dict, dict]:
    s = await get_db().sessions.find_one({"_id": session_id})
    if not s:
        raise not_found("Session not found.")
    if is_staff(user["role"]):
        await _can_manage(user, s["counsellorId"])
        student = await get_db().students.find_one({"_id": s["studentId"]})
    else:
        student = await own_record(user)
        if s["studentId"] != student["_id"]:
            raise not_found("Session not found.")
    return s, student


async def _update(s: dict, by: str, text: str, patch: dict) -> dict:
    db = get_db()
    res = await db.sessions.find_one_and_update(
        {"_id": s["_id"], "status": "booked"},
        {"$set": {**patch, "updatedAt": now()}, "$push": {"history": {"at": now(), "by": by, "text": text}}},
        return_document=True,
    )
    if not res:
        raise ApiError(409, "This session was just changed by someone else. Refresh and try again.")
    return res


@router.post("/sessions/{session_id}/cancel")
async def cancel_session(session_id: str, body: CancelBody, user: CurrentUser):
    s, student = await _session(user, session_id)
    if s["status"] != "booked":
        raise ApiError(400, "Only booked sessions can be cancelled.")
    if has_started(s):
        raise ApiError(400, "This session has already started. Mark it completed or as a no-show instead.")
    counsellor = await get_db().users.find_one({"_id": s["counsellorId"]})
    if is_staff(user["role"]):
        reason = (body.reason or "").strip()
        if len(reason) < 5:
            raise ApiError(400, "Give a reason; the student will see it.", {"reason": "Give a reason; the student will see it."})
        s = await _update(s, user["name"], f"Cancelled: {reason}", {"status": "cancelled", "cancelReason": reason})
        await add_note(student["_id"], user["name"], f"{s['type']} session on {format_date(s['date'])} cancelled: {reason}")
        await _send_invites(s, student, counsellor, f"Session cancelled: {s['type']}", f"Your session was cancelled. Reason: {reason}", cancel=True, notify_counsellor=s["counsellorId"] != user["_id"])
    else:
        s = await _update(s, user["name"], "Cancelled by the student.", {"status": "cancelled", "cancelReason": "Cancelled by the student"})
        await _send_invites(s, student, counsellor, f"Session cancelled: {s['type']}", f"{student['name']} cancelled their session.", cancel=True, notify_student=False)
    return serialize_session(s)


@router.post("/sessions/{session_id}/reschedule")
async def reschedule_session(session_id: str, body: RescheduleBody, user: Staff):
    s, student = await _session(user, session_id)
    if s["status"] != "booked" or has_started(s):
        raise ApiError(400, "Only upcoming booked sessions can be rescheduled.")
    async with lock(f"slot:{s['counsellorId']}:{body.date}"):
        await check_slot(s["counsellorId"], body.date, body.time, body.mode, ignore_session_id=s["_id"], ignore_notice=True)
        mode_text = "" if body.mode == s["mode"] else f" (now {'online' if body.mode == 'online' else 'at the office'})"
        start, end = session_times(body.date, body.time, s["durationMinutes"])
        old = f"{format_date(s['date'])} {s['time']}"
        s = await _update(
            s,
            user["name"],
            f"Rescheduled from {old} to {format_date(body.date)} {body.time}{mode_text}: {body.reason}",
            {"date": body.date, "time": body.time, "mode": body.mode, "startsAt": start, "endsAt": end, "remindedAt": None},
        )
    await add_note(student["_id"], user["name"], f"{s['type']} session moved to {format_date(body.date)} at {body.time}{mode_text}: {body.reason}")
    counsellor = await get_db().users.find_one({"_id": s["counsellorId"]})
    await _send_invites(s, student, counsellor, f"Session moved: {s['type']}", f"Your session was moved. Reason: {body.reason}", notify_counsellor=s["counsellorId"] != user["_id"])
    return serialize_session(s)


@router.post("/sessions/{session_id}/complete")
async def complete_session(session_id: str, body: CompleteBody, user: Staff):
    from app.routers.students import record_final, record_plan

    s, student = await _session(user, session_id)
    if s["status"] != "booked" or not has_started(s):
        raise ApiError(400, "Sessions can be completed once they have started.")
    # A Career counselling session can also record the agreed career plan (if there isn't one yet).
    plan = body.careerPlan if s["type"] == "Career counselling" and not student["journey"].get("careerPlan") else None
    s = await _update(s, user["name"], "Marked completed.", {"status": "completed", "outcomeNotes": body.notes})
    await add_note(student["_id"], user["name"], f"{s['type']} session completed: {body.notes}")
    if plan:
        await record_plan(student["_id"], user, plan)
    if body.finalCheckIn and s["type"] == "Post-arrival check-in" and student["journey"]["arrival"].get("arrivedAt") and not student["journey"]["arrival"].get("finalCheckInAt"):
        await record_final(student["_id"], user, body.notes)
    return serialize_session(s)


@router.post("/sessions/{session_id}/no-show")
async def no_show(session_id: str, body: NoShowBody, user: Staff):
    s, student = await _session(user, session_id)
    if s["status"] != "booked" or not has_started(s):
        raise ApiError(400, "A session can be marked as a no-show once it has started.")
    s = await _update(s, user["name"], "Marked as no-show.", {"status": "no_show"})
    extra = f" {body.note.strip()}" if body.note and body.note.strip() else ""
    await add_note(student["_id"], user["name"], f"Missed the {s['type'].lower()} session on {format_date(s['date'])}.{extra}")
    return serialize_session(s)


# ---------------------------------------------------------------- availability and time off


async def _own_schedule(user: dict, counsellor_id: str) -> dict:
    if user["role"] != "admin" and counsellor_id != user["_id"]:
        raise ApiError(403, "You can only change your own availability.")
    c = await get_db().users.find_one({"_id": counsellor_id, "role": {"$in": HOST_ROLES}})
    if not c:
        raise not_found("Counsellor not found.")
    return c


@router.put("/availability/{counsellor_id}")
async def save_availability(counsellor_id: str, body: AvailabilityBody, user: Staff):
    await _own_schedule(user, counsellor_id)
    weekly = {day: [b.model_dump() for b in blocks] for day, blocks in body.weekly.items() if blocks}
    err = validate_weekly(weekly)
    if err:
        raise ApiError(400, err)
    doc = {"counsellorId": counsellor_id, "weekly": weekly, "slotMinutes": body.slotMinutes, "bufferMinutes": body.bufferMinutes, "minNoticeHours": body.minNoticeHours, "horizonDays": body.horizonDays, "updatedAt": now()}
    await get_db().availability.update_one({"counsellorId": counsellor_id}, {"$set": doc}, upsert=True)
    await audit(user, "availability.saved", "availability", counsellor_id)
    return serialize_availability(doc)


@router.post("/time-off")
async def add_time_off(body: TimeOffBody, user: Staff):
    counsellor_id = body.counsellorId or user["_id"]
    await _own_schedule(user, counsellor_id)
    if body.date < today_iso():
        raise ApiError(400, "Choose today or a future date.", {"date": "Choose today or a future date."})
    doc = {"_id": new_id(), "counsellorId": counsellor_id, "date": body.date, "reason": body.reason, "createdAt": now(), "createdBy": user["_id"]}
    if body.start:
        doc["start"], doc["end"] = body.start, body.end
    await get_db().time_off.insert_one(doc)
    return serialize_time_off(doc)


@router.delete("/time-off/{entry_id}", status_code=204)
async def remove_time_off(entry_id: str, user: Staff):
    t = await get_db().time_off.find_one({"_id": entry_id})
    if not t:
        raise not_found("Time off not found.")
    await _own_schedule(user, t["counsellorId"])
    await get_db().time_off.delete_one({"_id": entry_id})


__all__ = ["router", "has_ended", "actor_name"]
