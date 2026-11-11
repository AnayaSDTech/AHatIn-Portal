"""Refer a Friend/Family: personal referral links, invitations by email, and who became a student through them."""

import secrets

from pymongo.errors import DuplicateKeyError

from app.core.auth import REFERRER, is_staff
from app.core.clock import now
from app.db import get_db, new_id
from app.records import add_note
from app.services import notify

# No 0/O or 1/I: the code may be read out or typed from a message.
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
# How far a referred person has got, in order.
STATUSES = ["invited", "registered", "profile", "applied", "accepted"]


async def referral_code(user: dict) -> str:
    """The user's personal code, created the first time it is needed."""
    if user.get("referralCode"):
        return user["referralCode"]
    db = get_db()
    for _ in range(5):
        code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(8))
        try:
            await db.users.update_one({"_id": user["_id"], "referralCode": None}, {"$set": {"referralCode": code}})
        except DuplicateKeyError:
            continue
        saved = await db.users.find_one({"_id": user["_id"]}, {"referralCode": 1})
        if saved and saved.get("referralCode"):
            return saved["referralCode"]
    raise RuntimeError("Could not create a referral code.")


def referral_link(code: str) -> str:
    return notify.portal_link(f"/register?ref={code}")


async def link_referral(user: dict, record: dict, code: str | None) -> None:
    """A new student registered: credits whoever invited their email, or else whoever's link they used."""
    db = get_db()
    email = user["email"]
    referral = await db.referrals.find_one({"email": email, "studentId": None}, sort=[("createdAt", 1)])
    if not referral and code:
        referrer = await db.users.find_one({"referralCode": code.strip().upper(), "status": "active"})
        if referrer and referrer["email"] != email:
            referral = {
                "_id": new_id(), "referrerId": referrer["_id"], "referrerRole": referrer["role"], "referrerName": referrer["name"], "name": user["name"], "email": email,
                "relation": "", "source": "link", "studentId": None, "createdAt": now(),
            }
            await db.referrals.insert_one(referral)
    if not referral:
        return
    await db.referrals.update_one({"_id": referral["_id"]}, {"$set": {"studentId": record["_id"], "registeredAt": now()}})
    await add_note(record["_id"], "System", f"Referred by {referral['referrerName']}.")
    if is_staff(referral["referrerRole"]):
        await notify.alert_staff(referral["referrerId"], f"{user['name']} registered from your referral", "They now have a student account.", path="/staff/referrals")
    elif referral["referrerRole"] == REFERRER and (referrer := await db.users.find_one({"_id": referral["referrerId"], "status": "active"})):
        await notify.queue_email(
            referrer["email"],
            f"{user['name']} registered from your referral",
            f"Hello {referrer['name'].split(' ')[0]},\n\n{user['name']} has created an AHat account from your referral. "
            f"You can follow how far they get from your referrer dashboard:\n{notify.portal_link('/referrer')}\n\nThank you for recommending us.\n\nAHat",
        )


async def status_of(referrals: list[dict]) -> dict[str, str]:
    """Referral id → how far they have got, from the student's record as it stands now."""
    db = get_db()
    sids = [r["studentId"] for r in referrals if r.get("studentId")]
    students = {s["_id"]: s async for s in db.students.find({"_id": {"$in": sids}}, {"profileCompletedAt": 1})}
    apps = await db.applications.find({"studentId": {"$in": sids}}, {"studentId": 1, "state": 1}).to_list(None)
    out = {}
    for r in referrals:
        sid = r.get("studentId")
        mine = [a["state"] for a in apps if a["studentId"] == sid]
        if not sid:
            out[r["_id"]] = "invited"
        elif "accepted" in mine:
            out[r["_id"]] = "accepted"
        elif any(state != "draft" for state in mine):
            out[r["_id"]] = "applied"
        elif (students.get(sid) or {}).get("profileCompletedAt"):
            out[r["_id"]] = "profile"
        else:
            out[r["_id"]] = "registered"
    return out
