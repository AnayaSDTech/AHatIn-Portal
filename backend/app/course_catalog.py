"""The course list behind Explore Universities: reading the spreadsheet the team uploads, and checking a student's
eligibility. The figures only ever come from that spreadsheet (see routers/courses.py)."""

import csv
import io
import re
from datetime import date

from app.career import CAREER_DIRECTIONS

COLUMNS = [
    "university", "country", "course", "study_level", "study_area", "intakes", "intake_years", "status", "duration_months", "tuition_per_year", "currency",
    "application_fee", "avg_scholarship", "min_qualification", "min_ug_percent", "min_12th_percent", "max_backlogs", "min_ielts", "min_pte", "min_toefl", "min_duolingo", "featured", "qs_ranking",
    "source_url", "checked_on",
]
STUDY_LEVELS = ["Foundation", "Diploma", "Bachelor's", "Master's", "PhD"]
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
# Lowest to highest, for comparing a student's qualification with what a course asks for.
QUALIFICATIONS = ["12th", "Bachelor's", "Master's"]
ENGLISH_MINIMUMS = {"IELTS": "minIelts", "PTE": "minPte", "TOEFL": "minToefl", "Duolingo": "minDuolingo"}
# Rough rupee values, only so that "cheapest first" can compare courses in different currencies. Never shown to students.
SORT_RATES = {"INR": 1, "GBP": 110, "EUR": 95, "USD": 85, "CHF": 100, "SEK": 8, "DKK": 13, "NOK": 8, "PLN": 22, "CZK": 3.7, "HUF": 0.24}
AREAS = [d["label"] for d in CAREER_DIRECTIONS]


def _number(row: dict, column: str, errors: list[str], *, top: float | None = None, whole: bool = False):
    text = (row.get(column) or "").replace(",", "").strip()
    if not text:
        return None
    try:
        value = float(text)
    except ValueError:
        errors.append(f"{column} must be a number, not “{text}”")
        return None
    if value < 0 or (top is not None and value > top):
        errors.append(f"{column} must be between 0 and {top:g}" if top is not None else f"{column} can't be negative")
        return None
    if whole:
        if value != int(value):
            errors.append(f"{column} must be a whole number")
            return None
        return int(value)
    return value


def _list(text: str) -> list[str]:
    return [x.strip() for x in re.split(r"[;,/]", text or "") if x.strip()]


def _row(row: dict) -> tuple[dict, list[str]]:
    errors: list[str] = []
    text = {c: (row.get(c) or "").strip() for c in COLUMNS}
    for column in ("university", "country", "course", "study_level", "study_area", "intakes", "status", "tuition_per_year", "currency", "checked_on"):
        if not text[column]:
            errors.append(f"{column} is required")
    level = next((x for x in STUDY_LEVELS if x.lower() == text["study_level"].lower()), None)
    if text["study_level"] and not level:
        errors.append(f"study_level must be one of: {', '.join(STUDY_LEVELS)}")
    area = next((x for x in AREAS if x.lower() == text["study_area"].lower()), None)
    if text["study_area"] and not area:
        errors.append(f"study_area must be one of: {', '.join(AREAS)}")
    intakes = [m.title()[:3] for m in _list(text["intakes"])]
    bad = [m for m in intakes if m not in MONTHS]
    if bad:
        errors.append(f"intakes must be months like Sep;Jan;May, not {', '.join(bad)}")
    intakes = list(dict.fromkeys(m for m in intakes if m in MONTHS))
    years = _list(text["intake_years"])
    if any(not re.fullmatch(r"20\d\d", y) for y in years):
        errors.append("intake_years must be years like 2027;2028")
    status = text["status"].title()
    if text["status"] and status not in ("Open", "Closed"):
        errors.append("status must be Open or Closed")
    currency = text["currency"].upper()
    if text["currency"] and currency not in SORT_RATES:
        errors.append(f"currency must be one of: {', '.join(SORT_RATES)}")
    qualification = next((x for x in QUALIFICATIONS if x.lower() == text["min_qualification"].lower()), None)
    if text["min_qualification"] and not qualification:
        errors.append(f"min_qualification must be one of: {', '.join(QUALIFICATIONS)}")
    featured = text["featured"].lower()
    if featured not in ("", "yes", "no"):
        errors.append("featured must be Yes, No or blank")
    if text["source_url"] and not re.fullmatch(r"https?://\S{3,500}", text["source_url"]):
        errors.append("source_url must be a web address starting with https://")
    checked = None
    if text["checked_on"]:
        try:
            checked = date.fromisoformat(text["checked_on"])
        except ValueError:
            errors.append("checked_on must be a date like 2026-11-03")
        else:
            if checked > date.today():
                errors.append("checked_on can't be in the future")
    doc = {
        "university": text["university"], "country": text["country"], "course": text["course"], "level": level, "area": area, "intakes": intakes, "years": sorted(years),
        "status": status, "durationMonths": _number(row, "duration_months", errors, top=120, whole=True), "tuitionPerYear": _number(row, "tuition_per_year", errors), "currency": currency,
        "applicationFee": _number(row, "application_fee", errors), "avgScholarship": _number(row, "avg_scholarship", errors), "minQualification": qualification,
        "minUgPercent": _number(row, "min_ug_percent", errors, top=100), "min12thPercent": _number(row, "min_12th_percent", errors, top=100),
        "maxBacklogs": _number(row, "max_backlogs", errors, top=100, whole=True), "minIelts": _number(row, "min_ielts", errors, top=9), "minPte": _number(row, "min_pte", errors, top=90),
        "minToefl": _number(row, "min_toefl", errors, top=120), "minDuolingo": _number(row, "min_duolingo", errors, top=160),
        "featured": featured == "yes", "qsRanking": _number(row, "qs_ranking", errors, top=5000, whole=True),
        "sourceUrl": text["source_url"] or None, "checkedOn": checked.isoformat() if checked else None,
    }
    return doc, errors


def parse_csv(content: str) -> tuple[list[dict], list[str]]:
    """Every row, or the reasons the file can't be used. Nothing is saved unless the whole file is right."""
    reader = csv.DictReader(io.StringIO(content.lstrip("﻿").strip()))
    headers = [h.strip().lower() for h in reader.fieldnames or []]
    missing = [c for c in COLUMNS if c not in headers]
    if missing:
        return [], [f"Missing columns: {', '.join(missing)}. Please use the template."]
    reader.fieldnames = headers
    rows: list[dict] = []
    errors: list[str] = []
    seen: set[tuple] = set()
    ranked: dict[str, tuple] = {}
    for line, raw in enumerate(reader, start=2):
        if not any((v or "").strip() for v in raw.values() if isinstance(v, str)):
            continue
        doc, problems = _row(raw)
        key = (doc["university"].lower(), doc["course"].lower(), doc["level"])
        if key in seen:
            problems.append("this university, course and study level is already in the file")
        seen.add(key)
        if ranked.setdefault(doc["university"].lower(), (doc["featured"], doc["qsRanking"])) != (doc["featured"], doc["qsRanking"]):
            problems.append("featured and qs_ranking must be the same on every row of a university")
        errors += [f"Row {line}: {p}" for p in problems]
        rows.append(doc)
    if not rows and not errors:
        errors.append("The file has no courses in it.")
    return rows, errors


def unmet(course: dict, *, qualification=None, ug=None, hsc=None, backlogs=None, test=None, score=None) -> list[str]:
    """What the student doesn't meet. Only what they entered is checked; a blank in the course means no requirement."""
    out: list[str] = []
    need = course.get("minQualification")
    if qualification in QUALIFICATIONS and need and QUALIFICATIONS.index(qualification) < QUALIFICATIONS.index(need):
        out.append("Needs 12th or equivalent" if need == "12th" else f"Needs {need} or higher")
    if ug is not None and course.get("minUgPercent") is not None and ug < course["minUgPercent"]:
        out.append(f"Needs {course['minUgPercent']:g}% in undergraduate")
    if hsc is not None and course.get("min12thPercent") is not None and hsc < course["min12thPercent"]:
        out.append(f"Needs {course['min12thPercent']:g}% in 12th")
    if backlogs is not None and course.get("maxBacklogs") is not None and backlogs > course["maxBacklogs"]:
        out.append(f"Allows up to {course['maxBacklogs']} backlogs")
    if test == "Not taken yet":
        needed = [f"{name} {course[field]:g}" for name, field in ENGLISH_MINIMUMS.items() if course.get(field) is not None]
        if needed:
            out.append(f"Needs an English test ({', '.join(needed)})")
    elif test in ENGLISH_MINIMUMS and score is not None:
        minimum = course.get(ENGLISH_MINIMUMS[test])
        if minimum is not None and score < minimum:
            out.append(f"Needs {test} {minimum:g}")
    return out


def sort_key(sort: str):
    name = lambda c: (c["university"].lower(), c["course"].lower())  # noqa: E731
    rank = lambda c: (c.get("qsRanking") is None, c.get("qsRanking") or 0)  # noqa: E731
    return {
        "qs": lambda c: (*rank(c), name(c)),
        "tuition": lambda c: ((c.get("tuitionPerYear") or 0) * SORT_RATES.get(c["currency"], 1), name(c)),
    }.get(sort, lambda c: (not c.get("featured"), *rank(c), name(c)))
