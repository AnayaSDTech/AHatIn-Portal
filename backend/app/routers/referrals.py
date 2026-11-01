"""Refer a Friend/Family, for students and counsellors. Admins see every referral."""

from typing import Annotated

from fastapi import APIRouter, Depends

from app.config import get_settings
from app.core.auth import require_roles
from app.core.clock import iso, now
from app.core.errors import ApiError
from app.core.ratelimit import hit
from app.db import get_db, new_id
from app.schemas import ReferralBody
from app.services import notify
from app.services.referrals import STATUSES, referral_code, referral_link, status_of

router = APIRouter(tags=["referrals"])

Referrer = Annotated[dict, Depends(require_roles("student", "counsellor", "admin"))]


def _out(r: dict, status: str, *, with_referrer: bool) -> dict:
    out = {"id": r["_id"], "name": r["name"], "relation": r.get("relation", ""), "source": r.get("source", "invite"), "status": status, "at": iso(r["createdAt"])}
    if r.get("registeredAt"):
        out["registeredAt"] = iso(r["registeredAt"])
    if with_referrer:
        out["referrer"] = r["referrerName"]
    return out


@router.get("/referrals")
async def my_referrals(user: Referrer):
    db = get_db()
    admin = user["role"] == "admin"
    found = await db.referrals.find({} if admin else {"referrerId": user["_id"]}).sort("createdAt", -1).to_list(500)
    statuses = await status_of(found)
    code = await referral_code(user)
    reached = lambda step: sum(1 for s in statuses.values() if STATUSES.index(s) >= STATUSES.index(step))  # noqa: E731
    return {
        "code": code,
        "link": referral_link(code),
        "totals": {"referred": len(found), "registered": reached("registered"), "applied": reached("applied"), "accepted": reached("accepted")},
        "items": [_out(r, statuses[r["_id"]], with_referrer=admin) for r in found],
    }


@router.post("/referrals")
async def invite_someone(body: ReferralBody, user: Referrer):
    await hit(f"referral:{user['_id']}", 20, 86400, "You've sent a lot of invitations today. Please try again tomorrow.")
    db = get_db()
    if body.email == user["email"]:
        raise ApiError(400, "You can't refer yourself.", {"email": "Enter the email of the person you're referring."})
    if await db.users.find_one({"email": body.email}) or await db.students.find_one({"email": body.email}):
        raise ApiError(409, "This person already has an account with us.", {"email": "This person already has an account with us."})
    if await db.referrals.find_one({"email": body.email}):
        raise ApiError(409, "This person has already been referred.", {"email": "This person has already been referred."})
    code = await referral_code(user)
    doc = {
        "_id": new_id(), "referrerId": user["_id"], "referrerRole": user["role"], "referrerName": user["name"], "name": body.name, "email": body.email,
        "relation": body.relation, "source": "invite", "studentId": None, "createdAt": now(),
    }
    await db.referrals.insert_one(doc)
    link = referral_link(code)
    first = body.name.split(" ")[0]
    await notify.queue_email(
        body.email,
        f"{user['name']} thinks AHat could help you study abroad",
        f"Hello {first},\n\n{user['name']} suggested we get in touch. AHat offers free, honest guidance for students who want to study in the UK and Europe, "
        f"from choosing a course to settling in abroad.\n\nCreate your free account here:\n{link}\n\nIf this isn't for you, you can ignore this email and we won't contact you again.\n\nAHat",
    )
    out = _out(doc, "invited", with_referrer=False)
    if get_settings().show_email_code(body.email):
        out["demoLink"] = link
    return out
