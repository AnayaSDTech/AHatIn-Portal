"""The student's chats: one with their counsellor (or whoever is covering), and one with each officer once assigned."""

from fastapi import APIRouter

from app.core.auth import CurrentUser, is_staff
from app.core.clock import now
from app.core.errors import ApiError
from app.core.ratelimit import hit
from app.core.scope import scope_for
from app.db import get_db, new_id
from app.domain import AREA_OF_ROLE, OFFICER_FIELD, OFFICER_TITLE
from app.records import serialize_message
from app.schemas import MessageBody, ReadBody
from app.services import notify
from app.services.students import own_record, student_for

router = APIRouter(prefix="/messages", tags=["messages"])

# Messages from before separate chats existed belong to the counsellor's chat.
COUNSELLOR_THREAD = {"$in": ["counsellor", None]}


def _thread_filter(thread: str):
    return COUNSELLOR_THREAD if thread == "counsellor" else thread


def _staff_thread(user: dict, requested: str) -> str:
    """Officers write in their own chat; counsellors in the counsellor's; the admin in whichever they open."""
    if user["role"] in AREA_OF_ROLE:
        return AREA_OF_ROLE[user["role"]]
    return requested if user["role"] == "admin" else "counsellor"


@router.get("")
async def list_messages(user: CurrentUser):
    db = get_db()
    if not is_staff(user["role"]):
        record = await own_record(user)
        found = await db.messages.find({"studentId": record["_id"]}).sort("at", 1).to_list(None)
    else:
        scope = await scope_for(user)
        ids = [s["_id"] async for s in db.students.find(scope.student_filter(), {"_id": 1})]
        filt: dict = {"studentId": {"$in": ids}}
        if not scope.is_admin:
            filt["thread"] = _thread_filter(_staff_thread(user, "counsellor"))
        found = await db.messages.find(filt).sort("at", 1).to_list(None)
    return [serialize_message(m) for m in found]


async def _thread(user: dict, student_id: str | None) -> dict:
    if is_staff(user["role"]):
        if not student_id:
            raise ApiError(400, "Choose a student.")
        return await student_for(user, student_id, who="staff")
    return await own_record(user)


@router.post("")
async def send_message(body: MessageBody, user: CurrentUser):
    await hit(f"msg:{user['_id']}", 30, 60, "You're sending messages very quickly. Please wait a moment.")
    student = await _thread(user, body.studentId)
    staff = is_staff(user["role"])
    thread = _staff_thread(user, body.thread) if staff else body.thread
    owner = student.get(OFFICER_FIELD[thread]) if thread in OFFICER_FIELD else student.get("counsellorId")
    if not staff and not owner:
        who = "your counsellor" if thread == "counsellor" else f"your {OFFICER_TITLE[thread]}"
        raise ApiError(400, f"You can message {who} once they are assigned. We'll email you when they are.")
    msg = {"_id": new_id(), "studentId": student["_id"], "thread": thread, "from": "staff" if staff else "student", "by": user["name"], "text": body.text, "at": now(), "senderId": user["_id"]}
    await get_db().messages.insert_one(msg)
    # One email per chat per hour at most, so a quick back-and-forth doesn't flood anyone.
    window = int(now().timestamp()) // 3600
    if staff:
        await notify.email_student(student, f"New message from {user['name']}", body.text, dedupe_key=f"msg:student:{student['_id']}:{thread}:{window}")
    else:
        await notify.email_counsellor(
            owner, f"New message from {student['name']}", body.text, path=f"/staff/students/{student['_id']}#messages", dedupe_key=f"msg:staff:{student['_id']}:{thread}:{window}"
        )
    return serialize_message(msg)


@router.post("/read", status_code=204)
async def mark_read(body: ReadBody, user: CurrentUser):
    """Marks the other side's messages in a chat as read."""
    student = await _thread(user, body.studentId)
    staff = is_staff(user["role"])
    thread = _staff_thread(user, body.thread) if staff else body.thread
    other = "student" if staff else "staff"
    await get_db().messages.update_many({"studentId": student["_id"], "thread": _thread_filter(thread), "from": other, "readAt": None}, {"$set": {"readAt": now()}})
