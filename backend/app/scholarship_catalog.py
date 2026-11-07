"""The scholarship list behind Explore Scholarships: Indian government, government-nominated and trust scholarships for
study abroad. For now the list comes from data/scholarships.csv, copied into the database when the API starts (see
sync_scholarships). Admin editing will come later; until then, change the CSV and redeploy."""

import csv
from datetime import date
from pathlib import Path

from app.db import get_db

CSV_PATH = Path(__file__).parent / "data" / "scholarships.csv"

TYPES = ["Central government", "State government", "International", "Trust"]
GROUPS = ["SC", "ST", "OBC / BC", "EBC", "Minority", "Maratha / Kunbi", "General", "Disability", "Open to all"]
# What a student can pick as their own category (disability is asked separately).
CATEGORIES = ["SC", "ST", "OBC / BC", "EBC", "Minority", "Maratha / Kunbi", "General"]
LEVELS = ["Undergraduate", "Master's", "PhD", "Post-doctoral"]
SUPPORT_TYPES = ["Scholarship", "Interest-free loan", "Low-interest loan"]
ALL_INDIA = "All India"


def _lines(text: str) -> list[str]:
    return [x.strip() for x in text.split("|") if x.strip()]


def _tags(text: str) -> list[str]:
    return [x.strip() for x in text.split(";") if x.strip()]


def _number(text: str) -> float | None:
    return float(text) if text.strip() else None


def _flag(text: str) -> bool | None:
    return {"true": True, "false": False}.get(text.strip().lower())


def load_csv(path: Path = CSV_PATH) -> list[dict]:
    """Every scholarship in the file, as stored in the database. Raises ValueError on a value the page can't use."""
    out: list[dict] = []
    with path.open(encoding="utf-8-sig", newline="") as f:
        for line, row in enumerate(csv.DictReader(f), start=2):
            doc = {
                "_id": row["id"].strip(),
                "name": row["name"].strip(),
                "offeredBy": row["offeredBy"].strip(),
                "type": row["type"].strip(),
                "state": row["state"].strip(),
                "targetGroups": _tags(row["targetGroups"]),
                "targetGroupText": row["targetGroupText"].strip(),
                "levels": _tags(row["levels"]),
                "supportType": row["supportType"].strip(),
                "maxAmount": row["maxAmount"].strip() or None,
                "seatsPerYear": row["seatsPerYear"].strip() or None,
                "applicationWindow": row["applicationWindow"].strip() or None,
                "coverage": _lines(row["coverage"]),
                "eligibility": _lines(row["eligibility"]),
                "howToApply": _lines(row["howToApply"]),
                "officialWebsite": row["officialWebsite"].strip() or None,
                "notes": row["notes"].strip() or None,
                "incomeLimitLakh": _number(row["incomeLimitLakh"]),
                "maxAge": _number(row["maxAge"]),
                "minMarksPercent": _number(row["minMarksPercent"]),
                "qsRankMax": _number(row["qsRankMax"]),
                "minWorkYears": _number(row["minWorkYears"]),
                "needsOffer": _flag(row["needsOffer"]),
                "onePerFamily": _flag(row["onePerFamily"]),
                "active": _flag(row["active"]) is not False,
                "lastChecked": date.fromisoformat(row["lastChecked"].strip()).isoformat(),
                "sourceUrl": row["sourceUrl"].strip() or None,
            }
            problems = [
                *(["id and name are required"] if not doc["_id"] or not doc["name"] else []),
                *([f"type must be one of {TYPES}"] if doc["type"] not in TYPES else []),
                *([f"unknown target group {g}" for g in doc["targetGroups"] if g not in GROUPS]),
                *([f"unknown level {lv}" for lv in doc["levels"] if lv not in LEVELS]),
                *([f"supportType must be one of {SUPPORT_TYPES}"] if doc["supportType"] not in SUPPORT_TYPES else []),
                *(["targetGroups and levels are required"] if not doc["targetGroups"] or not doc["levels"] else []),
            ]
            if problems:
                raise ValueError(f"scholarships.csv row {line}: {'; '.join(problems)}")
            out.append(doc)
    if len({d["_id"] for d in out}) != len(out):
        raise ValueError("scholarships.csv: every id must be different")
    return out


async def sync_scholarships() -> None:
    """Makes the database match the CSV. While the CSV is the only source, it simply overwrites; once admins can edit
    scholarships in the portal, this should only add ones that are missing."""
    db = get_db()
    docs = load_csv()
    for d in docs:
        await db.scholarships.replace_one({"_id": d["_id"]}, d, upsert=True)
    await db.scholarships.delete_many({"_id": {"$nin": [d["_id"] for d in docs]}})


def unmet(s: dict, *, home_state=None, category=None, disability=None, level=None, income=None, age=None, marks=None, qs_rank=None, work_years=None) -> list[str]:
    """What the student doesn't meet. Only what they entered is checked; a blank in the scholarship means no rule."""
    out: list[str] = []
    if home_state and s["state"] != ALL_INDIA and s["state"] != home_state:
        out.append(f"Only for students from {s['state']}")
    groups = s["targetGroups"]
    if "Open to all" not in groups:
        if groups == ["Disability"]:
            if disability is False:
                out.append("For students with disabilities")
        elif category and category not in groups:
            out.append(f"For {', '.join(g for g in groups if g != 'Disability')} students")
    if level and level not in s["levels"]:
        out.append(f"Not for {level} study")
    if income is not None and s.get("incomeLimitLakh") is not None and income > s["incomeLimitLakh"]:
        out.append(f"Family income up to ₹{s['incomeLimitLakh']:g} lakh")
    if age is not None and s.get("maxAge") is not None and age > s["maxAge"]:
        out.append(f"Up to age {s['maxAge']:g}")
    if marks is not None and s.get("minMarksPercent") is not None and marks < s["minMarksPercent"]:
        out.append(f"Needs {s['minMarksPercent']:g}% in your last degree")
    if qs_rank is not None and s.get("qsRankMax") is not None and qs_rank > s["qsRankMax"]:
        out.append(f"University must be in the QS top {s['qsRankMax']:g}")
    if work_years is not None and s.get("minWorkYears") is not None and work_years < s["minWorkYears"]:
        out.append(f"Needs {s['minWorkYears']:g} years of work experience")
    return out


def sort_key(s: dict, home_state: str | None):
    """Central schemes first, then the student's own state, other states, international and trust awards."""
    order = {"Central government": 0, "State government": 2, "International": 3, "Trust": 4}[s["type"]]
    if home_state and s["state"] == home_state:
        order = 1
    return (order, s["state"], s["name"].lower())
