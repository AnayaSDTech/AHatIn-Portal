"""Staff work lists: leads, follow-ups, counsellors, access scope, agencies and the follow-up rules."""

from datetime import timedelta

from fastapi import APIRouter

from app.config import get_settings
from app.core.audit import audit
from app.core.auth import Admin, CurrentUser, Staff, is_staff, public_user
from app.core.clock import iso, now
from app.core.errors import ApiError, not_found
from app.core.scope import active_grant_filter, scope_for, visible_lead
from app import matching
from app.db import get_db
from app.domain import FOLLOW_UP_RULES, LEAD_STAGES, STAGE_LABELS, stage_index
from app.records import serialize_counsellor, serialize_follow_up, serialize_grant, serialize_lead
from app.schemas import ContactBody, LeadStageBody, MatchingProfileBody, OwnNameBody, ReassignBody
from app.services import notify
from app.services.students import own_record
from app.services.team import team_of
from app.services.workflow import close_follow_ups, create_follow_up

router = APIRouter(tags=["staff"])


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
    lead = await _push_activity(lead_id, activity, extra)
    if body.outcome == "Reached":
        await close_follow_ups(f"lead:{lead_id}:first-contact")
    if reached_new:
        await create_follow_up(
            counsellor_id=lead["counsellorId"], person=lead["name"], person_id=lead_id, person_type="lead",
            action="Book an assessment session", rule="Contacted, no session booked · 48 hours", due_at=t + timedelta(hours=48), type_="call", source_event=f"lead:{lead_id}:book",
        )
    return serialize_lead(lead)


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
        await create_follow_up(
            counsellor_id=lead["counsellorId"], person=lead["name"], person_id=lead_id, person_type="lead",
            action="Follow up on shared plan", rule="Plan shared, not registered · 48 hours", due_at=now() + timedelta(hours=48), type_="call", source_event=f"lead:{lead_id}:plan",
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
    await notify.email_counsellor(target["_id"], f"New lead assigned: {lead['name']}", f"{lead['name']} ({lead['interest']}) is now assigned to you. Reason: {body.reason}", path=f"/staff/leads?open={lead_id}")
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


@router.get("/settings")
async def settings(user: Staff):
    s = get_settings()
    return {
        "workingHours": {"days": "Monday – Saturday", "start": "10:00", "end": "19:00"},
        "quietHours": {"start": "21:00", "end": "08:00"},
        "staffSecurity": {"twoStep": True, "idleMinutes": s.staff_idle_minutes, "maxHours": s.staff_max_hours},
        "followUpRules": FOLLOW_UP_RULES,
        "demoTools": s.is_dev,
    }


__all__ = ["router", "iso"]
