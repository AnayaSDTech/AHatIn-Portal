"""Notification outbox. Business code queues messages; the worker sends them through Resend (if RESEND_API_KEY is
set), otherwise SMTP (if SMTP_HOST is set), otherwise writes them to the log (development)."""

import base64
import logging
from datetime import datetime, timedelta
from email.message import EmailMessage

import aiosmtplib
import httpx
from pymongo.errors import DuplicateKeyError

from app.config import get_settings
from app.core.clock import local_now, now
from app.db import get_db, new_id

log = logging.getLogger("ahat.notify")


async def queue_email(
    to: str,
    subject: str,
    body: str,
    *,
    dedupe_key: str | None = None,
    send_after: datetime | None = None,
    attachments: list[dict] | None = None,
    urgent: bool = False,
) -> None:
    """Adds an email to the outbox. `dedupe_key` prevents duplicates; `urgent` is sent ahead of others (e.g. login codes)."""
    if not to:
        return
    doc = {
        "_id": new_id(),
        "channel": "email",
        "to": to,
        "subject": subject,
        "body": body,
        "attachments": attachments or [],
        "status": "queued",
        "attempts": 0,
        "priority": 0 if urgent else 1,
        "sendAfter": send_after or now(),
        "createdAt": now(),
    }
    if dedupe_key:
        doc["dedupeKey"] = dedupe_key
    try:
        await get_db().notifications.insert_one(doc)
    except DuplicateKeyError:
        pass


async def email_admins(subject: str, body: str, dedupe_key: str | None = None) -> None:
    s = get_settings()
    recipients = [e.strip() for e in s.admin_alert_emails.split(",") if e.strip()]
    if not recipients:
        admins = await get_db().users.find({"role": "admin", "status": "active"}, {"email": 1}).to_list(None)
        recipients = [a["email"] for a in admins]
    for r in recipients:
        await queue_email(r, subject, body, dedupe_key=f"{dedupe_key}:{r}" if dedupe_key else None)


def in_quiet_hours() -> bool:
    h = local_now().hour
    return h >= 21 or h < 8


def _undeliverable(address: str) -> bool:
    """Addresses on reserved test domains (e.g. the demo accounts' @ahatin.example) can never receive mail."""
    domain = address.rsplit("@", 1)[-1].lower()
    return domain.endswith((".example", ".test", ".invalid", ".localhost")) or domain in ("example.com", "example.org", "example.net")


async def _send_resend(n: dict) -> None:
    """Sends through Resend's HTTP API (https://resend.com/docs/api-reference/emails/send-email)."""
    s = get_settings()
    payload = {"from": s.mail_from, "to": [n["to"]], "subject": n["subject"], "text": n["body"]}
    if n.get("attachments"):
        payload["attachments"] = [
            {"filename": a["filename"], "content": base64.b64encode(a["content"].encode()).decode(), "content_type": a["contentType"]} for a in n["attachments"]
        ]
    async with httpx.AsyncClient(timeout=20) as http:
        r = await http.post(
            "https://api.resend.com/emails",
            json=payload,
            headers={"Authorization": f"Bearer {s.resend_api_key}", "Idempotency-Key": f"ahat-{n['_id']}"},
        )
    if r.status_code >= 300:
        raise RuntimeError(f"Resend {r.status_code}: {r.text[:300]}")


async def _send_email(n: dict) -> None:
    s = get_settings()
    if _undeliverable(n["to"]):
        log.info("EMAIL (not sent, test address) to=%s subject=%s\n%s", n["to"], n["subject"], n["body"])
        return
    if s.resend_api_key:
        await _send_resend(n)
        return
    if not s.smtp_host:
        log.info("EMAIL (not sent, no email service configured) to=%s subject=%s\n%s", n["to"], n["subject"], n["body"])
        return
    msg = EmailMessage()
    msg["From"] = s.mail_from
    msg["To"] = n["to"]
    msg["Subject"] = n["subject"]
    msg.set_content(n["body"])
    for a in n.get("attachments", []):
        maintype, subtype = a["contentType"].split("/", 1)
        msg.add_attachment(a["content"].encode(), maintype=maintype, subtype=subtype, filename=a["filename"])
    await aiosmtplib.send(
        msg,
        hostname=s.smtp_host,
        port=s.smtp_port,
        username=s.smtp_username or None,
        password=s.smtp_password or None,
        use_tls=s.smtp_use_tls and s.smtp_port == 465,
        start_tls=s.smtp_use_tls and s.smtp_port != 465,
    )


async def send_due(batch: int = 20) -> int:
    """Sends queued notifications that are due. Retries 5 times with backoff, then marks them failed."""
    db = get_db()
    sent = 0
    for _ in range(batch):
        n = await db.notifications.find_one_and_update(
            {"status": "queued", "sendAfter": {"$lte": now()}},
            {"$set": {"status": "sending", "claimedAt": now()}},
            sort=[("priority", 1), ("sendAfter", 1)],
        )
        if not n:
            break
        try:
            await _send_email(n)
            await db.notifications.update_one({"_id": n["_id"]}, {"$set": {"status": "sent", "sentAt": now()}})
            sent += 1
        except Exception as exc:  # noqa: BLE001 - any delivery failure is retried
            attempts = n.get("attempts", 0) + 1
            status = "failed" if attempts >= 5 else "queued"
            await db.notifications.update_one(
                {"_id": n["_id"]},
                {"$set": {"status": status, "attempts": attempts, "error": str(exc)[:500], "sendAfter": now() + timedelta(minutes=2**attempts)}},
            )
            log.warning("Email to %s failed (attempt %s): %s", n["to"], attempts, exc)
    # Recover messages stuck in "sending" (e.g. the process stopped mid-send).
    await db.notifications.update_many({"status": "sending", "claimedAt": {"$lt": now() - timedelta(minutes=10)}}, {"$set": {"status": "queued"}})
    return sent


def portal_link(path: str = "") -> str:
    return get_settings().app_base_url.rstrip("/") + path


async def email_student(record: dict, subject: str, text: str, *, dedupe_key: str | None = None, attachments: list[dict] | None = None) -> None:
    """Emails a student (non-urgent emails wait until quiet hours end)."""
    first = record["name"].split(" ")[0]
    body = f"Hello {first},\n\n{text}\n\nSign in to see the details: {portal_link('/dashboard')}\n\nAHat"
    send_after = _after_quiet_hours()
    await queue_email(record["email"], subject, body, dedupe_key=dedupe_key, send_after=send_after, attachments=attachments)


async def email_counsellor(counsellor_id: str, subject: str, text: str, *, path: str = "/staff", dedupe_key: str | None = None, attachments: list[dict] | None = None) -> None:
    c = await get_db().users.find_one({"_id": counsellor_id, "status": "active"})
    if not c:
        return
    body = f"Hello {c['name'].split(' ')[0]},\n\n{text}\n\nOpen the staff portal: {portal_link(path)}\n\nAHat"
    await queue_email(c["email"], subject, body, dedupe_key=dedupe_key, attachments=attachments)


def _after_quiet_hours() -> datetime | None:
    if not in_quiet_hours():
        return None
    t = local_now()
    if t.hour >= 21:
        t = t + timedelta(days=1)
    return t.replace(hour=8, minute=0, second=0, microsecond=0)
