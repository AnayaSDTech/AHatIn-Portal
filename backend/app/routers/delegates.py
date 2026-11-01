"""Parents and sponsors: a student invites someone to upload documents for them.

The invitation is a private link by email, not an account. Whoever holds it can only list the documents still needed
and upload to them: they can't open any file or see anything else about the student. The student can cancel it at any
time, and it stops working after DELEGATE_LINK_DAYS.
"""

from datetime import timedelta

from fastapi import APIRouter, Request

from app.config import get_settings
from app.core.audit import audit
from app.core.auth import CurrentUser, is_staff
from app.core.clock import iso, now
from app.core.errors import ApiError, not_found
from app.core.ratelimit import hit
from app.core.security import random_token, sha256
from app.db import get_db, new_id
from app.records import add_note
from app.routers.students import document_of, finish_upload, prepare_upload
from app.schemas import DelegateBody, UploadCompleteBody, UploadUrlBody
from app.services import notify
from app.services.students import own_record

router = APIRouter(tags=["delegates"])

MAX_DELEGATES = 5
DELEGATE_LINK_DAYS = 30
DEAD_LINK = "This link has expired or been cancelled. Please ask the student for a new one."


def _out(d: dict) -> dict:
    return {
        "id": d["_id"], "name": d["name"], "email": d["email"], "relation": d["relation"], "at": iso(d["createdAt"]), "expiresAt": iso(d["expiresAt"]),
        "expired": d["expiresAt"] < now(), "uploads": d.get("uploads", 0),
    }


async def _student_only(user: dict) -> dict:
    if is_staff(user["role"]):
        raise ApiError(403, "Only the student can do this.")
    return await own_record(user)


@router.get("/me/delegates")
async def my_delegates(user: CurrentUser):
    record = await _student_only(user)
    found = await get_db().delegates.find({"studentId": record["_id"], "revokedAt": None}).sort("createdAt", -1).to_list(None)
    return [_out(d) for d in found]


@router.post("/me/delegates")
async def invite_delegate(body: DelegateBody, user: CurrentUser):
    record = await _student_only(user)
    await hit(f"delegate-invite:{user['_id']}", 10, 86400, "You've sent a lot of invitations today. Please try again tomorrow.")
    db = get_db()
    if body.email == user["email"]:
        raise ApiError(400, "Invite someone other than yourself.", {"email": "Invite someone other than yourself."})
    t = now()
    active = await db.delegates.find({"studentId": record["_id"], "revokedAt": None, "expiresAt": {"$gt": t}}).to_list(None)
    if any(d["email"] == body.email for d in active):
        raise ApiError(409, "You've already invited this person.", {"email": "You've already invited this person."})
    if len(active) >= MAX_DELEGATES:
        raise ApiError(400, f"You can have up to {MAX_DELEGATES} people at a time. Remove someone to invite another.")
    token = random_token()
    doc = {
        "_id": new_id(), "studentId": record["_id"], "tokenHash": sha256(token), "name": body.name, "email": body.email, "relation": body.relation,
        "createdAt": t, "expiresAt": t + timedelta(days=DELEGATE_LINK_DAYS), "revokedAt": None, "uploads": 0,
    }
    await db.delegates.insert_one(doc)
    await add_note(record["_id"], record["name"], f"Invited {body.name} ({body.relation}) to upload documents.")
    await audit(user, "delegate.invited", "students", record["_id"], {"delegate": doc["_id"]})
    link = notify.portal_link(f"/upload/{token}")
    await notify.queue_email(
        body.email,
        f"{record['name']} asked you to upload documents",
        f"Hello {body.name.split(' ')[0]},\n\n{record['name']} has asked you to upload documents for their study abroad application with AHat. "
        f"Use this private link, which works for {DELEGATE_LINK_DAYS} days:\n{link}\n\n"
        "You'll only be able to upload documents. Please don't share this link.\n\nAHat",
        urgent=True,
    )
    out = _out(doc)
    if get_settings().show_email_code(body.email):
        out["demoLink"] = link
    return out


@router.delete("/me/delegates/{delegate_id}", status_code=204)
async def cancel_delegate(delegate_id: str, user: CurrentUser):
    record = await _student_only(user)
    db = get_db()
    d = await db.delegates.find_one({"_id": delegate_id, "studentId": record["_id"], "revokedAt": None})
    if not d:
        raise not_found("Invitation not found.")
    await db.delegates.update_one({"_id": delegate_id}, {"$set": {"revokedAt": now()}})
    await add_note(record["_id"], record["name"], f"Removed upload access for {d['name']}.")
    await audit(user, "delegate.revoked", "students", record["_id"], {"delegate": delegate_id})


# ---------------------------------------------------------------- the private link (no account)


async def _delegate(token: str, request: Request) -> tuple[dict, dict]:
    await hit(f"delegate:ip:{request.client.host if request.client else 'unknown'}", 120, 900, "Too many requests. Please wait a few minutes.")
    db = get_db()
    d = await db.delegates.find_one({"tokenHash": sha256(token), "revokedAt": None})
    if not d or d["expiresAt"] < now():
        raise ApiError(404, DEAD_LINK)
    student = await db.students.find_one({"_id": d["studentId"]})
    if not student:
        raise ApiError(404, DEAD_LINK)
    return d, student


@router.get("/delegate-access/{token}")
async def delegate_documents(token: str, request: Request):
    """Only what's needed to upload: the student's first name and the documents still to upload."""
    d, student = await _delegate(token, request)
    docs = await get_db().documents.find({"studentId": student["_id"], "deletedAt": None, "state": {"$in": ["missing", "rejected"]}}).sort("createdAt", 1).to_list(None)
    return {
        "studentName": student["name"].split(" ")[0],
        "name": d["name"],
        "expiresAt": iso(d["expiresAt"]),
        "documents": [{"id": x["_id"], "name": x["name"], "state": x["state"], **({"reason": x["reason"]} if x.get("reason") else {})} for x in docs],
    }


@router.post("/delegate-access/{token}/documents/{doc_id}/upload-url")
async def delegate_upload_url(token: str, doc_id: str, body: UploadUrlBody, request: Request):
    _, student = await _delegate(token, request)
    return await prepare_upload(student["_id"], doc_id, body)


@router.post("/delegate-access/{token}/documents/{doc_id}/upload-complete")
async def delegate_upload_complete(token: str, doc_id: str, body: UploadCompleteBody, request: Request):
    d, student = await _delegate(token, request)
    doc = await document_of(student["_id"], doc_id)
    by = f"{d['name']} ({d['relation']})"
    await finish_upload(student, doc_id, body, actor=None, by=by, uploaded_by=by)
    await get_db().delegates.update_one({"_id": d["_id"]}, {"$inc": {"uploads": 1}, "$set": {"lastUsedAt": now()}})
    await notify.email_student(student, f"{d['name']} uploaded a document", f"{d['name']} uploaded {doc['name']} for you. We'll check it within 1 working day.")
    return {"ok": True}
