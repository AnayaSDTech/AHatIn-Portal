"""Staff work lists: leads, follow-ups, counsellors, access scope, agencies and the follow-up rules."""

from datetime import timedelta

from fastapi import APIRouter

from app.config import get_settings
from app.core import policy
from app.core.audit import audit
from app.core.auth import Admin, CurrentUser, Staff, is_staff, public_user
from app.core.clock import iso, now
from app.core.errors import ApiError, not_found
from app.core.scope import active_grant_filter, scope_for, visible_lead
from app import matching
from app.db import get_db
from app.domain import LEAD_STAGES, STAGE_LABELS, follow_up_rules, stage_index
from app.records import serialize_alert, serialize_counsellor, serialize_follow_up, serialize_grant, serialize_lead
from app.schemas import BusinessRulesBody, ContactBody, LeadStageBody, MatchingProfileBody, OwnNameBody, ReassignBody
from app.services import notify
from app.services.students import own_record
from app.services.team import team_of
from app.services.workflow import close_follow_ups, create_follow_up

router = APIRouter(tags=["staff"])


# ---------------------------------------------------------------- notifications


@router.get("/staff/notifications")
async def my_notifications(user: Staff):
    found = await get_db().staff_alerts.find({"userId": user["_id"]}).sort("createdAt", -1).to_list(200)
    return [serialize_alert(a) for a in found]


@router.post("/staff/notifications/read-all", status_code=204)
async def read_all_notifications(user: Staff):
    await get_db().staff_alerts.delete_many({"userId": user["_id"]})


@router.post("/staff/notifications/{alert_id}/read", status_code=204)
async def read_notification(alert_id: str, user: Staff):
    await get_db().staff_alerts.delete_one({"_id": alert_id, "userId": user["_id"]})


# ---------------------------------------------------------------- who the user is and what they may see


@router.get("/staff/scope")
async def my_scope(user: Staff):
    scope = await scope_for(user)
    return {
        "isAdmin": scope.is_admin,
        "myId": user["_id"] if user["role"] not in ("admin", "officer") else None,
        # Officers see exactly the students the server returns (the ones assigned to them).
        "allStudents": scope.all_students or bool(scope.officer_field),
        "ownerIds": scope.owner_ids,
        "covering": [serialize_grant(g) for g in scope.covering],
    }


@router.get("/counsellors")
async def list_counsellors(user: CurrentUser):
    """Staff: every counsellor and officer (including former ones, for names in history). Students: their own team."""
    if not is_staff(user["role"]):
        return [p for p in (await team_of(await own_record(user))).values() if p]
    found = await get_db().users.find({"role": {"$in": ["counsellor", "finance_officer", "visa_officer"]}}).sort("_id", 1).to_list(None)
    return [{**serialize_counsellor(c), "active": c.get("status") == "active"} for c in found]


# ---------------------------------------------------------------- staff members' own details


@router.put("/staff/me/name")
async def change_my_name(body: OwnNameBody, user: Staff):
    """Staff can correct their own name (shown to students and in records from now on; earlier history keeps the old one)."""
    await get_db().users.update_one({"_id": user["_id"]}, {"$set": {"name": body.name, "updatedAt": now()}})
    await audit(user, "staff.name_changed", "users", user["_id"], {"from": user["name"], "to": body.name})
    return public_user({**user, "name": body.name})


# ---------------------------------------------------------------- the counsellor's own matching profile


def _counsellor_only(user: dict) -> None:
    if user["role"] != "counsellor":
        raise ApiError(403, "Only counsellors have a matching profile.")


@router.get("/staff/me/matching-profile")
async def my_matching_profile(user: Staff):
    """What the counsellor tells AHat about themselves, used to suggest them for new students. Students don't see it."""
    _counsellor_only(user)
    active = await get_db().students.count_documents({"counsellorId": user["_id"], "stage": {"$ne": "settled"}})
    return {"matchingProfile": {**matching.blank_matching_profile(), **(user.get("matchingProfile") or {})}, "activeStudents": active}


@router.put("/staff/me/matching-profile")
async def save_my_matching_profile(body: MatchingProfileBody, user: Staff):
    """Each counsellor keeps their own matching profile up to date; the admin only invites staff."""
    _counsellor_only(user)
    profile = body.model_dump()
    await get_db().users.update_one({"_id": user["_id"]}, {"$set": {"matchingProfile": profile, "updatedAt": now()}})
    await audit(user, "staff.matching_profile", "users", user["_id"])
    return profile


# ---------------------------------------------------------------- leads


@router.get("/leads")
async def list_leads(user: Staff):
    scope = await scope_for(user)
    found = await get_db().leads.find({**scope.lead_filter(), "stage": {"$in": LEAD_STAGES}}).sort("createdAt", -1).to_list(None)
    return [serialize_lead(lead) for lead in found]


async def _push_activity(lead_id: str, activity: dict, extra: dict | None = None) -> dict:
    return await get_db().leads.find_one_and_update(
        {"_id": lead_id},
        {"$push": {"activities": {"$each": [activity], "$position": 0}}, "$set": {**(extra or {}), "updatedAt": now()}},
        return_document=True,
    )


@router.post("/leads/{lead_id}/contacts")
async def log_contact(lead_id: str, body: ContactBody, user: Staff):
    lead = await visible_lead(user, lead_id)
    t = now()
    activity = {"at": t, "channel": body.channel, "outcome": body.outcome, "by": user["name"]}
    if body.notes:
        activity["notes"] = body.notes
    extra: dict = {}
    if not lead.get("firstContactAt"):
        extra["firstContactAt"] = t
    reached_new = lead["stage"] == "new_lead" and body.outcome == "Reached"
    if reached_new:
        # Reaching a new lead moves it to "Contacted" automatically.
        extra["stage"] = "contacted"
    was_contacted = lead["stage"] == "contacted"
    lead = await _push_activity(lead_id, activity, extra)
    if body.outcome == "Reached":
        await close_follow_ups(f"lead:{lead_id}:first-contact")
    if reached_new:
        hours = policy.current()["followUps"]["bookSessionHours"]
        await create_follow_up(
            counsellor_id=lead["counsellorId"], person=lead["name"], person_id=lead_id, person_type="lead",
            action="Book an assessment session", rule=f"Contacted, no session booked · {policy.plural(hours, 'hour')}", due_at=t + timedelta(hours=hours), type_="call",
            source_event=f"lead:{lead_id}:book",
        )
    elif was_contacted:
        await _chase_contacted_lead(lead, user)
    return serialize_lead(lead)


UNANSWERED = ("No answer", "Call back later", "Wrong number")
COLD_LEAD_TRIES = 3


def unanswered_tries(lead: dict) -> int:
    """Unanswered contact attempts since the lead was last reached (activities are newest first)."""
    tries = 0
    for a in lead.get("activities", []):
        if a.get("channel") == "System":
            continue
        if a.get("outcome") == "Reached":
            break
        if a.get("outcome") in UNANSWERED:
            tries += 1
    return tries


async def _chase_contacted_lead(lead: dict, user: dict) -> None:
    """A contact was logged on a lead that is contacted but has no assessment booked yet. The current "book a session" task is
    replaced by the next one, due in N days (Settings page). After 3 unanswered tries no more tasks are created and the managers
    are alerted once; "Not interested" ends the follow-ups."""
    lead_id = lead["_id"]
    await close_follow_ups(f"lead:{lead_id}:book")
    if lead["activities"][0].get("outcome") == "Not interested":
        return
    tries = unanswered_tries(lead)
    if tries == 0 and lead.get("coldAlertAt"):  # reached again: a later run of unanswered tries alerts the managers again
        await get_db().leads.update_one({"_id": lead_id}, {"$unset": {"coldAlertAt": ""}})
    if tries >= COLD_LEAD_TRIES:
        if not lead.get("coldAlertAt"):
            await get_db().leads.update_one({"_id": lead_id}, {"$set": {"coldAlertAt": now()}})
            owner = await get_db().users.find_one({"_id": lead["counsellorId"]}, {"name": 1}) if lead["counsellorId"] else None
            text = f"{lead['name']}: {tries} unanswered contact attempts ({owner['name'] if owner else 'handled by the admin'}). Consider reassigning or closing the lead."
            await notify.email_admins(f"Lead gone cold: {lead['name']}", text, dedupe_key=f"cold-lead:{lead_id}", alert_path=f"/staff/leads?open={lead_id}", alert_text=text)
        return
    days = policy.current()["followUps"]["nextFollowUpDays"]
    attempt = sum(1 for a in lead["activities"] if a.get("channel") != "System")
    await create_follow_up(
        counsellor_id=lead["counsellorId"], person=lead["name"], person_id=lead_id, person_type="lead",
        action="Book an assessment session", rule=f"Contacted, no session booked · then {policy.plural(days, 'day')}", due_at=now() + timedelta(days=days), type_="call",
        source_event=f"lead:{lead_id}:book:{attempt}",
    )


@router.post("/leads/{lead_id}/stage")
async def set_lead_stage(lead_id: str, body: LeadStageBody, user: Staff):
    lead = await visible_lead(user, lead_id)
    if body.stage == lead["stage"]:
        return serialize_lead(lead)
    back = stage_index(body.stage) < stage_index(lead["stage"])
    reason = (body.reason or "").strip()
    if back and len(reason) < 5:
        raise ApiError(400, "Give a reason for moving the lead back a stage.", {"reason": "Give a reason for moving the lead back a stage."})
    activity = {"at": now(), "channel": "System", "outcome": f"Stage changed to {STAGE_LABELS[body.stage]}", "by": user["name"]}
    if back:
        activity["notes"] = reason
    lead = await _push_activity(lead_id, activity, {"stage": body.stage})
    if stage_index(body.stage) >= stage_index("assessment_booked"):
        await close_follow_ups(f"lead:{lead_id}:book")
        await close_follow_ups(f"lead:{lead_id}:first-contact")
    if body.stage == "assessed":
        hours = policy.current()["followUps"]["planFollowUpHours"]  # editable on the Settings page
        await create_follow_up(
            counsellor_id=lead["counsellorId"], person=lead["name"], person_id=lead_id, person_type="lead",
            action="Follow up on shared plan", rule=f"Plan shared, not registered · {policy.plural(hours, 'hour')}", due_at=now() + timedelta(hours=hours), type_="call",
            source_event=f"lead:{lead_id}:plan",
        )
    return serialize_lead(lead)


@router.post("/leads/{lead_id}/reassign")
async def reassign_lead(lead_id: str, body: ReassignBody, user: Admin):
    db = get_db()
    lead = await visible_lead(user, lead_id)
    target = await db.users.find_one({"_id": body.counsellorId, "role": "counsellor", "status": "active"})
    if not target or target["_id"] == lead["counsellorId"]:
        raise ApiError(400, "Choose a different, active counsellor.", {"counsellorId": "Choose a different, active counsellor."})
    old = await db.users.find_one({"_id": lead["counsellorId"]}) if lead["counsellorId"] else None
    outcome = f"Reassigned from {old['name']} to {target['name']} by {user['name']}" if old else f"Assigned to {target['name']} by {user['name']}"
    activity = {"at": now(), "channel": "System", "outcome": outcome, "notes": body.reason}
    lead = await _push_activity(lead_id, activity, {"counsellorId": target["_id"]})
    await db.follow_ups.update_many({"personId": lead_id, "done": False}, {"$set": {"counsellorId": target["_id"]}})
    await audit(user, "lead.reassigned", "leads", lead_id, {"to": target["_id"], "reason": body.reason})
    await notify.email_counsellor(target["_id"], f"New lead assigned: {lead['name']}", f"{lead['name']} ({lead['interest']}) is now assigned to you. Reason: {body.reason}", path=f"/staff/leads?open={lead_id}", kind="assigned")
    return serialize_lead(lead)


# ---------------------------------------------------------------- follow-ups


@router.get("/follow-ups")
async def list_follow_ups(user: Staff):
    scope = await scope_for(user)
    filt = {} if scope.is_admin else {"counsellorId": {"$in": scope.owner_ids}}
    # Completed ones from the last 30 days are kept for the "Show completed" list.
    since = now() - timedelta(days=30)
    found = await get_db().follow_ups.find({**filt, "$or": [{"done": False}, {"doneAt": {"$gte": since}}, {"doneAt": None, "done": True}]}).sort("dueAt", 1).to_list(None)
    return [serialize_follow_up(f) for f in found]


@router.post("/follow-ups/{fid}/done")
async def complete_follow_up(fid: str, user: Staff):
    db = get_db()
    f = await db.follow_ups.find_one({"_id": fid})
    scope = await scope_for(user)
    if not f or not (scope.is_admin or f["counsellorId"] in scope.owner_ids):
        raise not_found("Follow-up not found.")
    await db.follow_ups.update_one({"_id": fid}, {"$set": {"done": True, "doneAt": now(), "doneBy": user["_id"]}})
    return serialize_follow_up({**f, "done": True})


# ---------------------------------------------------------------- grants, agencies, settings


@router.get("/grants")
async def list_grants(user: Staff):
    db = get_db()
    if user["role"] == "admin":
        found = await db.access_grants.find({}).sort("_id", 1).to_list(None)
    else:
        found = await db.access_grants.find({"$or": [{"granteeId": user["_id"]}, {"ownerId": user["_id"]}], **active_grant_filter()}).to_list(None)
    return [serialize_grant(g) for g in found]


async def agencies_with_counts() -> list[dict]:
    db = get_db()
    counts = {r["_id"]: r["n"] async for r in db.applications.aggregate([{"$match": {"state": {"$ne": "draft"}}}, {"$group": {"_id": "$agency", "n": {"$sum": 1}}}])}
    out = []
    for a in await db.agencies.find({}).sort("name", 1).to_list(None):
        out.append(
            {
                "id": a["_id"],
                "name": a["name"],
                "type": a["type"],
                "countries": a["countries"],
                "commissionShare": a["commissionShare"],
                "agreementEnd": a["agreementEnd"],
                "status": a["status"],
                "applications": a.get("historicApplications", 0) + counts.get(a["name"], 0),
            }
        )
    return out


@router.get("/agencies")
async def list_agencies(user: Staff):
    return await agencies_with_counts()


def _settings_out(user: dict) -> dict:
    s = get_settings()
    rules = policy.current()
    wh = rules["workingHours"]
    return {
        "workingHours": {**wh, "label": policy.days_label(wh["days"])},
        "quietHours": rules["quietHours"],
        "followUpLimits": rules["followUps"],
        # Security settings stay in the server configuration, not on this page.
        "staffSecurity": {"twoStep": True, "idleMinutes": s.staff_idle_minutes, "maxHours": s.staff_max_hours},
        "followUpRules": follow_up_rules(),
        "canEdit": user["role"] == "admin",
        # The "Reset demo data" panel: development on a test database only, never against live data.
        "demoTools": s.can_load_demo_data,
    }


@router.get("/settings")
async def settings(user: Staff):
    await policy.reload()  # always the saved values here, not a cached copy
    return _settings_out(user)


@router.put("/settings")
async def update_settings(body: BusinessRulesBody, user: Admin):
    """Admins change working hours, quiet hours or follow-up time limits. New follow-ups use the new values; ones already in staff
    lists keep their due times."""
    changes = body.model_dump(exclude_none=True)
    current = await policy.reload()
    wh = changes.get("workingHours", current["workingHours"])
    fu = changes.get("followUps", current["followUps"])
    if not policy.minutes(wh["start"]) <= policy.minutes(fu["firstContactNextDay"]) < policy.minutes(wh["end"]):
        message = f"Choose a time within working hours ({wh['start']}–{wh['end']})."
        raise ApiError(400, message, {"firstContactNextDay": message})
    before, after = await policy.save(changes)
    await audit(user, "settings.update", "settings", policy.DOC_ID, {"before": {k: before[k] for k in changes}, "after": {k: after[k] for k in changes}})
    await _tell_staff_about_rule_changes(before, after, user)
    return _settings_out(user)


def _rule_changes(before: dict, after: dict) -> list[tuple[str, str, str, bool]]:
    """(rule, new value, old value, leads only) for each changed rule that sets a deadline for staff."""
    p = policy
    wh = lambda w: f"{p.days_label(w['days'])}, {w['start']}–{w['end']} IST"  # noqa: E731
    # (section, key, rule and what staff must do, how to show the value, leads only)
    rules = [
        ("workingHours", None, "Working hours:", wh, False),
        ("followUps", "firstContactMinutes", "New enquiry, in working hours: make first contact within", lambda v: p.plural(v, "minute"), True),
        ("followUps", "firstContactNextDay", "New enquiry, out of hours: make first contact on the next working day by", str, True),
        ("followUps", "bookSessionHours", "Contacted, no session booked: follow up within", lambda v: p.plural(v, "hour"), True),
        ("followUps", "nextFollowUpDays", "Contacted, no session booked: after that, follow up every", lambda v: p.plural(v, "day"), True),
        ("followUps", "planFollowUpHours", "Plan shared, not registered: follow up within", lambda v: p.plural(v, "hour"), True),
        ("followUps", "documentCheckWorkingDays", "Document uploaded: verify or reject within", lambda v: p.plural(v, "working day"), False),
        ("followUps", "arrivalCheckInDays", "Student confirms safe arrival: check in within", lambda v: p.plural(v, "day"), False),
        ("followUps", "deadlineReminderDays", "Application and scholarship deadlines: reminders", p.deadline_days_label, False),
    ]
    out = []
    for section, key, label, show, leads_only in rules:
        old = before[section] if key is None else before[section][key]
        new = after[section] if key is None else after[section][key]
        if old != new:
            out.append((label, show(new), show(old), leads_only))
    return out


async def _tell_staff_about_rule_changes(before: dict, after: dict, admin: dict) -> None:
    """A changed deadline is shown to the staff it affects (notification and email): counsellors for lead rules, and every counsellor,
    officer and the other admins for rules about students and working hours. Quiet hours only affect emails to students, so no one is told."""
    changes = _rule_changes(before, after)
    if not changes:
        return
    everyone = ("counsellor", "officer", "finance_officer", "visa_officer", "admin")
    roles = ("counsellor",) if all(leads_only for *_, leads_only in changes) else everyone
    t = now()
    async for u in get_db().users.find({"role": {"$in": list(roles)}, "status": "active", "_id": {"$ne": admin["_id"]}}, {"role": 1, "name": 1, "email": 1}):
        mine = [c for c in changes if not c[3] or u["role"] in ("counsellor", "admin")]  # lead rules only matter to those who handle leads
        if not mine:
            continue
        path = "/admin/settings" if u["role"] == "admin" else "/staff"
        # The email lists every change; the notification (limited to 300 characters) lists as many as fit.
        lines = "\n".join(f"• {label} {new} (was {old})." for label, new, old, _ in mine)
        await notify.alert_staff(u["_id"], "Follow-up rules changed", _short_summary(mine), path=path, kind="update", key="rules-changed")
        body = (
            f"Hello {u['name'].split(' ')[0]},\n\n{admin['name']} changed the follow-up rules:\n{lines}\n\n"
            f"New follow-ups use the new times; tasks already in your list keep their due times.\n\nOpen the staff portal: {notify.portal_link(path)}\n\nAHat"
        )
        await notify.queue_email(u["email"], "Follow-up rules changed", body, dedupe_key=f"rules-changed:{t.timestamp()}:{u['_id']}")


def _short_summary(changes: list[tuple[str, str, str, bool]], limit: int = 280) -> str:
    """'Plan shared, not registered: follow up within 24 hours (was 48 hours).' for as many changes as fit; the rest are counted."""
    parts: list[str] = []
    for i, (label, new, old, _) in enumerate(changes):
        part = f"{label} {new} (was {old})."
        rest = len(changes) - i - 1
        tail = f" And {rest} more: see your email." if rest else ""
        if parts and len(" ".join([*parts, part])) + len(tail) > limit:
            return " ".join(parts) + f" And {len(changes) - i} more: see your email."
        parts.append(part)
    return " ".join(parts)


__all__ = ["router", "iso"]
