"""Loading and saving student records, and turning them into the shapes the frontend uses."""

from app.core.clock import iso, now
from app.db import get_db, new_id
from app.domain import stage_index


def _clean(d: dict, drop: tuple[str, ...] = ()) -> dict:
    out = {k: v for k, v in d.items() if v is not None and k not in drop}
    if "_id" in out:
        out["id"] = out.pop("_id")
    return out


def iso_or(v):
    return iso(v) if hasattr(v, "astimezone") else v


def serialize_document(d: dict) -> dict:
    out = {"id": d["_id"], "name": d["name"], "state": d["state"], "category": d.get("category", "general")}
    if d.get("uploadedAt"):
        out["uploadedAt"] = iso_or(d["uploadedAt"])
    if d.get("fileName"):
        out["fileName"] = d["fileName"]
    if d.get("reason"):
        out["reason"] = d["reason"]
    return out


def serialize_application(a: dict) -> dict:
    out = {"id": a["_id"], "university": a["university"], "course": a["course"], "agency": a.get("agency", "Own application"), "state": a["state"]}
    for k in ("deadline", "conditions"):
        if a.get(k) is not None:
            out[k] = a[k]
    if a.get("history"):
        out["history"] = [{**h, "at": iso_or(h["at"])} for h in a["history"]]
    return out


def serialize_note(n: dict) -> dict:
    return {"at": iso_or(n["at"]), "by": n["by"], "text": n["text"]}


def serialize_student(s: dict, documents: list[dict], applications: list[dict], notes: list[dict]) -> dict:
    out = {
        "id": s["_id"],
        "counsellorId": s["counsellorId"],
        "assignmentHistory": [{**h, "at": iso_or(h["at"])} for h in s.get("assignmentHistory", [])],
        "reference": s["reference"],
        "name": s["name"],
        "email": s["email"],
        "mobile": s["mobile"],
        "goal": s.get("goal", "To be decided"),
        "destination": s.get("destination", "Not decided"),
        "intake": s.get("intake", "To be decided"),
        "stage": s["stage"],
        "documents": [serialize_document(d) for d in documents],
        "applications": [serialize_application(a) for a in applications],
        "journey": s["journey"],
        "notes": [serialize_note(n) for n in notes],
    }
    for field in ("financeOfficerId", "visaOfficerId"):
        out[field] = s.get(field)
    if s.get("officerHistory"):
        out["officerHistory"] = [{**h, "at": iso_or(h["at"])} for h in s["officerHistory"]]
    if s.get("userId"):
        out["userId"] = s["userId"]
    return out


async def load_students(filter_: dict) -> list[dict]:
    """Full records (with documents, applications and notes) for every matching student."""
    db = get_db()
    students = await db.students.find(filter_).sort("_id", 1).to_list(None)
    ids = [s["_id"] for s in students]
    docs = await db.documents.find({"studentId": {"$in": ids}, "deletedAt": None}).sort("_id", 1).to_list(None)
    apps = await db.applications.find({"studentId": {"$in": ids}}).sort("_id", 1).to_list(None)
    notes = await db.notes.find({"studentId": {"$in": ids}}).sort([("at", -1), ("_id", -1)]).to_list(None)
    by: dict[str, dict[str, list]] = {i: {"d": [], "a": [], "n": []} for i in ids}
    for d in docs:
        by[d["studentId"]]["d"].append(d)
    for a in apps:
        by[a["studentId"]]["a"].append(a)
    for n in notes:
        by[n["studentId"]]["n"].append(n)
    return [serialize_student(s, by[s["_id"]]["d"], by[s["_id"]]["a"], by[s["_id"]]["n"]) for s in students]


async def load_student(student_id: str) -> dict:
    found = await load_students({"_id": student_id})
    return found[0]


async def add_note(student_id: str, by: str, text: str, kind: str = "event") -> None:
    await get_db().notes.insert_one({"_id": new_id(), "studentId": student_id, "at": now(), "by": by, "text": text, "kind": kind})


async def advance_stage(student_id: str, to: str) -> None:
    """Moves the pipeline stage forward only (never back)."""
    student = await get_db().students.find_one({"_id": student_id}, {"stage": 1})
    if student and stage_index(to) > stage_index(student["stage"]):
        await get_db().students.update_one({"_id": student_id}, {"$set": {"stage": to, "updatedAt": now()}})


def actor_name(user: dict) -> str:
    """How someone appears in a student's history."""
    return f"{user['name']} (student)" if user["role"] in ("student", "parent") else user["name"]


def serialize_counsellor(u: dict) -> dict:
    """meetingLink: the shared AHat meeting room every online session uses (MEETING_LINK)."""
    from app.config import get_settings

    p = u.get("counsellorProfile") or {}
    return {"id": u["_id"], "name": u["name"], "email": u["email"], "role": u["role"], "phone": p.get("phone", "") or u.get("mobile", ""), "meetingLink": get_settings().meeting_link}


def serialize_lead(l: dict) -> dict:
    out = _clean(l, drop=("mobileDigits", "registrationInvite", "convertedStudentId", "updatedAt", "firstContactAt", "nurtureAt"))
    out["createdAt"] = iso_or(l["createdAt"])
    out["activities"] = [{**a, "at": iso_or(a["at"])} for a in l.get("activities", [])]
    return out


def serialize_follow_up(f: dict) -> dict:
    return {
        "id": f["_id"],
        "counsellorId": f["counsellorId"],
        "person": f["person"],
        "personId": f["personId"],
        "personType": f["personType"],
        "action": f["action"],
        "rule": f["rule"],
        "dueAt": iso_or(f["dueAt"]),
        "type": f["type"],
        "done": f.get("done", False),
    }


def serialize_session(s: dict) -> dict:
    out = _clean(s, drop=("startsAt", "endsAt", "updatedAt", "createdAt", "meetingLink", "remindedAt", "reminders"))
    out["history"] = [{**h, "at": iso_or(h["at"])} for h in s.get("history", [])]
    return out


def serialize_message(m: dict) -> dict:
    out = {"id": m["_id"], "studentId": m["studentId"], "thread": m.get("thread", "counsellor"), "from": m["from"], "by": m["by"], "text": m["text"], "at": iso_or(m["at"])}
    if m.get("readAt"):
        out["readAt"] = iso_or(m["readAt"])
    return out


def serialize_grant(g: dict) -> dict:
    out = {"id": g["_id"], "granteeId": g["granteeId"], "ownerId": g["ownerId"], "until": g["until"], "reason": g["reason"], "grantedBy": g["grantedBy"]}
    if g.get("revoked"):
        out["revoked"] = True
    return out


def serialize_availability(a: dict) -> dict:
    return {k: a[k] for k in ("counsellorId", "weekly", "slotMinutes", "bufferMinutes", "minNoticeHours", "horizonDays")}


def serialize_time_off(t: dict) -> dict:
    out = {"id": t["_id"], "counsellorId": t["counsellorId"], "date": t["date"], "reason": t["reason"]}
    if t.get("start"):
        out["start"], out["end"] = t["start"], t["end"]
    return out
