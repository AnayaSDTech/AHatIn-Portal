"""Public endpoints (no account): the website enquiry form."""

from datetime import date

from fastapi import APIRouter, Request

from app.core.clock import now
from app.core.ratelimit import hit
from app.db import get_db, new_id
from app.domain import format_mobile
from app.records import add_note
from app.services.workflow import create_follow_up, first_contact_due
from app.schemas import EnquiryBody

router = APIRouter(tags=["public"])


def _summary(d: EnquiryBody) -> str:
    dest = {"uk": "UK", "europe": "Europe"}.get(d.destination, "Destination not decided")
    try:
        y, m = d.intake.split("-")
        intake = date(int(y), int(m), 1).strftime("%b %Y")
    except ValueError:
        intake = "Intake not decided"
    return " · ".join([d.course.strip() or "Course not decided", dest, intake])


async def _name(counsellor_id: str | None) -> str | None:
    """Who will reply: the counsellor looking after the person, or None for the AHat team (admin)."""
    c = await get_db().users.find_one({"_id": counsellor_id}, {"name": 1}) if counsellor_id else None
    return c["name"] if c else None


@router.post("/enquiries")
async def submit_enquiry(body: EnquiryBody, request: Request):
    # Spam trap filled in: look successful but keep nothing.
    if body.website.strip():
        return {"kind": "ignored"}
    ip = request.client.host if request.client else "unknown"
    await hit(f"enquiry:ip:{ip}", 3, 600, "You have sent several enquiries in the last few minutes. Please wait a little, or call us instead.")

    db = get_db()
    t = now()
    interest = _summary(body)
    details = " ".join(x for x in [f"Preferred call time: {body.callTime}." if body.callTime else "", body.message.strip()] if x)
    match = {"$or": [{"email": body.email}, {"mobileDigits": body.mobile}]}
    due = first_contact_due(t)

    # Already a registered student: add it to their record for their counsellor.
    student = await db.students.find_one(match)
    if student:
        await add_note(student["_id"], "Website", f"New website enquiry: {interest}.{f' {details}' if details else ''}")
        await create_follow_up(
            counsellor_id=student["counsellorId"], person=student["name"], person_id=student["_id"], person_type="student",
            action="Reply to website enquiry from a registered student", rule="New enquiry · 15 minutes", due_at=due, type_="call",
        )
        return {"kind": "student", "counsellor": await _name(student["counsellorId"])}

    # Already a lead: add the enquiry to it instead of creating a duplicate.
    lead = await db.leads.find_one({**match, "convertedStudentId": None})
    if lead:
        update = {"$push": {"activities": {"$each": [{"at": t, "channel": "Website", "outcome": "New enquiry received", "notes": f"{interest}.{f' {details}' if details else ''}"}], "$position": 0}}, "$set": {"updatedAt": t}}
        if body.message.strip():
            update["$set"]["message"] = body.message.strip()
        if body.callTime:
            update["$set"]["callTime"] = body.callTime
        await db.leads.update_one({"_id": lead["_id"]}, update)
        await create_follow_up(
            counsellor_id=lead["counsellorId"], person=lead["name"], person_id=lead["_id"], person_type="lead",
            action="Reply to repeat website enquiry", rule="New enquiry · 15 minutes", due_at=due, type_="call",
        )
        return {"kind": "lead", "counsellor": await _name(lead["counsellorId"])}

    # New lead. Website enquiries are handled by the admin, who can later assign one to a counsellor.
    lead_id = new_id()
    score = 40 + (15 if body.destination != "undecided" else 0) + (15 if body.intake != "unsure" else 0) + (10 if body.course.strip() else 0) + (10 if body.message.strip() else 0)
    doc = {
        "_id": lead_id,
        "name": body.name,
        "email": body.email,
        "mobile": format_mobile(body.mobile),
        "mobileDigits": body.mobile,
        "city": "Not given",
        "source": "Website",
        "interest": interest,
        "stage": "new_lead",
        "score": score,
        "createdAt": t,
        "counsellorId": None,
        "activities": [{"at": t, "channel": "System", "outcome": "Website enquiry received. Handled by the admin"}],
        "consentAt": t,
    }
    if body.message.strip():
        doc["message"] = body.message.strip()
    if body.callTime:
        doc["callTime"] = body.callTime
    await db.leads.insert_one(doc)
    await create_follow_up(
        counsellor_id=None, person=body.name, person_id=lead_id, person_type="lead",
        action="First contact with new enquiry", rule="New enquiry · 15 minutes", due_at=due, type_="call", source_event=f"lead:{lead_id}:first-contact",
    )
    return {"kind": "new", "counsellor": None}
