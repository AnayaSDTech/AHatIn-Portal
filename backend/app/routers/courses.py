"""Explore Universities: students search the course list. Only what the team uploads is shown."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.core.audit import audit
from app.core.auth import Admin, require_roles
from app.core.clock import iso, now
from app.core.errors import ApiError
from app.course_catalog import AREAS, COLUMNS, ENGLISH_MINIMUMS, QUALIFICATIONS, STUDY_LEVELS, parse_csv, sort_key, unmet
from app.db import get_db, new_id
from app.schemas import CourseImportBody

router = APIRouter(tags=["courses"])

Reader = Annotated[dict, Depends(require_roles("student", "parent", "admin"))]
PAGE = 50


def _out(c: dict, problems: list[str] | None) -> dict:
    fields = ("university", "country", "course", "level", "area", "intakes", "years", "status", "durationMonths", "tuitionPerYear", "currency", "applicationFee", "avgScholarship", "featured", "qsRanking", "sourceUrl", "checkedOn")
    return {"id": c["_id"], **{k: c.get(k) for k in fields}, "eligible": None if problems is None else not problems, "unmet": problems or []}


@router.get("/courses/options")
async def course_options(_: Reader):
    found = await get_db().courses.find({}, {"country": 1, "level": 1, "area": 1, "intakes": 1, "years": 1, "importedAt": 1}).to_list(None)
    return {
        "destinations": sorted({c["country"] for c in found}),
        "levels": [x for x in STUDY_LEVELS if any(c["level"] == x for c in found)],
        "areas": [x for x in AREAS if any(c["area"] == x for c in found)],
        "intakes": [m for m in ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec") if any(m in c["intakes"] for c in found)],
        "years": sorted({y for c in found for y in c["years"]}),
        "qualifications": QUALIFICATIONS,
        "englishTests": [*ENGLISH_MINIMUMS, "Not taken yet"],
        "total": len(found),
        "updatedAt": iso(found[0]["importedAt"]) if found else None,
    }


@router.get("/courses")
async def search_courses(
    _: Reader,
    q: Annotated[str, Query(max_length=100)] = "",
    destination: str = "",
    level: str = "",
    area: str = "",
    intake: str = "",
    year: str = "",
    sort: str = "featured",
    offset: Annotated[int, Query(ge=0)] = 0,
    qualification: str = "",
    ugPercent: Annotated[float | None, Query(ge=0, le=100)] = None,
    hscPercent: Annotated[float | None, Query(ge=0, le=100)] = None,
    backlogs: Annotated[int | None, Query(ge=0, le=100)] = None,
    englishTest: str = "",
    englishScore: Annotated[float | None, Query(ge=0, le=160)] = None,
    eligibleOnly: bool = False,
):
    query: dict = {}
    if destination:
        query["country"] = destination
    if level:
        query["level"] = level
    if area:
        query["area"] = area
    if intake:
        query["intakes"] = intake
    if year:
        query["years"] = year
    found = await get_db().courses.find(query).to_list(None)
    words = q.lower().split()
    if words:
        found = [c for c in found if all(w in f"{c['course']} {c['university']}".lower() for w in words)]
    student = {"qualification": qualification or None, "ug": ugPercent, "hsc": hscPercent, "backlogs": backlogs, "test": englishTest or None, "score": englishScore}
    checking = any(v is not None for v in student.values())
    rows = [(c, unmet(c, **student) if checking else None) for c in found]
    if checking and eligibleOnly:
        rows = [r for r in rows if not r[1]]
    key = sort_key(sort)
    rows.sort(key=lambda r: key(r[0]))
    return {"total": len(rows), "universities": len({c["university"] for c, _ in rows}), "eligible": sum(1 for _, p in rows if not p) if checking else None, "items": [_out(c, p) for c, p in rows[offset : offset + PAGE]], "pageSize": PAGE}


@router.get("/admin/courses")
async def course_list_status(_: Admin):
    db = get_db()
    latest = await db.courses.find_one({}, sort=[("importedAt", -1)])
    return {"total": await db.courses.count_documents({}), "updatedAt": iso(latest["importedAt"]) if latest else None, "updatedBy": latest.get("importedBy") if latest else None, "columns": COLUMNS}


@router.post("/admin/courses/import")
async def import_courses(body: CourseImportBody, admin: Admin):
    """Replaces the whole list, and only if every row is right."""
    rows, errors = parse_csv(body.csv)
    if errors:
        raise ApiError(400, f"Nothing was saved. Please fix {len(errors)} {'problem' if len(errors) == 1 else 'problems'} and upload the file again.", {"csv": "\n".join(errors[:50])})
    db = get_db()
    t = now()
    docs = [{"_id": new_id(), **r, "importedAt": t, "importedBy": admin["name"]} for r in rows]
    await db.courses.insert_many(docs)
    await db.courses.delete_many({"importedAt": {"$ne": t}})
    await audit(admin, "courses.imported", "courses", "all", {"rows": len(docs)})
    return {"total": len(docs), "updatedAt": iso(t), "updatedBy": admin["name"]}


@router.delete("/admin/courses", status_code=204)
async def clear_courses(admin: Admin):
    await get_db().courses.delete_many({})
    await audit(admin, "courses.cleared", "courses", "all")
