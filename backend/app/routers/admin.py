"""Administrator tools: overview figures, counsellor assignment, staff accounts, temporary access and partner agencies."""

from datetime import date, timedelta
from statistics import median

from fastapi import APIRouter

from app.config import get_settings
from app.core.audit import audit
from app.core.auth import STAFF_ROLES, Admin, revoke_all_sessions
from app.core.clock import iso, now, today_iso
from app.core.errors import ApiError, not_found
from app.core.security import encrypt, new_totp_secret, random_token, sha256
from app.db import get_db, new_id
from app import matching
from app.domain import profile_complete, stage_index
from app.records import serialize_grant
from app.routers.staff import agencies_with_counts
from app.schemas import AgencyBody, GrantBody, MatchingProfileBody, StaffUserBody
from app.services import notify
from app.services.students import profile_out
from app.services.team import waiting_for

router = APIRouter(prefix="/admin", tags=["admin"])

FUNNEL = [
    ("Enquiries", "new_lead"),
    ("Contacted", "contacted"),
    ("Assessed", "assessed"),
    ("Registered", "registered"),
    ("Applied", "applications_submitted"),
    ("Offer accepted", "offer_accepted"),
    ("Visa granted", "visa_granted"),
    ("Enrolled", "enrolled"),
]
SOURCE_LABELS = {
    "Website": "Website",
    "Google ad": "Google ads",
    "Instagram ad": "Instagram",
    "Referral": "Referrals",
    "Seminar": "Seminars & events",
    "Walk-in": "Walk-in / WhatsApp",
    "WhatsApp": "Walk-in / WhatsApp",
}


@router.get("/overview")
async def overview(_: Admin):
    """Funnel, sources and workload over the last 12 months, worked out from the live records."""
    db = get_db()
    since = now() - timedelta(days=365)
    leads = await db.leads.find({"createdAt": {"$gte": since}}).to_list(None)
    students = await db.students.find({"createdAt": {"$gte": since}}).to_list(None)
    # Each person counts once: a lead that registered is counted by its student record.
    people = [lead["stage"] for lead in leads if not lead.get("convertedStudentId")] + [s["stage"] for s in students]
    funnel = [{"stage": label, "count": sum(1 for st in people if stage_index(st) >= stage_index(key))} for label, key in FUNNEL]

    sources: dict[str, int] = {}
    for lead in leads:
        label = SOURCE_LABELS.get(lead.get("source", ""), lead.get("source", "Other"))
        sources[label] = sources.get(label, 0) + 1
    direct = sum(1 for s in students if not s.get("leadId"))
    if direct:
        sources["Website"] = sources.get("Website", 0) + direct
    lead_sources = [{"source": k, "count": v} for k, v in sorted(sources.items(), key=lambda kv: -kv[1])]

    t = now()
    workload = []
    for c in await db.users.find({"role": "counsellor", "status": "active"}).sort("_id", 1).to_list(None):
        replies = [
            (lead["firstContactAt"] - lead["createdAt"]).total_seconds() / 60
            for lead in leads
            if lead["counsellorId"] == c["_id"] and lead.get("firstContactAt")
        ]
        workload.append(
            {
                "id": c["_id"],
                "name": c["name"],
                "activeStudents": await db.students.count_documents({"counsellorId": c["_id"], "stage": {"$ne": "settled"}}),
                "openLeads": await db.leads.count_documents({"counsellorId": c["_id"], "stage": {"$in": ["new_lead", "contacted", "assessment_booked", "assessed"]}}),
                "overdue": await db.follow_ups.count_documents({"counsellorId": c["_id"], "done": False, "dueAt": {"$lt": t}}),
                "medianResponse": round(median(replies)) if replies else None,
            }
        )
    return {"funnel": funnel, "leadSources": lead_sources, "counsellorWorkload": workload, "agencies": await agencies_with_counts()}


# ---------------------------------------------------------------- counsellor assignment


async def _active_loads() -> tuple[list[dict], dict[str, int]]:
    db = get_db()
    counsellors = await db.users.find({"role": "counsellor", "status": "active"}).sort("_id", 1).to_list(None)
    loads = {c["_id"]: await db.students.count_documents({"counsellorId": c["_id"], "stage": {"$ne": "settled"}}) for c in counsellors}
    return counsellors, loads


def _waiting_out(s: dict) -> dict:
    p = profile_out(s)
    return {
        "id": s["_id"],
        "name": s["name"],
        "reference": s["reference"],
        "email": s["email"],
        "mobile": s["mobile"],
        "registeredAt": iso(s["createdAt"]),
        "profileCompletedAt": iso(s["profileCompletedAt"]) if s.get("profileCompletedAt") else None,
        "profile": {k: p.get(k, "") for k in ("courseInterest", "destination", "intake", "budget", "degree", "institution", "grade", "englishTest", "englishScore", "workExperience", "city")},
        "fromEnquiry": bool(s.get("leadId")),
    }


@router.get("/assignments")
async def assignment_queue(_: Admin):
    """Students without a counsellor: those ready to assign (profile complete, with suggested counsellors, best
    match first) and those still completing their profile."""
    db = get_db()
    counsellors, loads = await _active_loads()
    waiting, incomplete = [], []
    async for s in db.students.find({"counsellorId": None}).sort("createdAt", 1):
        out = _waiting_out(s)
        if profile_complete(s.get("profile")):
            subject = matching.subject_for(out["profile"]["courseInterest"])
            waiting.append({**out, "subject": matching.subject_label(subject) if subject else None, "matches": matching.rank(out["profile"], counsellors, loads)})
        else:
            incomplete.append(out)
    waiting.sort(key=lambda w: w["profileCompletedAt"] or w["registeredAt"])

    # Students ready for a Financial Aid Officer (Application Assistance complete) or a Visa Officer
    # (Scholarship & Financial Guidance complete), with each officer's current workload.
    officers = {}
    for area, role, field in (("finance", "finance_officer", "financeOfficerId"), ("visa", "visa_officer", "visaOfficerId")):
        people = await db.users.find({"role": role, "status": "active"}).sort("_id", 1).to_list(None)
        officers[area] = [{"id": u["_id"], "name": u["name"], "activeStudents": await db.students.count_documents({field: u["_id"], "stage": {"$ne": "settled"}})} for u in people]
        officers[area].sort(key=lambda o: o["activeStudents"])
    lists = {"finance": [], "visa": []}
    async for s in db.students.find({"counsellorId": {"$ne": None}, "stage": {"$ne": "settled"}}).sort("updatedAt", 1):
        area = await waiting_for(s)
        if area:
            f = await db.follow_ups.find_one({"sourceEvent": f"student:{s['_id']}:assign-{area}"})
            lists[area].append({
                "id": s["_id"], "name": s["name"], "reference": s["reference"], "goal": s.get("goal", ""), "destination": s.get("destination", ""), "intake": s.get("intake", ""),
                "counsellorId": s.get("counsellorId"), "financeOfficerId": s.get("financeOfficerId"), "readySince": iso(f["createdAt"]) if f else None,
            })
    return {"waiting": waiting, "incomplete": incomplete, "waitingFinance": lists["finance"], "waitingVisa": lists["visa"], "officers": officers}


@router.get("/counsellors/matching")
async def matching_profiles(_: Admin):
    """Every active counsellor's matching profile and current load, for the assignment screen."""
    counsellors, loads = await _active_loads()
    return [{"id": c["_id"], "name": c["name"], "activeStudents": loads[c["_id"]], "matchingProfile": {**matching.blank_matching_profile(), **(c.get("matchingProfile") or {})}} for c in counsellors]


@router.put("/staff/{user_id}/matching-profile")
async def save_matching_profile(user_id: str, body: MatchingProfileBody, admin: Admin):
    u = await _staff_user(user_id)
    if u["role"] != "counsellor":
        raise ApiError(400, "Only counsellors have a matching profile.")
    profile = body.model_dump()
    await get_db().users.update_one({"_id": user_id}, {"$set": {"matchingProfile": profile, "updatedAt": now()}})
    await audit(admin, "staff.matching_profile", "users", user_id)
    return profile


# ---------------------------------------------------------------- staff accounts


def _staff_out(u: dict) -> dict:
    return {
        "id": u["_id"],
        "name": u["name"],
        "email": u["email"],
        "role": u["role"],
        "status": "deactivated" if u.get("status") == "deactivated" else "active",
        "lastLogin": iso(u["lastLoginAt"]) if u.get("lastLoginAt") else "",
    }


@router.get("/staff")
async def list_staff(_: Admin):
    found = await get_db().users.find({"role": {"$in": list(STAFF_ROLES)}}).sort("_id", 1).to_list(None)
    return [_staff_out(u) for u in found]


async def _send_invite(user: dict, by: dict) -> str:
    """Creates a 72-hour invitation to set a password and an authenticator app. Returns the link."""
    db = get_db()
    token = random_token()
    await db.invites.update_many({"userId": user["_id"], "usedAt": None}, {"$set": {"usedAt": now(), "replaced": True}})
    await db.invites.insert_one(
        {"_id": new_id(), "tokenHash": sha256(token), "userId": user["_id"], "totpSecretEnc": encrypt(new_totp_secret()), "createdBy": by["_id"], "usedAt": None, "expiresAt": now() + timedelta(hours=72)}
    )
    link = notify.portal_link(f"/staff/setup/{token}")
    await notify.queue_email(
        user["email"],
        "Your AHat staff account",
        f"Hello {user['name'].split(' ')[0]},\n\n{by['name']} created an AHat staff account for you. Set your password and authenticator app here:\n{link}\n\n"
        "The link works for 72 hours.\n\nAHat",
        urgent=True,
    )
    return link


@router.post("/staff")
async def add_staff(body: StaffUserBody, admin: Admin):
    db = get_db()
    if await db.users.find_one({"email": body.email}):
        raise ApiError(409, "A user with this email already exists.", {"email": "A staff user with this email already exists."})
    user = {"_id": new_id(), "role": body.role, "name": body.name, "email": body.email, "mobile": "", "status": "invited", "createdAt": now(), "createdBy": admin["_id"]}
    if body.role in ("counsellor", "finance_officer", "visa_officer"):
        user["counsellorProfile"] = {"phone": body.phone, "meetingLink": body.meetingLink}
    await db.users.insert_one(user)
    link = await _send_invite(user, admin)
    await audit(admin, "staff.invited", "users", user["_id"], {"role": body.role})
    out = {"user": _staff_out(user)}
    if get_settings().expose_dev_codes:
        out["demoInviteLink"] = link
    return out


async def _staff_user(user_id: str) -> dict:
    u = await get_db().users.find_one({"_id": user_id, "role": {"$in": list(STAFF_ROLES)}})
    if not u:
        raise not_found("Staff user not found.")
    return u


@router.post("/staff/{user_id}/deactivate")
async def deactivate(user_id: str, admin: Admin):
    u = await _staff_user(user_id)
    if u["_id"] == admin["_id"]:
        raise ApiError(400, "You can't deactivate your own account.")
    if u["role"] == "admin" and await get_db().users.count_documents({"role": "admin", "status": "active"}) <= 1:
        raise ApiError(400, "At least one administrator must stay active.")
    await get_db().users.update_one({"_id": user_id}, {"$set": {"status": "deactivated", "deactivatedAt": now()}})
    await revoke_all_sessions(user_id)
    await audit(admin, "staff.deactivated", "users", user_id)
    return _staff_out({**u, "status": "deactivated"})


@router.post("/staff/{user_id}/reactivate")
async def reactivate(user_id: str, admin: Admin):
    u = await _staff_user(user_id)
    status = "active" if u.get("passwordHash") else "invited"
    await get_db().users.update_one({"_id": user_id}, {"$set": {"status": status}, "$unset": {"deactivatedAt": ""}})
    await audit(admin, "staff.reactivated", "users", user_id)
    out = {"user": _staff_out({**u, "status": status})}
    if status == "invited":
        link = await _send_invite(u, admin)
        if get_settings().expose_dev_codes:
            out["demoInviteLink"] = link
    return out


@router.post("/staff/{user_id}/reset-access")
async def reset_access(user_id: str, admin: Admin):
    """Lost phone or forgotten password: signs the user out everywhere and sends a new set-up link."""
    u = await _staff_user(user_id)
    await get_db().users.update_one({"_id": user_id}, {"$set": {"status": "invited"}, "$unset": {"passwordHash": "", "totpSecretEnc": "", "totpLastStep": ""}})
    await revoke_all_sessions(user_id)
    link = await _send_invite(u, admin)
    await audit(admin, "staff.access_reset", "users", user_id)
    out = {"user": _staff_out({**u, "status": "invited", "lastLoginAt": u.get("lastLoginAt")})}
    if get_settings().expose_dev_codes:
        out["demoInviteLink"] = link
    return out


# ---------------------------------------------------------------- temporary access


@router.post("/access-grants")
async def grant_access(body: GrantBody, admin: Admin):
    db = get_db()
    errors = {}
    grantee = await db.users.find_one({"_id": body.granteeId, "role": "counsellor", "status": "active"})
    owner = await db.users.find_one({"_id": body.ownerId, "role": "counsellor"})
    if not grantee:
        errors["granteeId"] = "Choose who gets access."
    if not owner:
        errors["ownerId"] = "Choose whose students they can see."
    elif body.ownerId == body.granteeId:
        errors["ownerId"] = "Choose a different counsellor."
    max_until = (date.fromisoformat(today_iso()) + timedelta(days=30)).isoformat()
    if body.until < today_iso() or body.until > max_until:
        errors["until"] = "End date must be within the next 30 days."
    if errors:
        raise ApiError(400, next(iter(errors.values())), errors)
    g = {"_id": new_id(), "granteeId": body.granteeId, "ownerId": body.ownerId, "until": body.until, "reason": body.reason, "grantedBy": admin["name"], "grantedById": admin["_id"], "createdAt": now()}
    await db.access_grants.insert_one(g)
    await audit(admin, "grant.created", "access_grants", g["_id"], {"grantee": body.granteeId, "owner": body.ownerId, "until": body.until})
    await notify.email_counsellor(body.granteeId, f"You're covering for {owner['name']}", f"You can see {owner['name']}'s leads and students until {body.until} ({body.reason}).")
    return serialize_grant(g)


@router.post("/access-grants/{grant_id}/revoke")
async def revoke_grant(grant_id: str, admin: Admin):
    g = await get_db().access_grants.find_one_and_update({"_id": grant_id}, {"$set": {"revoked": True, "revokedAt": now(), "revokedBy": admin["_id"]}}, return_document=True)
    if not g:
        raise not_found("Grant not found.")
    await audit(admin, "grant.revoked", "access_grants", grant_id)
    return serialize_grant(g)


# ---------------------------------------------------------------- partner agencies


@router.post("/agencies")
async def add_agency(body: AgencyBody, admin: Admin):
    db = get_db()
    if await db.agencies.find_one({"name": body.name}):
        raise ApiError(409, "An agency with this name already exists.", {"name": "An agency with this name already exists."})
    doc = {"_id": new_id(), **body.model_dump(), "createdAt": now()}
    await db.agencies.insert_one(doc)
    await audit(admin, "agency.created", "agencies", doc["_id"])
    return next(a for a in await agencies_with_counts() if a["id"] == doc["_id"])


@router.put("/agencies/{agency_id}")
async def update_agency(agency_id: str, body: AgencyBody, admin: Admin):
    res = await get_db().agencies.update_one({"_id": agency_id}, {"$set": {**body.model_dump(), "updatedAt": now()}})
    if not res.matched_count:
        raise not_found("Agency not found.")
    await audit(admin, "agency.updated", "agencies", agency_id)
    return next(a for a in await agencies_with_counts() if a["id"] == agency_id)


# ---------------------------------------------------------------- demo data (development only)


@router.post("/demo/reset", status_code=204)
async def reset_demo(admin: Admin):
    if not get_settings().is_dev:
        raise not_found()
    from app.seed import seed

    await seed(keep_logins=True)
    await audit(admin, "demo.reset", "system", "demo")
