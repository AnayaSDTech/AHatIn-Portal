"""Suggesting a counsellor for a student, from the student's profile only. The admin always makes the choice.

Score out of 100:
- Country (50): the counsellor knows the student's preferred destination; more years score higher.
- Subject (30): the student's course of interest falls in one of the counsellor's subject areas.
- Spare capacity (20): room left against the counsellor's capacity. Counsellors at capacity are flagged, not hidden.
"""

import re

from app import career

COUNTRY_POINTS = 50
SUBJECT_POINTS = 30
CAPACITY_POINTS = 20
DEFAULT_CAPACITY = 40
UNDECIDED = ("", "Not sure yet", "Not decided")

# Words that point to a subject area when a student types their course of interest in their own words.
EXTRA_KEYWORDS = {
    "computing": ["computer", "computing", "data", "ai", "machine learning", "cyber", "software", "it", "information", "analytics"],
    "engineering": ["engineering", "mechanical", "electrical", "electronic", "civil", "chemical", "aerospace", "robotics", "automation"],
    "business": ["business", "management", "mba", "marketing", "project", "supply chain", "logistics", "hr", "human resource"],
    "finance": ["finance", "financial", "accounting", "economics", "fintech", "banking", "investment"],
    "health": ["health", "nursing", "biotech", "biotechnology", "pharmacy", "biomedical", "medicine", "medical", "public health"],
    "creative": ["design", "fashion", "architecture", "film", "media", "journalism", "communication", "animation"],
    "social": ["law", "llm", "international relations", "psychology", "education", "social", "politics"],
    "hospitality": ["hospitality", "tourism", "events", "culinary", "hotel"],
}


def _words(text: str) -> str:
    return " " + re.sub(r"[^a-z0-9]+", " ", text.lower()).strip() + " "


def subject_for(course_interest: str) -> str | None:
    """The subject area (career direction key) a course of interest belongs to, e.g. "MSc Data Science" → "computing"."""
    text = _words(course_interest)
    best, hits = None, 0
    for d in career.CAREER_DIRECTIONS:
        terms = [*d["courses"], *EXTRA_KEYWORDS.get(d["key"], [])]
        n = sum(1 for t in terms if _words(t) in text)
        if n > hits:
            best, hits = d["key"], n
    return best


def subject_label(key: str) -> str:
    return career.DIRECTIONS_BY_KEY[key]["label"] if key in career.DIRECTIONS_BY_KEY else key


def blank_matching_profile() -> dict:
    return {"countries": [], "universities": [], "subjects": [], "languages": [], "capacity": DEFAULT_CAPACITY}


def score(profile: dict, counsellor: dict, active_students: int) -> dict:
    """One counsellor's match for a student profile, with the points and the reasons the admin sees."""
    m = {**blank_matching_profile(), **(counsellor.get("matchingProfile") or {})}
    reasons: list[str] = []

    destination = (profile.get("destination") or "").strip()
    years = next((c.get("years", 0) for c in m["countries"] if c["country"] == destination), None)
    if destination in UNDECIDED:
        country = COUNTRY_POINTS // 2
        reasons.append("Destination not decided yet")
    elif years is not None:
        country = round(COUNTRY_POINTS * (0.6 + 0.4 * min(years, 5) / 5))
        reasons.append(f"{years} {'year' if years == 1 else 'years'} with {destination}")
    else:
        country = 0
        reasons.append(f"No experience with {destination}")

    subject_key = subject_for(profile.get("courseInterest") or "")
    if not subject_key:
        subject = SUBJECT_POINTS // 2
        reasons.append("Course not matched to a subject area")
    elif subject_key in m["subjects"]:
        subject = SUBJECT_POINTS
        reasons.append(f"Knows {subject_label(subject_key)}")
    else:
        subject = 0
        reasons.append(f"Doesn't cover {subject_label(subject_key)}")

    capacity_limit = max(int(m["capacity"] or DEFAULT_CAPACITY), 1)
    spare = max(capacity_limit - active_students, 0)
    capacity = round(CAPACITY_POINTS * spare / capacity_limit)
    reasons.append(f"{active_students} of {capacity_limit} students")

    return {
        "counsellorId": counsellor["_id"],
        "name": counsellor["name"],
        "score": country + subject + capacity,
        "points": {"country": country, "subject": subject, "capacity": capacity},
        "reasons": reasons,
        "atCapacity": spare == 0,
        "activeStudents": active_students,
        "capacity": capacity_limit,
        "universities": m["universities"],
        "languages": m["languages"],
    }


def rank(profile: dict, counsellors: list[dict], loads: dict[str, int]) -> list[dict]:
    """Best match first; counsellors at capacity go below those with room."""
    found = [score(profile, c, loads.get(c["_id"], 0)) for c in counsellors]
    return sorted(found, key=lambda x: (x["atCapacity"], -x["score"], x["activeStudents"]))
