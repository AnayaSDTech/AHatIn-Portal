"""Student records and every event in a student's journey.

Students and staff call the same endpoints for the same record (students only for their own), so both sides
always see the same data. Each event adds a line to the student's history with who did it.
"""

from datetime import timedelta

from fastapi import APIRouter

from app import career, universities
from app.config import get_settings
from app.core.audit import audit
from app.core.auth import Admin, CurrentUser, Staff, is_staff
from app.core.clock import iso, now, now_iso
from app.core.errors import ApiError, not_found
from app.core.locks import lock
from app.core.scope import scope_for
from app.db import get_db, new_id
from app.domain import (
    APP_LABELS,
    APP_TRANSITIONS,
    DEPARTURE_TASKS,
    DOC_AREA,
    OFFICER_ROLE,
    OFFICER_TITLE,
    OFFER_STATES,
    SERVICE_AREA,
    SERVICE_STATUS_LABELS,
    SERVICE_TITLES,
    STUDENT_DECISIONS,
    STUDY_PLAN_FIELDS,
    VISA_LABELS,
    format_mobile,
    profile_complete,
)
from app.records import actor_name, add_note, advance_stage, iso_or, load_student, load_students
from app.schemas import (
    AppCorrectBody,
    AppStatusBody,
    ApproveBody,
    AssignBody,
    AssignOfficerBody,
    CareerPlanBody,
    ChoiceBody,
    CostBody,
    DecisionBody,
    DepartureTaskBody,
    DocumentRequestBody,
    FinalCheckInBody,
    FundingSourceBody,
    OverrideBody,
    ProfileBody,
    ReassignBody,
    RejectBody,
    ScholarshipBody,
    ScholarshipStatusBody,
    ShortlistItemBody,
    TextBody,
    UploadCompleteBody,
    UploadUrlBody,
    VisaBody,
)
from app.services import notify, storage
from app.services.assignment import assign_counsellor, auto_assign
from app.services.students import counsellor_of, has_complete_profile, own_record, profile_in, profile_out, student_for
from app.services.team import assign_officer, check_handover, owner_for, require_area, team_of
from app.services.workflow import close_follow_ups, create_follow_up, one_working_day_from_now

router = APIRouter(tags=["students"])


def lakh(n: float) -> str:
    """Same number format as the frontend (12 → '12', 12.5 → '12.5')."""
    return str(int(n)) if float(n).is_integer() else f"{n:g}"


# ---------------------------------------------------------------- reading


@router.get("/students")
async def list_students(user: CurrentUser):
    """Staff: every record they may see. Students: their own record only."""
    if not is_staff(user["role"]):
        return await load_students({"userId": user["_id"]})
    scope = await scope_for(user)
    return await load_students(scope.student_filter())


@router.get("/students/{sid}")
async def get_student(sid: str, user: CurrentUser):
    student = await student_for(user, sid)
    # The counsellor has now seen their newly assigned student (others opening the record don't count).
    if user["_id"] == student.get("counsellorId") and "counsellorSeenAt" in student and student["counsellorSeenAt"] is None:
        await get_db().students.update_one({"_id": sid}, {"$set": {"counsellorSeenAt": now()}})
    # Opening the record is how a "new student" notification gets read.
    await get_db().staff_alerts.delete_many({"userId": user["_id"], "studentId": sid, "kind": "assigned"})
    return await load_student(sid)


@router.get("/me/record")
async def my_record(user: CurrentUser):
    if is_staff(user["role"]):
        raise ApiError(403, "Only students have a student record.")
    record = await own_record(user)
    # When the student last looked at each section, so the dashboard can point out what changed since.
    # Before the first visit, everything up to the record's creation counts as seen.
    seen = {k: iso_or(v) for k, v in (record.get("seen") or {}).items()}
    seen.setdefault("applications", iso_or(record.get("createdAt") or now()))
    return {
        "record": await load_student(record["_id"]),
        "profile": profile_out(record),
        "profileComplete": has_complete_profile(record),
        "counsellor": await counsellor_of(record),
        "team": await team_of(record),
        "seen": seen,
    }


@router.post("/me/seen/{section}", status_code=204)
async def mark_seen(section: str, user: CurrentUser):
    """The student has looked at a section (e.g. their applications); its updates are no longer new."""
    if is_staff(user["role"]):
        raise ApiError(403, "Only students can do this.")
    if section not in ("applications",):
        raise not_found("Unknown section.")
    record = await own_record(user)
    await get_db().students.update_one({"_id": record["_id"]}, {"$set": {f"seen.{section}": now()}})


@router.put("/me/profile")
async def save_profile(body: ProfileBody, user: CurrentUser):
    if is_staff(user["role"]):
        raise ApiError(403, "Only students have a profile.")
    record = await own_record(user)
    current = profile_out(record)
    was_complete = has_complete_profile(record)
    # The passport number can't be changed here (staff update it); everything else comes from the form.
    profile = {**body.model_dump(exclude={"mobile"}), "passportNumber": current.get("passportNumber", "")}
    # The record's goal, destination and intake follow the student's own study plans.
    updates = {
        "profile": profile_in(profile),
        "goal": ", ".join(body.courseInterests),
        "destination": body.destination,
        "intake": body.intake,
        "updatedAt": now(),
    }
    mobile = body.mobile or current["mobile"]
    if body.mobile and body.mobile != current["mobile"]:
        updates.update(mobile=format_mobile(body.mobile), mobileDigits=body.mobile)
        if record.get("userId"):
            await get_db().users.update_one({"_id": record["userId"]}, {"$set": {"mobile": f"+91{body.mobile}"}})
    complete = profile_complete(profile)
    if complete and not was_complete:
        updates["profileCompletedAt"] = now()
    await get_db().students.update_one({"_id": record["_id"]}, {"$set": updates})
    sid = record["_id"]

    if complete and not was_complete and not record.get("counsellorId"):
        # The best-matched counsellor with room is assigned straight away.
        await add_note(sid, actor_name(user), "Completed their profile.")
        if await auto_assign(sid):
            return {**profile, "mobile": mobile}
        # Automatic assignment is off, or no counsellor has room: the student joins the admin's "Waiting for a counsellor" list.
        await add_note(sid, "System", "Waiting for the admin to assign a counsellor.")
        await notify.email_admins(f"Assign a counsellor: {record['name']}", f"{record['name']} ({record['reference']}) has completed their profile and is waiting for a counsellor.", alert_path="/admin/assign")
        await create_follow_up(
            counsellor_id=None, person=record["name"], person_id=sid, person_type="student",
            action="Assign a counsellor (profile complete)", rule="Profile complete · 1 working day", due_at=one_working_day_from_now(), type_="reminder", source_event=f"student:{sid}:assign",
        )
        return {**profile, "mobile": mobile}

    def shown(v) -> str:
        return ", ".join(v) if isinstance(v, list) else v

    changed = [k for k in STUDY_PLAN_FIELDS if shown(current.get(k, "")) != shown(profile[k])]
    if changed and was_complete and record.get("counsellorId"):
        detail = "; ".join(f"{STUDY_PLAN_FIELDS[k]}: {shown(current.get(k, '')) or 'not set'} → {shown(profile[k])}" for k in changed)
        await add_note(sid, actor_name(user), f"Changed their study plans ({detail}).")
        await notify.email_counsellor(record["counsellorId"], f"{record['name']} changed their study plans", f"{record['name']} updated their profile. {detail[0].upper()}{detail[1:]}.", path=f"/staff/students/{sid}")
    else:
        await add_note(sid, actor_name(user), "Updated their profile.")
        await notify.alert_staff(record.get("counsellorId"), f"{record['name']} updated their profile", "Their profile details changed.", path=f"/staff/students/{sid}", key=f"profile:{sid}")
    return {**profile, "mobile": mobile}


# ---------------------------------------------------------------- notes and ownership


@router.post("/students/{sid}/notes")
async def add_staff_note(sid: str, body: TextBody, user: Staff):
    await student_for(user, sid, who="staff")
    await add_note(sid, actor_name(user), body.text, kind="note")
    return await load_student(sid)


@router.post("/students/{sid}/assign")
async def assign(sid: str, body: AssignBody, user: Admin):
    """The admin chooses the counsellor for a student who doesn't have one yet (profile must be complete): those who
    completed their profile while no counsellor had room, or before counsellors were assigned automatically."""
    db = get_db()
    async with lock(f"student:{sid}:assign"):
        student = await student_for(user, sid, who="staff")
        if student.get("counsellorId"):
            raise ApiError(409, "This student already has a counsellor. Use Reassign to change it.")
        if not has_complete_profile(student):
            raise ApiError(400, "The student hasn't completed their profile yet. Send them a reminder instead.")
        target = await db.users.find_one({"_id": body.counsellorId, "role": "counsellor", "status": "active"})
        if not target:
            raise ApiError(400, "Choose an active counsellor.", {"counsellorId": "Choose an active counsellor."})
        await assign_counsellor(student, target, user["name"], body.reason or "Matched on the student's profile", actor=user)
    return await load_student(sid)


@router.post("/students/{sid}/officer")
async def set_officer(sid: str, body: AssignOfficerBody, user: Admin):
    """The admin assigns (or changes) a student's Financial Aid Officer or Visa Officer."""
    db = get_db()
    async with lock(f"student:{sid}:officer"):
        student = await student_for(user, sid, who="staff")
        officer = await db.users.find_one({"_id": body.officerId, "role": OFFICER_ROLE[body.kind], "status": "active"})
        if not officer:
            raise ApiError(400, f"Choose an active {OFFICER_TITLE[body.kind]}.", {"officerId": f"Choose an active {OFFICER_TITLE[body.kind]}."})
        field = "financeOfficerId" if body.kind == "finance" else "visaOfficerId"
        if student.get(field) == officer["_id"]:
            raise ApiError(400, f"{officer['name']} is already this student's {OFFICER_TITLE[body.kind]}.")
        if student.get(field) and len(body.reason) < 5:
            raise ApiError(400, "Give a reason for the change (at least 5 characters).", {"reason": "Give a reason for the change."})
        await assign_officer(student, body.kind, officer, user, body.reason or "Assigned by the admin")
    await audit(user, f"student.{body.kind}_officer", "students", sid, {"to": officer["_id"]})
    return await load_student(sid)


@router.post("/students/{sid}/profile-reminder", status_code=204)
async def profile_reminder(sid: str, user: Admin):
    """Emails a student whose profile is still incomplete (at most once a day)."""
    student = await student_for(user, sid, who="staff")
    if has_complete_profile(student):
        raise ApiError(400, "This student's profile is already complete.")
    await notify.email_student(
        student, "Complete your AHat profile to get started",
        "Please complete your profile so we can match you with the right counsellor. It takes about five minutes: "
        "your education, English test and study plans.",
        dedupe_key=f"profile-reminder:{sid}:{now():%Y-%m-%d}",
    )
    await add_note(sid, user["name"], "Sent a reminder to complete the profile.")


@router.post("/students/{sid}/reassign")
async def reassign(sid: str, body: ReassignBody, user: Admin):
    db = get_db()
    student = await student_for(user, sid, who="staff")
    if not student.get("counsellorId"):
        raise ApiError(400, "This student doesn't have a counsellor yet. Assign one instead.")
    target = await db.users.find_one({"_id": body.counsellorId, "role": "counsellor", "status": "active"})
    if not target:
        raise ApiError(400, "Choose an active counsellor.", {"counsellorId": "Choose an active counsellor."})
    if target["_id"] == student["counsellorId"]:
        raise ApiError(400, "The student is already with this counsellor.", {"counsellorId": "Choose a different counsellor."})
    old = await db.users.find_one({"_id": student["counsellorId"]})
    entry = {"at": now(), "by": user["name"], "from": student["counsellorId"], "to": target["_id"], "reason": body.reason}
    t = now()
    await db.students.update_one(
        {"_id": sid},
        {"$set": {"counsellorId": target["_id"], "counsellorAssignedAt": t, "counsellorSeenAt": None, "updatedAt": t}, "$push": {"assignmentHistory": entry}},
    )
    # Open follow-ups move with the student; booked sessions stay with the counsellor until rescheduled.
    await db.follow_ups.update_many({"personId": sid, "done": False}, {"$set": {"counsellorId": target["_id"]}})
    await add_note(sid, user["name"], f"Reassigned from {old['name'] if old else 'Unassigned'} to {target['name']}: {body.reason}")
    await db.staff_alerts.delete_many({"userId": student["counsellorId"], "studentId": sid})
    await audit(user, "student.reassigned", "students", sid, {"from": student["counsellorId"], "to": target["_id"], "reason": body.reason})
    await notify.email_counsellor(target["_id"], f"New student assigned: {student['name']}", f"{student['name']} ({student['reference']}) is now assigned to you. Reason: {body.reason}", path=f"/staff/students/{sid}", kind="assigned")
    return await load_student(sid)


# ---------------------------------------------------------------- journey helpers


async def _journey(sid: str, fn) -> dict:
    """Read-modify-write of a student's journey, one change at a time per student."""
    db = get_db()
    async with lock(f"student:{sid}"):
        s = await db.students.find_one({"_id": sid})
        j = s["journey"]
        result = fn(j, s)
        await db.students.update_one({"_id": sid}, {"$set": {"journey": j, "updatedAt": now()}})
    return result


def _shortlist(j: dict) -> dict:
    if not j.get("shortlist"):
        raise ApiError(400, "There is no shortlist yet.")
    return j["shortlist"]


def _item(sl: dict, item_id: str) -> dict:
    item = next((i for i in sl["items"] if i["id"] == item_id), None)
    if not item:
        raise not_found("Shortlist option not found.")
    return item


# ---------------------------------------------------------------- 1. career counselling


@router.get("/career-options")
async def career_options(_: CurrentUser):
    """Career directions with their courses, study levels and destinations for the career plan form."""
    return career.options()


@router.get("/shortlist-options")
async def shortlist_options(_: Staff):
    """Universities by country and upcoming intakes for adding a shortlist option (courses: /career-options)."""
    return universities.options()


@router.post("/students/{sid}/career-plan")
async def record_career_plan(sid: str, body: CareerPlanBody, user: Staff):
    """Records the agreed career plan, or updates it (the first "shared" date is kept)."""
    require_area(user, await student_for(user, sid, who="staff"), "counsellor")
    await record_plan(sid, user, body)
    return await load_student(sid)


async def record_plan(sid: str, user: dict, body: CareerPlanBody) -> None:
    summary = career.plan_summary(body.direction, body.course, body.level, body.destinations)
    fields = {"direction": body.direction, "course": body.course, "level": body.level, "destinations": body.destinations, "notes": body.notes, "summary": summary}

    def fn(j, _):
        previous = j.get("careerPlan")
        if previous:
            j["careerPlan"] = {"at": previous["at"], "by": previous["by"], **fields, "updatedAt": now_iso(), "updatedBy": user["name"]}
        else:
            j["careerPlan"] = {"at": now_iso(), "by": user["name"], **fields}
        return bool(previous)

    updated = await _journey(sid, fn)
    notes = f" Notes: {body.notes}" if body.notes else ""
    await add_note(sid, user["name"], f"Career plan {'updated' if updated else 'shared'}: {summary}.{notes}")


# ---------------------------------------------------------------- 2. shortlist


@router.post("/students/{sid}/shortlist/items")
async def add_shortlist_item(sid: str, body: ShortlistItemBody, user: Staff):
    require_area(user, await student_for(user, sid, who="staff"), "counsellor")
    at = now_iso()

    def fn(j, _):
        sl = j.get("shortlist") or {"version": 1, "status": "draft", "items": []}
        before = sl["status"] if j.get("shortlist") else None
        if any(i["university"].lower() == body.university.lower() and i["course"].lower() == body.course.lower() for i in sl["items"]):
            raise ApiError(409, "This option is already on the shortlist.", {"university": "Already on the shortlist."})
        sl["items"].append({**body.model_dump(), "id": new_id(), "comments": [], "addedAt": at})
        if sl["status"] == "approved":
            # Adding an option re-opens an approved shortlist for the student (earlier choices are kept).
            sl.update(status="shared", version=sl["version"] + 1, sharedAt=at)
        j["shortlist"] = sl
        return before

    before = await _journey(sid, fn)
    if before in ("shared", "approved"):
        extra = "; the student is asked to review it again" if before == "approved" else ""
        await add_note(sid, user["name"], f"Added {body.university} ({body.course}) to the shared shortlist{extra}.")
        record = await get_db().students.find_one({"_id": sid})
        await notify.email_student(record, "A new option was added to your shortlist", f"{user['name']} added {body.university} ({body.course}) to your shortlist. Please review it.")
    return await load_student(sid)


@router.delete("/students/{sid}/shortlist/items/{item_id}")
async def remove_shortlist_item(sid: str, item_id: str, user: Staff):
    require_area(user, await student_for(user, sid, who="staff"), "counsellor")

    def fn(j, _):
        sl = _shortlist(j)
        _item(sl, item_id)
        sl["items"] = [i for i in sl["items"] if i["id"] != item_id]

    await _journey(sid, fn)
    return await load_student(sid)


@router.post("/students/{sid}/shortlist/share")
async def share_shortlist(sid: str, user: Staff):
    student = await student_for(user, sid, who="staff")
    require_area(user, student, "counsellor")

    def fn(j, _):
        sl = _shortlist(j)
        if not sl["items"]:
            raise ApiError(400, "Add at least one option before sharing.")
        sl.update(status="shared", sharedAt=now_iso())

    await _journey(sid, fn)
    await advance_stage(sid, "documents_shortlist")
    await add_note(sid, user["name"], "Shortlist shared with the student for review.")
    await notify.email_student(student, "Your university shortlist is ready", f"{user['name']} has shared your university shortlist. Please review each option and approve it.")
    return await load_student(sid)


@router.post("/students/{sid}/shortlist/revise")
async def revise_shortlist(sid: str, user: Staff):
    require_area(user, await student_for(user, sid, who="staff"), "counsellor")

    def fn(j, _):
        sl = _shortlist(j)
        sl.update(status="draft", version=sl["version"] + 1)

    await _journey(sid, fn)
    await add_note(sid, user["name"], "Started a revised shortlist.")
    return await load_student(sid)


@router.post("/students/{sid}/shortlist/items/{item_id}/comments")
async def comment_on_item(sid: str, item_id: str, body: TextBody, user: CurrentUser):
    student = await student_for(user, sid)
    staff = is_staff(user["role"])
    if staff:
        require_area(user, student, "counsellor")

    def fn(j, _):
        item = _item(_shortlist(j), item_id)
        item["comments"].append({"at": now_iso(), "by": user["name"], "role": "staff" if staff else "student", "text": body.text})
        return item

    item = await _journey(sid, fn)
    if not staff:
        await add_note(sid, actor_name(user), f"Question on the shortlist: “{body.text}”")
        await notify.email_counsellor(student["counsellorId"], f"{student['name']} asked about {item['university']}", body.text, path=f"/staff/students/{sid}")
    else:
        await notify.email_student(student, f"Your counsellor replied about {item['university']}", body.text, dedupe_key=None)
    return await load_student(sid)


@router.put("/students/{sid}/shortlist/items/{item_id}/choice")
async def set_choice(sid: str, item_id: str, body: ChoiceBody, user: CurrentUser):
    await student_for(user, sid, who="student")

    def fn(j, _):
        sl = _shortlist(j)
        if sl["status"] != "shared":
            raise ApiError(400, "This shortlist isn't open for review.")
        item = _item(sl, item_id)
        item["choice"] = body.choice
        item["removeReason"] = body.reason if body.choice == "removed" else None
        if item["choice"] is None:
            item.pop("choice")
        if item["removeReason"] is None:
            item.pop("removeReason")

    await _journey(sid, fn)
    return await load_student(sid)


@router.post("/students/{sid}/shortlist/approve")
async def approve_shortlist(sid: str, _: ApproveBody, user: CurrentUser):
    """The student approves: a draft application is created for every option they chose to apply to."""
    student = await student_for(user, sid, who="student")
    db = get_db()

    def fn(j, _s):
        sl = _shortlist(j)
        if sl["status"] != "shared":
            raise ApiError(400, "This shortlist isn't open for review.")
        if any(not i.get("choice") for i in sl["items"]):
            raise ApiError(400, "Decide on every option before approving.")
        chosen = [i for i in sl["items"] if i.get("choice") == "apply"]
        if not chosen:
            raise ApiError(400, "Choose at least one option to apply to.")
        at = now_iso()
        sl.update(status="approved", approvedAt=at)
        sl.setdefault("firstApprovedAt", at)
        return chosen, [i for i in sl["items"] if i.get("choice") == "removed"]

    chosen, removed = await _journey(sid, fn)
    existing = {(a["university"], a["course"]) async for a in db.applications.find({"studentId": sid}, {"university": 1, "course": 1})}
    new_apps = [
        {"_id": new_id(), "studentId": sid, "university": i["university"], "course": i["course"], "agency": i.get("agency", ""), "state": "draft", "deadline": i.get("deadline") or None, "history": [], "createdAt": now()}
        for i in chosen
        if (i["university"], i["course"]) not in existing
    ]
    if new_apps:
        await db.applications.insert_many(new_apps)
    await advance_stage(sid, "documents_shortlist")
    summary = f"Apply to: {', '.join(i['university'] for i in chosen)}."
    if removed:
        summary += f" Removed: {', '.join(f'{i['university']} ({i.get('removeReason', '')})' for i in removed)}."
    await add_note(sid, actor_name(user), f"Approved the shortlist. {summary}")
    await notify.email_counsellor(student["counsellorId"], f"{student['name']} approved their shortlist", summary, path=f"/staff/students/{sid}")
    return await load_student(sid)


# ---------------------------------------------------------------- 3. applications


async def _application(sid: str, app_id: str) -> dict:
    a = await get_db().applications.find_one({"_id": app_id, "studentId": sid})
    if not a:
        raise not_found("Application not found.")
    return a


@router.post("/students/{sid}/applications/{app_id}/status")
async def set_application_state(sid: str, app_id: str, body: AppStatusBody, user: Staff):
    student = await student_for(user, sid, who="staff")
    require_area(user, student, "counsellor")
    a = await _application(sid, app_id)
    if body.to in STUDENT_DECISIONS:
        raise ApiError(403, "Accepting or declining an offer is the student's decision.")
    if body.to not in APP_TRANSITIONS[a["state"]]:
        raise ApiError(400, f"{APP_LABELS[a['state']]} can't change to {APP_LABELS[body.to]}.")
    entry = {"at": now(), "by": user["name"], "from": a["state"], "to": body.to}
    res = await get_db().applications.update_one({"_id": app_id, "state": a["state"]}, {"$set": {"state": body.to, "updatedAt": now()}, "$push": {"history": entry}})
    if not res.modified_count:
        raise ApiError(409, "This application was just updated by someone else. Refresh and try again.")
    if body.to == "submitted":
        await advance_stage(sid, "applications_submitted")
    await add_note(sid, user["name"], f"{a['university']}: {APP_LABELS[a['state']]} → {APP_LABELS[body.to]}.")
    await audit(user, "application.status", "applications", app_id, {"from": a["state"], "to": body.to})
    text = f"Your application to {a['university']} ({a['course']}) is now: {APP_LABELS[body.to]}."
    if body.to in OFFER_STATES:
        text += " Sign in to accept or decline the offer."
    await notify.email_student(student, f"Application update: {a['university']}", text)
    return await load_student(sid)


@router.post("/students/{sid}/applications/{app_id}/correct")
async def correct_application_state(sid: str, app_id: str, body: AppCorrectBody, user: Staff):
    """Fixes a status chosen by mistake: any status except the student's own decisions, with a reason."""
    require_area(user, await student_for(user, sid, who="staff"), "counsellor")
    a = await _application(sid, app_id)
    if a["state"] in STUDENT_DECISIONS or body.to in STUDENT_DECISIONS:
        raise ApiError(403, "Offers the student has accepted or declined can't be corrected here.")
    if body.to == a["state"]:
        raise ApiError(400, "Choose a different status.", {"to": "Choose a different status."})
    entry = {"at": now(), "by": user["name"], "from": a["state"], "to": body.to, "reason": body.reason}
    await get_db().applications.update_one({"_id": app_id}, {"$set": {"state": body.to, "updatedAt": now()}, "$push": {"history": entry}})
    await add_note(sid, user["name"], f"Corrected {a['university']}: {APP_LABELS[a['state']]} → {APP_LABELS[body.to]} ({body.reason}).")
    await check_handover(sid)
    await audit(user, "application.corrected", "applications", app_id, {"from": a["state"], "to": body.to, "reason": body.reason})
    return await load_student(sid)


@router.post("/students/{sid}/applications/{app_id}/decision")
async def decide_offer(sid: str, app_id: str, body: DecisionBody, user: CurrentUser):
    student = await student_for(user, sid, who="student")
    a = await _application(sid, app_id)
    to = "accepted" if body.accept else "declined"
    if a["state"] not in OFFER_STATES:
        raise ApiError(400, "There is no offer to reply to.")
    if body.accept and await get_db().applications.find_one({"studentId": sid, "state": "accepted"}):
        raise ApiError(400, "You have already accepted an offer. Talk to your counsellor before accepting another.")
    entry = {"at": now(), "by": actor_name(user), "from": a["state"], "to": to}
    await get_db().applications.update_one({"_id": app_id}, {"$set": {"state": to, "updatedAt": now()}, "$push": {"history": entry}})
    if body.accept:
        await advance_stage(sid, "offer_accepted")
        await check_handover(sid)
    await add_note(sid, actor_name(user), f"{'Accepted' if body.accept else 'Declined'} the offer from {a['university']}.")
    await audit(user, "application.decision", "applications", app_id, {"to": to})
    await notify.email_counsellor(student["counsellorId"], f"{student['name']} {to} the offer from {a['university']}", f"{student['name']} {to} the offer from {a['university']} ({a['course']}).", path=f"/staff/students/{sid}")
    return await load_student(sid)


# ---------------------------------------------------------------- 4. funding


@router.put("/students/{sid}/funding/estimated-cost")
async def set_estimated_cost(sid: str, body: CostBody, user: Staff):
    require_area(user, await student_for(user, sid, who="staff"), "finance")
    value = round(body.lakh * 10) / 10

    def fn(j, _):
        j["funding"]["estimatedCost"] = value

    await _journey(sid, fn)
    await add_note(sid, user["name"], f"Estimated cost of study set to ₹{lakh(value)} lakh.")
    await check_handover(sid)
    return await load_student(sid)


@router.post("/students/{sid}/funding/sources")
async def add_funding_source(sid: str, body: FundingSourceBody, user: CurrentUser):
    student = await student_for(user, sid)
    if is_staff(user["role"]):
        require_area(user, student, "finance")
    amount = round(body.amount * 10) / 10

    def fn(j, _):
        j["funding"]["sources"].append({"id": new_id(), "kind": body.kind, "amount": amount})

    await _journey(sid, fn)
    await add_note(sid, actor_name(user), f"Funding plan: added {body.kind} (₹{lakh(amount)} lakh).")
    if not is_staff(user["role"]):
        await notify.alert_staff(owner_for(student, "finance"), f"{student['name']} updated their funding plan", f"Added {body.kind} (₹{lakh(amount)} lakh).", path=f"/staff/students/{sid}", key=f"funding:{sid}")
    await check_handover(sid)
    return await load_student(sid)


@router.delete("/students/{sid}/funding/sources/{source_id}")
async def remove_funding_source(sid: str, source_id: str, user: CurrentUser):
    student = await student_for(user, sid)
    if is_staff(user["role"]):
        require_area(user, student, "finance")

    def fn(j, _):
        j["funding"]["sources"] = [x for x in j["funding"]["sources"] if x["id"] != source_id]

    await _journey(sid, fn)
    if not is_staff(user["role"]):
        await notify.alert_staff(owner_for(student, "finance"), f"{student['name']} updated their funding plan", "Removed a funding source.", path=f"/staff/students/{sid}", key=f"funding:{sid}")
    return await load_student(sid)


@router.post("/students/{sid}/funding/scholarships")
async def add_scholarship(sid: str, body: ScholarshipBody, user: Staff):
    require_area(user, await student_for(user, sid, who="staff"), "finance")

    def fn(j, _):
        j["funding"]["scholarships"].append({"id": new_id(), "name": body.name, "amount": body.amount, "deadline": body.deadline, "status": "to_apply"})

    await _journey(sid, fn)
    await add_note(sid, user["name"], f"Suggested scholarship: {body.name}.")
    return await load_student(sid)


@router.patch("/students/{sid}/funding/scholarships/{sch_id}")
async def set_scholarship_status(sid: str, sch_id: str, body: ScholarshipStatusBody, user: CurrentUser):
    student = await student_for(user, sid)
    if is_staff(user["role"]):
        require_area(user, student, "finance")
    if not is_staff(user["role"]) and body.status != "applied":
        raise ApiError(403, "Your Financial Aid Officer records the scholarship result.")
    names: list[str] = []

    def fn(j, _):
        sch = next((x for x in j["funding"]["scholarships"] if x["id"] == sch_id), None)
        if not sch:
            raise not_found("Scholarship not found.")
        sch["status"] = body.status
        names.append(sch["name"])

    await _journey(sid, fn)
    if not is_staff(user["role"]):
        await notify.alert_staff(owner_for(student, "finance"), f"{student['name']} applied for a scholarship", f"Marked {names[0]} as applied.", path=f"/staff/students/{sid}")
    return await load_student(sid)


# ---------------------------------------------------------------- documents (all services)


async def _document(sid: str, doc_id: str) -> dict:
    d = await get_db().documents.find_one({"_id": doc_id, "studentId": sid, "deletedAt": None})
    if not d:
        raise not_found("Document not found.")
    return d


@router.post("/students/{sid}/documents")
async def request_document(sid: str, body: DocumentRequestBody, user: Staff):
    student = await student_for(user, sid, who="staff")
    require_area(user, student, DOC_AREA.get(body.category, "counsellor"))
    await get_db().documents.insert_one({"_id": new_id(), "studentId": sid, "name": body.name, "state": "missing", "category": body.category, "createdAt": now(), "requestedBy": user["name"]})
    await add_note(sid, user["name"], f"Requested document: {body.name}.")
    await notify.email_student(student, f"Please upload: {body.name}", f"{user['name']} asked you to upload: {body.name}.", dedupe_key=None)
    return await load_student(sid)


@router.delete("/students/{sid}/documents/{doc_id}")
async def remove_document(sid: str, doc_id: str, user: Staff):
    """Removes a duplicate or mistaken request (and any uploaded file). Verified documents are kept."""
    student = await student_for(user, sid, who="staff")
    d = await _document(sid, doc_id)
    require_area(user, student, DOC_AREA.get(d.get("category", "general"), "counsellor"))
    if d["state"] == "verified":
        raise ApiError(400, "Verified documents can't be removed.")
    had_file = d["state"] != "missing"
    await get_db().documents.update_one({"_id": doc_id}, {"$set": {"deletedAt": now(), "deletedBy": user["_id"]}})
    if d.get("fileKey"):
        await storage.delete(d["fileKey"])
    await close_follow_ups(f"doc:{doc_id}:")
    await add_note(sid, user["name"], f"Removed document request: {d['name']}{' (including the uploaded file)' if had_file else ''}.")
    await check_handover(sid)
    return await load_student(sid)


@router.post("/students/{sid}/documents/{doc_id}/upload-url")
async def document_upload_url(sid: str, doc_id: str, body: UploadUrlBody, user: CurrentUser):
    """Step 1 of an upload: a short-lived URL the browser sends the file to."""
    await student_for(user, sid, who="student")
    d = await _document(sid, doc_id)
    if d["state"] not in ("missing", "rejected"):
        raise ApiError(400, "This document is already uploaded.")
    if body.contentType not in storage.ALLOWED_TYPES:
        raise ApiError(400, "Please upload a PDF, JPG or PNG file.")
    s = get_settings()
    if not s.min_upload_bytes <= body.size <= s.max_upload_bytes:
        msg = f"Files must be between {s.min_upload_bytes // 1024} KB and {s.max_upload_bytes // 1024} KB. This one is {round(body.size / 1024)} KB."
        raise ApiError(400, msg, {"size": msg})
    upload_id = new_id()
    key = storage.object_key(sid, doc_id, upload_id, body.contentType)
    await get_db().uploads.insert_one(
        {"_id": upload_id, "studentId": sid, "documentId": doc_id, "key": key, "contentType": body.contentType, "size": body.size, "fileName": body.fileName[:200], "expiresAt": now() + timedelta(hours=1)}
    )
    return {"uploadId": upload_id, **storage.upload_url(key, body.contentType, body.size)}


@router.post("/students/{sid}/documents/{doc_id}/upload-complete")
async def document_upload_complete(sid: str, doc_id: str, body: UploadCompleteBody, user: CurrentUser):
    """Step 2: checks the stored file (size, real file type, virus scan) and sends it for review."""
    student = await student_for(user, sid, who="student")
    db = get_db()
    up = await db.uploads.find_one({"_id": body.uploadId, "studentId": sid, "documentId": doc_id})
    if not up:
        raise ApiError(400, "The upload has expired. Please try again.")
    d = await _document(sid, doc_id)
    if d["state"] not in ("missing", "rejected"):
        raise ApiError(400, "This document is already uploaded.")
    found = await storage.head(up["key"])
    if not found or found[0] != up["size"] or not storage.matches_magic(up["contentType"], found[1]):
        await storage.delete(up["key"])
        raise ApiError(400, "The file didn't upload correctly, or isn't a real PDF, JPG or PNG. Please try again.")
    if await storage.scan(up["key"]) != "clean":
        await storage.delete(up["key"])
        await audit(user, "document.infected", "documents", doc_id)
        raise ApiError(400, "This file failed our security check. Please upload a different copy.")
    previous_key = d.get("fileKey")
    await db.documents.update_one(
        {"_id": doc_id},
        {
            "$set": {"state": "pending", "fileName": up["fileName"], "fileKey": up["key"], "contentType": up["contentType"], "size": up["size"], "uploadedAt": now(), "viewedBy": []},
            "$unset": {"reason": ""},
        },
    )
    await db.uploads.delete_one({"_id": up["_id"]})
    if previous_key and previous_key != up["key"]:
        await storage.delete(previous_key)
    await add_note(sid, actor_name(user), f"Uploaded “{up['fileName']}” for {d['name']}.")
    await create_follow_up(
        counsellor_id=owner_for(student, DOC_AREA.get(d.get("category", "general"), "counsellor")),
        person=student["name"],
        person_id=sid,
        person_type="student",
        action=f"Verify uploaded document: {d['name']}",
        rule="Document uploaded · 1 working day",
        due_at=one_working_day_from_now(),
        type_="verify",
        source_event=f"doc:{doc_id}:{up['_id']}",
    )
    await notify.alert_staff(
        owner_for(student, DOC_AREA.get(d.get("category", "general"), "counsellor")), f"{student['name']} uploaded a document", f"{d['name']} is ready to check.",
        path=f"/staff/students/{sid}", kind="document", key=f"doc:{doc_id}",
    )
    return await load_student(sid)


@router.delete("/students/{sid}/documents/{doc_id}/file")
async def remove_upload(sid: str, doc_id: str, user: CurrentUser):
    """The student takes back a file uploaded by mistake, before it is checked."""
    await student_for(user, sid, who="student")
    d = await _document(sid, doc_id)
    if d["state"] != "pending":
        raise ApiError(400, "Only files waiting for review can be removed.")
    await get_db().documents.update_one(
        {"_id": doc_id, "state": "pending"},
        {"$set": {"state": "missing"}, "$unset": {"fileName": "", "fileKey": "", "uploadedAt": "", "contentType": "", "size": ""}},
    )
    if d.get("fileKey"):
        await storage.delete(d["fileKey"])
    await close_follow_ups(f"doc:{doc_id}:")
    await notify.clear_alerts(f"doc:{doc_id}")
    await add_note(sid, actor_name(user), f"Removed the uploaded file for {d['name']}.")
    return await load_student(sid)


@router.post("/students/{sid}/documents/{doc_id}/verify")
async def verify_document(sid: str, doc_id: str, user: Staff):
    student = await student_for(user, sid, who="staff")
    d = await _document(sid, doc_id)
    require_area(user, student, DOC_AREA.get(d.get("category", "general"), "counsellor"))
    if d["state"] != "pending":
        raise ApiError(400, "Only uploaded documents waiting for review can be verified.")
    if user["_id"] not in (d.get("viewedBy") or []):
        raise ApiError(400, "Open the document and check it before verifying it.")
    await get_db().documents.update_one({"_id": doc_id}, {"$set": {"state": "verified", "verifiedAt": now(), "verifiedBy": user["_id"]}, "$unset": {"reason": ""}})
    await close_follow_ups(f"doc:{doc_id}:")
    await notify.clear_alerts(f"doc:{doc_id}")
    await add_note(sid, user["name"], f"Verified document: {d['name']}.")
    await audit(user, "document.verified", "documents", doc_id)
    if d.get("category") == "funds":
        await check_handover(sid)
    return await load_student(sid)


@router.post("/students/{sid}/documents/{doc_id}/reject")
async def reject_document(sid: str, doc_id: str, body: RejectBody, user: Staff):
    student = await student_for(user, sid, who="staff")
    d = await _document(sid, doc_id)
    require_area(user, student, DOC_AREA.get(d.get("category", "general"), "counsellor"))
    if d["state"] != "pending":
        raise ApiError(400, "Only uploaded documents waiting for review can be rejected.")
    await get_db().documents.update_one({"_id": doc_id}, {"$set": {"state": "rejected", "reason": body.reason, "rejectedAt": now(), "rejectedBy": user["_id"]}})
    await close_follow_ups(f"doc:{doc_id}:")
    await notify.clear_alerts(f"doc:{doc_id}")
    await add_note(sid, user["name"], f"Rejected document: {d['name']} ({body.reason}).")
    await audit(user, "document.rejected", "documents", doc_id, {"reason": body.reason})
    await notify.email_student(student, f"Please re-upload: {d['name']}", f"{d['name']} needs to be uploaded again: {body.reason}")
    return await load_student(sid)


@router.get("/students/{sid}/documents/{doc_id}/download-url")
async def document_download_url(sid: str, doc_id: str, user: CurrentUser):
    await student_for(user, sid)
    d = await _document(sid, doc_id)
    if not d.get("fileKey"):
        raise not_found("No file has been uploaded for this document.")
    if is_staff(user["role"]):
        # Remembered so the document can be verified (only by someone who has opened it).
        await get_db().documents.update_one({"_id": doc_id, "fileKey": d["fileKey"]}, {"$addToSet": {"viewedBy": user["_id"]}})
    await audit(user, "document.viewed", "documents", doc_id)
    return {"url": storage.download_url(d["fileKey"], d.get("contentType", "application/octet-stream"), d.get("fileName", "document"))}


# ---------------------------------------------------------------- 5. visa


@router.post("/students/{sid}/visa")
async def set_visa_stage(sid: str, body: VisaBody, user: Staff):
    student = await student_for(user, sid, who="staff")
    require_area(user, student, "visa")

    def fn(j, _):
        v = j.get("visa") or {}
        j["visa"] = {
            "stage": body.stage,
            "history": [*v.get("history", []), {"at": now_iso(), "by": user["name"], "stage": body.stage, **({"note": body.note} if body.note else {})}],
        }
        reference = body.reference or v.get("reference")
        if reference:
            j["visa"]["reference"] = reference
        if body.stage == "refused":
            j["visa"]["refusalReason"] = body.note

    await _journey(sid, fn)
    if body.stage == "submitted":
        await advance_stage(sid, "visa_filed")
        await create_follow_up(
            counsellor_id=owner_for(student, "visa"), person=student["name"], person_id=sid, person_type="student",
            action="Check visa decision status", rule="Visa filed · follow up", due_at=now() + timedelta(days=15), type_="reminder", source_event=f"visa:{sid}:submitted",
        )
    elif body.stage == "granted":
        await advance_stage(sid, "visa_granted")
        await close_follow_ups(f"visa:{sid}:")
    elif body.stage == "refused":
        await close_follow_ups(f"visa:{sid}:")
    ref = f" (reference {body.reference})" if body.reference else ""
    await add_note(sid, user["name"], f"Visa: {VISA_LABELS[body.stage]}{ref}{f'. {body.note}' if body.note else '.'}")
    await audit(user, "visa.stage", "students", sid, {"stage": body.stage})
    await notify.email_student(student, f"Visa update: {VISA_LABELS[body.stage]}", f"Your visa progress was updated: {VISA_LABELS[body.stage]}.")
    return await load_student(sid)


# ---------------------------------------------------------------- 6. pre-departure


@router.put("/students/{sid}/departure/tasks/{key}")
async def set_departure_task(sid: str, key: str, body: DepartureTaskBody, user: CurrentUser):
    student = await student_for(user, sid, who="student")
    if key not in DEPARTURE_TASKS:
        raise not_found("Unknown task.")

    def fn(j, _):
        if (j.get("visa") or {}).get("stage") != "granted":
            raise ApiError(400, "Pre-departure tasks open once your visa is granted.")
        if j["departure"].get("confirmedAt"):
            raise ApiError(400, "Your Visa Officer has already confirmed you are ready to travel.")
        done = j["departure"].setdefault("done", {})
        if body.done:
            done.setdefault(key, now_iso())
        else:
            done.pop(key, None)

    await _journey(sid, fn)
    await notify.alert_staff(owner_for(student, "visa"), f"{student['name']} updated their pre-departure checklist", f"{'Completed' if body.done else 'Reopened'}: {key}.", path=f"/staff/students/{sid}", key=f"departure:{sid}")
    return await load_student(sid)


@router.post("/students/{sid}/departure/confirm")
async def confirm_departure(sid: str, user: Staff):
    require_area(user, await student_for(user, sid, who="staff"), "visa")

    def fn(j, _):
        if any(not j["departure"].get("done", {}).get(k) for k in DEPARTURE_TASKS):
            raise ApiError(400, "All pre-departure tasks must be done first.")
        j["departure"].update(confirmedAt=now_iso(), confirmedBy=user["name"])

    await _journey(sid, fn)
    await add_note(sid, user["name"], f"Confirmed ready to travel (all {len(DEPARTURE_TASKS)} pre-departure tasks done).")
    return await load_student(sid)


# ---------------------------------------------------------------- 7. post-arrival


@router.post("/students/{sid}/arrival")
async def confirm_arrival(sid: str, user: CurrentUser):
    student = await student_for(user, sid, who="student")

    def fn(j, _):
        if not j["departure"].get("confirmedAt"):
            raise ApiError(400, "Your Visa Officer confirms you are ready to travel first.")
        if j["arrival"].get("arrivedAt"):
            raise ApiError(400, "You have already confirmed your arrival.")
        j["arrival"]["arrivedAt"] = now_iso()

    await _journey(sid, fn)
    await advance_stage(sid, "arrived")
    await add_note(sid, actor_name(user), "Confirmed safe arrival.")
    await create_follow_up(
        counsellor_id=owner_for(student, "visa"), person=student["name"], person_id=sid, person_type="student",
        action="1-week check-in after arrival", rule="After arrival · 1 week", due_at=now() + timedelta(days=7), type_="checkin", source_event=f"arrival:{sid}",
    )
    await notify.email_counsellor(owner_for(student, "visa"), f"{student['name']} has arrived safely", f"{student['name']} confirmed their safe arrival.", path=f"/staff/students/{sid}")
    return await load_student(sid)


async def record_final(sid: str, user: dict, note: str) -> None:
    def fn(j, _):
        if not j["arrival"].get("arrivedAt"):
            raise ApiError(400, "The student hasn't confirmed their arrival yet.")
        j["arrival"].update(finalCheckInAt=now_iso(), finalNote=note)

    await _journey(sid, fn)
    await advance_stage(sid, "settled")
    await close_follow_ups(f"arrival:{sid}")
    await add_note(sid, user["name"], f"Final post-arrival check-in: {note}")


@router.post("/students/{sid}/final-check-in")
async def final_check_in(sid: str, body: FinalCheckInBody, user: Staff):
    require_area(user, await student_for(user, sid, who="staff"), "visa")
    await record_final(sid, user, body.note)
    return await load_student(sid)


# ---------------------------------------------------------------- counsellor override


@router.put("/students/{sid}/overrides/{code}")
async def set_override(sid: str, code: str, body: OverrideBody, user: Staff):
    student = await student_for(user, sid, who="staff")
    if code not in SERVICE_TITLES:
        raise not_found("Unknown service.")
    require_area(user, student, SERVICE_AREA[code])

    def fn(j, _):
        overrides = j.setdefault("overrides", {})
        if body.status:
            overrides[code] = {"status": body.status, "reason": body.reason, "by": user["name"], "at": now_iso()}
        else:
            overrides.pop(code, None)

    await _journey(sid, fn)
    text = (
        f"{SERVICE_TITLES[code]} set to “{SERVICE_STATUS_LABELS[body.status]}”: {body.reason}"
        if body.status
        else f"{SERVICE_TITLES[code]} returned to automatic progress: {body.reason}"
    )
    await add_note(sid, user["name"], text)
    await audit(user, "service.override", "students", sid, {"code": code, "status": body.status, "reason": body.reason})
    if code in ("S3", "S4"):
        await check_handover(sid)
    return await load_student(sid)


__all__ = ["router", "record_plan", "record_final", "iso"]
