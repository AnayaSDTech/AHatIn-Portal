"""Slot generation and session rules (same logic as the frontend's slot picker)."""

from datetime import timedelta

from app.core.clock import from_minutes, local_dt, now, to_minutes, today
from app.core.errors import ApiError
from app.db import get_db

MAX_UPCOMING = 3


def day_key(date_iso: str) -> str:
    """Weekday key as in the frontend (JavaScript getDay()): 0 = Sunday … 6 = Saturday."""
    from datetime import date

    return str((date.fromisoformat(date_iso).weekday() + 1) % 7)


def _overlaps(a1: int, a2: int, b1: int, b2: int) -> bool:
    return a1 < b2 and b1 < a2


def slots_for(av: dict, date_iso: str, sessions: list[dict], time_off: list[dict], *, ignore_session_id: str | None = None, ignore_notice: bool = False) -> list[dict]:
    blocks = av.get("weekly", {}).get(day_key(date_iso), [])
    taken = [s for s in sessions if s["counsellorId"] == av["counsellorId"] and s["date"] == date_iso and s["status"] == "booked" and s["_id"] != ignore_session_id]
    off = [t for t in time_off if t["counsellorId"] == av["counsellorId"] and t["date"] == date_iso]
    out = []
    t_now = now()
    for block in blocks:
        end = to_minutes(block["end"])
        t = to_minutes(block["start"])
        while t + av["slotMinutes"] <= end:
            slot_end = t + av["slotMinutes"]
            starts_at = local_dt(date_iso, from_minutes(t))
            if any(not o.get("start") or _overlaps(t, slot_end, to_minutes(o["start"]), to_minutes(o.get("end") or "23:59")) for o in off):
                status = "off"
            elif any(_overlaps(t, slot_end, to_minutes(s["time"]), to_minutes(s["time"]) + s["durationMinutes"]) for s in taken):
                status = "booked"
            elif starts_at < t_now + timedelta(hours=0 if ignore_notice else av["minNoticeHours"]):
                status = "too_soon"
            else:
                status = "free"
            modes = ["online", "office"] if block["mode"] == "both" else [block["mode"]]
            out.append({"time": from_minutes(t), "modes": modes, "status": status})
            t += av["slotMinutes"] + av["bufferMinutes"]
    return out


def working_dates(av: dict) -> list[str]:
    start = today()
    return [
        (start + timedelta(days=i)).isoformat()
        for i in range(av["horizonDays"] + 1)
        if av.get("weekly", {}).get(day_key((start + timedelta(days=i)).isoformat()))
    ]


async def check_slot(counsellor_id: str, date_iso: str, time: str, mode: str, *, ignore_session_id: str | None = None, ignore_notice: bool = False, within_horizon: bool = True) -> dict:
    """Raises unless the slot is free and offers the requested mode. Returns the availability."""
    db = get_db()
    av = await db.availability.find_one({"counsellorId": counsellor_id})
    if not av:
        raise ApiError(400, "This counsellor hasn't set their availability yet.")
    if within_horizon and date_iso not in working_dates(av):
        raise ApiError(400, "Choose a date and a free time slot.", {"time": "Choose a date and a free time slot."})
    if date_iso < today().isoformat():
        raise ApiError(400, "Choose a date and a free time slot.", {"time": "Choose a date and a free time slot."})
    sessions = await db.sessions.find({"counsellorId": counsellor_id, "date": date_iso, "status": "booked"}).to_list(None)
    time_off = await db.time_off.find({"counsellorId": counsellor_id, "date": date_iso}).to_list(None)
    slot = next((s for s in slots_for(av, date_iso, sessions, time_off, ignore_session_id=ignore_session_id, ignore_notice=ignore_notice) if s["time"] == time), None)
    if not slot:
        raise ApiError(400, "Choose a date and a free time slot.", {"time": "Choose a date and a free time slot."})
    if slot["status"] == "booked":
        raise ApiError(409, "That time has just been taken. Please choose another.", {"time": "That time has just been taken."})
    if slot["status"] != "free":
        raise ApiError(400, "That time is no longer available. Please choose another.", {"time": "That time is no longer available."})
    if mode not in slot["modes"]:
        raise ApiError(400, "That meeting type isn't available at this time.", {"mode": "That meeting type isn't available at this time."})
    return av


def session_times(date_iso: str, time: str, minutes: int) -> tuple:
    start = local_dt(date_iso, time)
    return start, start + timedelta(minutes=minutes)


def has_started(s: dict) -> bool:
    return local_dt(s["date"], s["time"]) <= now()


def has_ended(s: dict) -> bool:
    return local_dt(s["date"], s["time"]) + timedelta(minutes=s["durationMinutes"]) <= now()


def validate_weekly(weekly: dict) -> str | None:
    names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    for day, blocks in weekly.items():
        if day not in {str(i) for i in range(7)}:
            return "Unknown day."
        if len(blocks) > 2:
            return f"{names[int(day)]}: at most two time blocks."
        ordered = sorted(blocks, key=lambda b: to_minutes(b["start"]))
        for i, b in enumerate(ordered):
            if to_minutes(b["end"]) <= to_minutes(b["start"]):
                return f"{names[int(day)]}: each block must end after it starts."
            if i + 1 < len(ordered) and to_minutes(ordered[i + 1]["start"]) < to_minutes(b["end"]):
                return f"{names[int(day)]}: time blocks overlap."
    return None
