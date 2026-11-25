"""Business rules an admin can change on the Settings page: working hours, quiet hours and follow-up time limits.

Stored as one document in the `settings` collection; anything not saved there uses DEFAULTS (the original values). The values are
kept in memory so the time helpers can stay synchronous, and are reloaded at most every RELOAD_SECONDS, so the API and the background
worker (which may run as separate processes) pick up a change within that time. Saving reloads at once in the saving process.

Security settings (2-step verification, session limits) are deliberately not here: they stay in the server configuration.
"""

import copy
import time
from typing import Any

RELOAD_SECONDS = 30
DOC_ID = "business-rules"

WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

DEFAULTS: dict[str, Any] = {
    # Days are Python weekday numbers: 0 = Monday … 6 = Sunday.
    "workingHours": {"days": [0, 1, 2, 3, 4, 5], "start": "10:00", "end": "19:00"},
    # Non-urgent emails to students and parents wait until the end of quiet hours.
    "quietHours": {"start": "21:00", "end": "08:00"},
    "followUps": {
        "firstContactMinutes": 15,  # new enquiry during working hours
        "firstContactNextDay": "11:00",  # new enquiry out of hours: by this time on the next working day
        "bookSessionHours": 48,  # lead contacted, no session booked yet
        "planFollowUpHours": 48,  # lead marked "Assessed / plan shared", not registered yet
        "documentCheckWorkingDays": 1,  # verify or reject an uploaded document
        "deadlineReminderDays": [14, 7, 2],  # application and scholarship deadlines; managers are alerted at the last one
    },
}

_values: dict[str, Any] = copy.deepcopy(DEFAULTS)
_loaded_at = 0.0


def _merge(saved: dict | None) -> dict[str, Any]:
    out = copy.deepcopy(DEFAULTS)
    for section, defaults in DEFAULTS.items():
        if isinstance((saved or {}).get(section), dict):
            out[section] = {**defaults, **{k: v for k, v in saved[section].items() if k in defaults}}
    return out


def current() -> dict[str, Any]:
    """The rules in force (the last values loaded)."""
    return _values


async def reload() -> dict[str, Any]:
    from app.db import get_db  # here, not at the top: the time helpers import this module

    global _values, _loaded_at
    _values = _merge(await get_db().settings.find_one({"_id": DOC_ID}))
    _loaded_at = time.monotonic()
    return _values


async def refresh_if_stale() -> None:
    if time.monotonic() - _loaded_at >= RELOAD_SECONDS:
        await reload()


async def save(changes: dict[str, dict]) -> tuple[dict[str, Any], dict[str, Any]]:
    """Saves the given sections (whole sections only); returns (before, after)."""
    from app.db import get_db

    before = await reload()
    await get_db().settings.update_one({"_id": DOC_ID}, {"$set": changes}, upsert=True)
    return copy.deepcopy(before), await reload()


def forget() -> None:
    """Back to the defaults until the next reload (tests start each run with an empty database)."""
    global _values, _loaded_at
    _values = copy.deepcopy(DEFAULTS)
    _loaded_at = 0.0


# ---------------------------------------------------------------- helpers for the rules


def minutes(hhmm: str) -> int:
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def working_days() -> list[int]:
    return current()["workingHours"]["days"]


def working_day_hours() -> float:
    wh = current()["workingHours"]
    return (minutes(wh["end"]) - minutes(wh["start"])) / 60


def days_label(days: list[int]) -> str:
    """'Monday – Saturday' for a run of days, otherwise 'Monday, Wednesday and Friday'."""
    days = sorted(days)
    if len(days) >= 3 and days == list(range(days[0], days[-1] + 1)):
        return f"{WEEKDAYS[days[0]]} – {WEEKDAYS[days[-1]]}"
    names = [WEEKDAYS[d] for d in days]
    return names[0] if len(names) == 1 else ", ".join(names[:-1]) + " and " + names[-1]


def plural(n: int, word: str) -> str:
    return f"{n} {word}" + ("" if n == 1 else "s")


def deadline_days_label(days: list[int]) -> str:
    days = sorted(days, reverse=True)
    text = str(days[0]) if len(days) == 1 else ", ".join(map(str, days[:-1])) + " and " + str(days[-1])
    return f"{text} day{'' if days == [1] else 's'} before"
