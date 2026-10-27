"""Cookie sessions (opaque token in an HttpOnly cookie, hash stored server-side), CSRF and role checks."""

from datetime import timedelta
from typing import Annotated

from fastapi import Depends, Request, Response

from app.config import get_settings
from app.core.clock import now
from app.core.errors import ApiError
from app.core.security import random_token, sha256
from app.db import get_db, new_id

# officer = Application officer (sees every student). finance_officer / visa_officer: only the students assigned to them.
STAFF_ROLES = ("counsellor", "officer", "finance_officer", "visa_officer", "admin")
UNSAFE = ("POST", "PUT", "PATCH", "DELETE")


def is_staff(role: str) -> bool:
    return role in STAFF_ROLES


def public_user(u: dict) -> dict:
    out = {"id": u["_id"], "role": u["role"], "name": u["name"], "email": u["email"], "mobile": u.get("mobile", "")}
    if u.get("studentReference"):
        out["studentReference"] = u["studentReference"]
    return out


def _limits(role: str) -> tuple[timedelta, timedelta]:
    s = get_settings()
    if is_staff(role):
        return timedelta(minutes=s.staff_idle_minutes), timedelta(hours=s.staff_max_hours)
    return timedelta(days=s.student_idle_days), timedelta(days=s.student_max_days)


async def start_session(response: Response, request: Request, user: dict) -> None:
    s = get_settings()
    token = random_token()
    idle, absolute = _limits(user["role"])
    t = now()
    await get_db().auth_sessions.insert_one(
        {
            "_id": new_id(),
            "tokenHash": sha256(token),
            "userId": user["_id"],
            "role": user["role"],
            "createdAt": t,
            "lastActiveAt": t,
            "idleExpiresAt": t + idle,
            "absoluteExpiresAt": t + absolute,
            "ip": request.client.host if request.client else None,
            "userAgent": request.headers.get("user-agent", "")[:300],
        }
    )
    await get_db().users.update_one({"_id": user["_id"]}, {"$set": {"lastLoginAt": t}})
    response.set_cookie(s.session_cookie_name, token, httponly=True, secure=s.cookie_secure, samesite="lax", path="/", max_age=int(absolute.total_seconds()))
    response.set_cookie(s.csrf_cookie_name, random_token(16), httponly=False, secure=s.cookie_secure, samesite="lax", path="/")


async def end_session(request: Request, response: Response) -> None:
    s = get_settings()
    token = request.cookies.get(s.session_cookie_name)
    if token:
        await get_db().auth_sessions.update_one({"tokenHash": sha256(token)}, {"$set": {"revokedAt": now()}})
    response.delete_cookie(s.session_cookie_name, path="/")


async def revoke_all_sessions(user_id: str) -> None:
    await get_db().auth_sessions.update_many({"userId": user_id, "revokedAt": None}, {"$set": {"revokedAt": now()}})


async def current_user_or_none(request: Request) -> dict | None:
    s = get_settings()
    token = request.cookies.get(s.session_cookie_name)
    if not token:
        return None
    db = get_db()
    session = await db.auth_sessions.find_one({"tokenHash": sha256(token)})
    t = now()
    if not session or session.get("revokedAt") or session["idleExpiresAt"] < t or session["absoluteExpiresAt"] < t:
        return None
    user = await db.users.find_one({"_id": session["userId"]})
    if not user or user.get("status") != "active":
        return None
    # Sliding idle timeout, written at most once a minute.
    if (t - session["lastActiveAt"]).total_seconds() > 60:
        idle, _ = _limits(user["role"])
        await db.auth_sessions.update_one({"_id": session["_id"]}, {"$set": {"lastActiveAt": t, "idleExpiresAt": t + idle}})
    return user


async def current_user(request: Request) -> dict:
    user = await current_user_or_none(request)
    if not user:
        raise ApiError(401, "Please sign in.")
    return user


def require_roles(*roles: str):
    async def dep(user: Annotated[dict, Depends(current_user)]) -> dict:
        if user["role"] not in roles:
            raise ApiError(403, "You don't have access to this.")
        return user

    return dep


CurrentUser = Annotated[dict, Depends(current_user)]
Student = Annotated[dict, Depends(require_roles("student"))]
Staff = Annotated[dict, Depends(require_roles(*STAFF_ROLES))]
Counsellor = Annotated[dict, Depends(require_roles("counsellor", "admin"))]
Admin = Annotated[dict, Depends(require_roles("admin"))]


def csrf_middleware(app) -> None:
    """Double-submit CSRF protection for cookie-authenticated requests."""

    @app.middleware("http")
    async def csrf(request: Request, call_next):
        s = get_settings()
        if request.method in UNSAFE and request.cookies.get(s.session_cookie_name):
            cookie = request.cookies.get(s.csrf_cookie_name)
            header = request.headers.get("x-csrf-token")
            if not cookie or cookie != header:
                from fastapi.responses import JSONResponse

                return JSONResponse({"detail": "Your session has expired. Please refresh the page.", "errors": [], "trace_id": ""}, status_code=403)
        response = await call_next(request)
        if not request.cookies.get(s.csrf_cookie_name):
            response.set_cookie(s.csrf_cookie_name, random_token(16), httponly=False, secure=s.cookie_secure, samesite="lax", path="/")
        return response
