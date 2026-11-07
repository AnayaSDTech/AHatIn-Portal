"""Explore Scholarships: students browse scholarships for study abroad and check their eligibility."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.core.auth import require_roles
from app.db import get_db
from app.scholarship_catalog import ALL_INDIA, CATEGORIES, GROUPS, LEVELS, SUPPORT_TYPES, TYPES, sort_key, unmet

router = APIRouter(tags=["scholarships"])

Reader = Annotated[dict, Depends(require_roles("student", "parent", "admin"))]
PAGE = 5


def _out(s: dict, problems: list[str] | None) -> dict:
    return {"id": s["_id"], **{k: v for k, v in s.items() if k not in ("_id", "active")}, "eligible": None if problems is None else not problems, "unmet": problems or []}


@router.get("/scholarships/options")
async def scholarship_options(_: Reader):
    found = await get_db().scholarships.find({"active": True}, {"state": 1, "type": 1, "targetGroups": 1, "levels": 1, "supportType": 1, "lastChecked": 1}).to_list(None)
    states = sorted({s["state"] for s in found if s["state"] != ALL_INDIA})
    return {
        "types": [t for t in TYPES if any(s["type"] == t for s in found)],
        "states": [ALL_INDIA, *states] if found else [],
        "groups": [g for g in GROUPS if any(g in s["targetGroups"] for s in found)],
        "levels": [lv for lv in LEVELS if any(lv in s["levels"] for s in found)],
        "supportTypes": [t for t in SUPPORT_TYPES if any(s["supportType"] == t for s in found)],
        "categories": CATEGORIES,
        "total": len(found),
        "updatedAt": max((s["lastChecked"] for s in found), default=None),
    }


@router.get("/scholarships")
async def search_scholarships(
    _: Reader,
    q: Annotated[str, Query(max_length=100)] = "",
    type: str = "",  # noqa: A002 - the filter's name on the page
    state: str = "",
    group: str = "",
    level: str = "",
    support: str = "",
    homeState: str = "",
    category: str = "",
    disability: bool | None = None,
    studyLevel: str = "",
    incomeLakh: Annotated[float | None, Query(ge=0, le=1000)] = None,
    age: Annotated[int | None, Query(ge=10, le=100)] = None,
    marks: Annotated[float | None, Query(ge=0, le=100)] = None,
    qsRank: Annotated[int | None, Query(ge=1, le=5000)] = None,
    workYears: Annotated[float | None, Query(ge=0, le=60)] = None,
    eligibleOnly: bool = False,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    query: dict = {"active": True}
    if type:
        query["type"] = type
    if state:
        query["state"] = state
    if group:
        # Scholarships open to everyone are for this group too.
        query["targetGroups"] = {"$in": [group, "Open to all"]}
    if level:
        query["levels"] = level
    if support:
        query["supportType"] = support
    found = await get_db().scholarships.find(query).to_list(None)
    words = q.lower().split()
    if words:
        found = [s for s in found if all(w in f"{s['name']} {s['offeredBy']} {s['state']}".lower() for w in words)]
    student = {
        "home_state": homeState or None, "category": category or None, "disability": disability, "level": studyLevel or None,
        "income": incomeLakh, "age": age, "marks": marks, "qs_rank": qsRank, "work_years": workYears,
    }
    checking = any(v is not None for v in student.values())
    rows = [(s, unmet(s, **student) if checking else None) for s in found]
    if checking and eligibleOnly:
        rows = [r for r in rows if not r[1]]
    rows.sort(key=lambda r: sort_key(r[0], homeState or None))
    return {"total": len(rows), "eligible": sum(1 for _, p in rows if not p) if checking else None, "items": [_out(s, p) for s, p in rows[offset : offset + PAGE]], "pageSize": PAGE}
