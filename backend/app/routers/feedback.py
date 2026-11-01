"""Temporary Feedback Mode: beta testers pin comments to a place on a page.

On in development; elsewhere only with FEEDBACK_MODE=true, otherwise these endpoints answer 404.
To remove the feature: delete this file, its entry in main.py, FEEDBACK_MODE in config.py, the "feedback" index in db.py,
the two Feedback bodies in schemas.py and the frontend's components/feedback folder.
"""

import re

from fastapi import APIRouter, Depends, Request

from app.config import get_settings
from app.core.auth import current_user_or_none, is_staff
from app.core.clock import iso, now
from app.core.errors import ApiError, not_found
from app.core.ratelimit import hit
from app.db import get_db, new_id
from app.schemas import FeedbackBody, FeedbackEditBody


def _enabled() -> None:
    if not get_settings().feedback_enabled:
        raise not_found()


router = APIRouter(tags=["feedback"], dependencies=[Depends(_enabled)])

# These addresses end in a secret token, which must never be stored.
SECRET_PATHS = re.compile(r"^/(upload|staff/setup)/.+")


def clean_path(path: str) -> str:
    path = path.split("?")[0].split("#")[0]
    match = SECRET_PATHS.match(path)
    return f"/{match[1]}/(private link)" if match else path


def _may_change(user: dict | None, c: dict) -> bool:
    """Anyone in development. If switched on elsewhere: the comment's author, or staff."""
    if get_settings().is_dev:
        return True
    return bool(user) and (is_staff(user["role"]) or c.get("userId") == user["_id"])


def _out(c: dict, user: dict | None) -> dict:
    return {
        "id": c["_id"], "text": c["text"], "path": c["path"], "x": c["x"], "y": c["y"], "viewportWidth": c["viewportWidth"], "by": c["by"], "at": iso(c["createdAt"]),
        "canChange": _may_change(user, c),
    }


async def _comment(comment_id: str, request: Request) -> tuple[dict, dict | None]:
    c = await get_db().feedback.find_one({"_id": comment_id})
    if not c:
        raise not_found("Comment not found.")
    user = await current_user_or_none(request)
    if not _may_change(user, c):
        raise ApiError(403, "Only the person who left this comment, or staff, can change it.")
    return c, user


@router.get("/feedback")
async def list_feedback(request: Request, path: str | None = None):
    """The comments on one page, or every comment without a path (for reading them all at the end of testing)."""
    query = {"path": clean_path(path)} if path else {}
    user = await current_user_or_none(request)
    found = await get_db().feedback.find(query).sort("createdAt", 1).to_list(1000)
    return [_out(c, user) for c in found]


@router.post("/feedback")
async def add_feedback(body: FeedbackBody, request: Request):
    """Testers may not be logged in (e.g. on the login page), so an account isn't required."""
    await hit(f"feedback:ip:{request.client.host if request.client else 'unknown'}", 30, 600, "That's a lot of comments in a short time. Please wait a few minutes.")
    user = await current_user_or_none(request)
    doc = {
        "_id": new_id(), "text": body.text, "path": clean_path(body.path), "x": body.x, "y": body.y, "viewportWidth": body.viewportWidth,
        "by": user["name"] if user else "Guest", "userId": user["_id"] if user else None, "createdAt": now(),
    }
    await get_db().feedback.insert_one(doc)
    return _out(doc, user)


@router.put("/feedback/{comment_id}")
async def edit_feedback(comment_id: str, body: FeedbackEditBody, request: Request):
    c, user = await _comment(comment_id, request)
    await get_db().feedback.update_one({"_id": comment_id}, {"$set": {"text": body.text, "updatedAt": now()}})
    return _out({**c, "text": body.text}, user)


@router.delete("/feedback/{comment_id}", status_code=204)
async def delete_feedback(comment_id: str, request: Request):
    await _comment(comment_id, request)
    await get_db().feedback.delete_one({"_id": comment_id})
