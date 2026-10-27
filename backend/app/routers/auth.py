"""Sign-in for students (email + one-time code) and staff (password + authenticator app)."""

from datetime import timedelta

from fastapi import APIRouter, Request, Response

from app.config import get_settings
from app.core.audit import audit
from app.core.auth import CurrentUser, end_session, is_staff, public_user, start_session
from app.core.clock import now
from app.core.errors import ApiError
from app.core.ratelimit import hit
from app.core.security import (
    decrypt,
    encrypt,
    hash_password,
    otp_hash,
    random_code,
    random_token,
    sha256,
    totp_matches,
    totp_uri,
    verify_password,
)
from app.db import get_db, new_id
from app.schemas import EmailBody, InviteCompleteBody, OtpVerifyBody, RegisterBody, StaffLoginBody, StaffVerifyBody
from app.services import notify
from app.services.students import create_student_record

router = APIRouter(prefix="/auth", tags=["auth"])


def _ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


async def _issue_otp(email: str, user: dict | None, note: str | None = None) -> dict:
    """Sends a login code. The answer looks the same whether or not the email has an account."""
    s = get_settings()
    db = get_db()
    previous = await db.otp_codes.find_one({"email": email})
    t = now()
    if previous and (t - previous["sentAt"]).total_seconds() < s.otp_resend_seconds:
        left = s.otp_resend_seconds - int((t - previous["sentAt"]).total_seconds())
        raise ApiError(429, f"Please wait {left} seconds before requesting another code.", headers={"Retry-After": str(left)})
    result: dict = {"expiresIn": s.otp_ttl_seconds, "resendIn": s.otp_resend_seconds}
    if not user:
        if s.expose_dev_codes:
            result["demoNote"] = note or "No account uses this email, so no code was sent. Register first, or use the demo student account."
        return result
    code = random_code()
    await db.otp_codes.replace_one(
        {"email": email},
        {"email": email, "codeHash": otp_hash(email, code), "sentAt": t, "expiresAt": t + timedelta(seconds=s.otp_ttl_seconds), "attempts": 0},
        upsert=True,
    )
    await notify.queue_email(
        email,
        f"Your AHat sign-in code: {code}",
        f"Hello {user['name'].split(' ')[0]},\n\nYour AHat code is {code}. It expires in {s.otp_ttl_seconds // 60} minutes.\n\n"
        "If you didn't ask for this code, you can ignore this email.\n\nAHat",
        urgent=True,
    )
    if s.expose_dev_codes:
        result["demoCode"] = code
    return result


@router.post("/register")
async def register(body: RegisterBody, request: Request):
    await hit(f"register:ip:{_ip(request)}", 10, 3600, "Too many sign-ups from this connection. Please try again later.")
    db = get_db()
    existing = await db.users.find_one({"email": body.email})
    if existing and existing.get("emailVerifiedAt"):
        raise ApiError(409, "An account with this email already exists. Log in instead.", {"email": "This email is already registered."})
    if existing:
        # Registered before but never confirmed the email: send a fresh code.
        return await _issue_otp(body.email, existing)

    user = {
        "_id": new_id(),
        "role": "student",
        "name": body.name,
        "email": body.email,
        "mobile": f"+91{body.mobile}",
        "status": "active",
        "emailVerifiedAt": None,
        "consentAt": now(),
        "createdAt": now(),
    }
    await db.users.insert_one(user)
    record = await create_student_record(user, destination=body.destination, intake=body.intake)
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"studentReference": record["reference"]}})
    user["studentReference"] = record["reference"]
    await audit(user, "student.registered", "students", record["_id"])
    return await _issue_otp(body.email, user)


@router.post("/otp/request")
async def request_otp(body: EmailBody, request: Request):
    await hit(f"otp:ip:{_ip(request)}", 20, 3600)
    await hit(f"otp:email:{body.email}", 6, 3600, "Too many codes requested for this email. Please try again in an hour.")
    user = await get_db().users.find_one({"email": body.email, "status": "active"})
    if user and is_staff(user["role"]):
        return await _issue_otp(body.email, None, 'This is a staff account, so no code was sent. Staff use "Staff sign in".')
    return await _issue_otp(body.email, user)


@router.post("/otp/verify")
async def verify_otp(body: OtpVerifyBody, request: Request, response: Response):
    await hit(f"otpverify:ip:{_ip(request)}", 30, 900)
    s = get_settings()
    db = get_db()
    record = await db.otp_codes.find_one({"email": body.email})

    def fail(msg: str, status: int = 400):
        return ApiError(status, msg, {"code": msg})

    if not record:
        raise fail("This code is not valid. Request a new code.")
    if record["expiresAt"] < now():
        await db.otp_codes.delete_one({"_id": record["_id"]})
        raise fail("This code has expired. Request a new code.")
    if record["attempts"] >= s.otp_max_attempts:
        raise fail("Too many attempts. Request a new code.", 429)
    if otp_hash(body.email, body.code) != record["codeHash"]:
        updated = await db.otp_codes.find_one_and_update({"_id": record["_id"]}, {"$inc": {"attempts": 1}}, return_document=True)
        left = s.otp_max_attempts - updated["attempts"]
        raise fail(f"That code is incorrect. {left} {'attempt' if left == 1 else 'attempts'} left." if left > 0 else "Too many attempts. Request a new code.")
    # Single use: delete before signing in, so a code can never be replayed.
    deleted = await db.otp_codes.delete_one({"_id": record["_id"], "codeHash": record["codeHash"]})
    if not deleted.deleted_count:
        raise fail("This code is not valid. Request a new code.")
    user = await db.users.find_one({"email": body.email, "status": "active"})
    if not user or is_staff(user["role"]):
        raise ApiError(404, "Account not found.")
    if not user.get("emailVerifiedAt"):
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"emailVerifiedAt": now()}})
    await start_session(response, request, user)
    await audit(user, "auth.login", "users", user["_id"], {"method": "otp"})
    return {"user": public_user(user)}


@router.post("/staff/login")
async def staff_login(body: StaffLoginBody, request: Request):
    await hit(f"staff:ip:{_ip(request)}", 30, 900, "Too many sign-in attempts. Please wait 15 minutes.")
    await hit(f"staff:email:{body.email}", 10, 900, "Too many sign-in attempts for this account. Please wait 15 minutes.")
    db = get_db()
    user = await db.users.find_one({"email": body.email})
    ok = verify_password(body.password, user.get("passwordHash") if user else None)
    if not ok or not user or not is_staff(user["role"]) or user.get("status") != "active" or not user.get("totpSecretEnc"):
        await audit(user, "auth.staff_login_failed", "users", user["_id"] if user else body.email)
        raise ApiError(401, "The email or password is incorrect.")
    challenge_id = random_token(24)
    await db.staff_challenges.insert_one({"_id": sha256(challenge_id), "userId": user["_id"], "attempts": 0, "expiresAt": now() + timedelta(minutes=5)})
    result = {"challengeId": challenge_id}
    if get_settings().expose_dev_codes:
        result["demoSecret"] = decrypt(user["totpSecretEnc"])
    return result


@router.post("/staff/verify")
async def staff_verify(body: StaffVerifyBody, request: Request, response: Response):
    db = get_db()
    challenge = await db.staff_challenges.find_one({"_id": sha256(body.challenge_id)})
    if not challenge or challenge["expiresAt"] < now():
        raise ApiError(401, "Your sign-in has timed out. Please start again.")
    if challenge["attempts"] >= 5:
        raise ApiError(429, "Too many attempts. Please start again.")
    user = await db.users.find_one({"_id": challenge["userId"], "status": "active"})
    if not user or not user.get("totpSecretEnc"):
        raise ApiError(401, "Please start again.")
    step = totp_matches(decrypt(user["totpSecretEnc"]), body.code, None)
    if step is None:
        await db.staff_challenges.update_one({"_id": challenge["_id"]}, {"$inc": {"attempts": 1}})
        raise ApiError(400, "That code is incorrect. Check your authenticator app.", {"code": "That code is incorrect."})
    if user.get("totpLastStep") is not None and step <= user["totpLastStep"]:
        raise ApiError(400, "That code was already used. Wait for the next one.", {"code": "That code was already used."})
    # Remember the step so the same code can't be used twice.
    claimed = await db.users.update_one(
        {"_id": user["_id"], "$or": [{"totpLastStep": {"$exists": False}}, {"totpLastStep": None}, {"totpLastStep": {"$lt": step}}]},
        {"$set": {"totpLastStep": step}},
    )
    if not claimed.modified_count:
        raise ApiError(400, "That code was already used. Wait for the next one.", {"code": "That code was already used."})
    await db.staff_challenges.delete_one({"_id": challenge["_id"]})
    await start_session(response, request, user)
    await audit(user, "auth.login", "users", user["_id"], {"method": "password+totp"})
    return {"user": public_user(user)}


@router.get("/me")
async def me(user: CurrentUser):
    return public_user(user)


@router.post("/logout", status_code=204)
async def logout(request: Request, response: Response):
    await end_session(request, response)
    response.status_code = 204
    return response


# ---------------------------------------------------------------- staff invitations


async def _invite(token: str) -> tuple[dict, dict]:
    db = get_db()
    invite = await db.invites.find_one({"tokenHash": sha256(token), "usedAt": None})
    if not invite or invite["expiresAt"] < now():
        raise ApiError(404, "This invitation link has expired or was already used. Ask an administrator for a new one.")
    user = await db.users.find_one({"_id": invite["userId"]})
    if not user or user.get("status") == "deactivated":
        raise ApiError(404, "This invitation link has expired or was already used. Ask an administrator for a new one.")
    return invite, user


@router.get("/staff/invite/{token}")
async def get_invite(token: str):
    invite, user = await _invite(token)
    secret = decrypt(invite["totpSecretEnc"])
    return {"name": user["name"], "email": user["email"], "role": user["role"], "secret": secret, "otpauthUri": totp_uri(secret, user["email"])}


@router.post("/staff/invite/{token}")
async def complete_invite(token: str, body: InviteCompleteBody, request: Request, response: Response):
    await hit(f"invite:ip:{_ip(request)}", 20, 900)
    invite, user = await _invite(token)
    secret = decrypt(invite["totpSecretEnc"])
    step = totp_matches(secret, body.code, None)
    if step is None:
        raise ApiError(400, "That code is incorrect. Check your authenticator app.", {"code": "That code is incorrect."})
    db = get_db()
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"passwordHash": hash_password(body.password), "totpSecretEnc": encrypt(secret), "totpLastStep": step, "status": "active", "activatedAt": now()}},
    )
    await db.invites.update_one({"_id": invite["_id"]}, {"$set": {"usedAt": now()}})
    user = await db.users.find_one({"_id": user["_id"]})
    await start_session(response, request, user)
    await audit(user, "staff.activated", "users", user["_id"])
    return {"user": public_user(user)}
