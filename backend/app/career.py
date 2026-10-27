"""Choices for a student's career plan (service 1). Kept short on purpose: a handful of common courses per
career direction, plus "Other" for anything else (described in the notes). Served to the UI by GET /career-options,
so the list lives in one place."""

OTHER_COURSE = "Other (describe in notes)"

CAREER_DIRECTIONS = [
    {
        "key": "computing",
        "label": "Computing & IT",
        "courses": ["Computer Science", "Data Science & Analytics", "Artificial Intelligence", "Cyber Security", "Software Engineering", "Information Systems"],
    },
    {
        "key": "engineering",
        "label": "Engineering",
        "courses": ["Mechanical Engineering", "Electrical & Electronic Engineering", "Civil Engineering", "Chemical Engineering", "Aerospace Engineering", "Robotics & Automation"],
    },
    {
        "key": "business",
        "label": "Business & Management",
        "courses": ["Business Management", "International Business", "Marketing", "Project Management", "Supply Chain & Logistics", "Human Resource Management"],
    },
    {
        "key": "finance",
        "label": "Finance & Economics",
        "courses": ["Finance", "Accounting", "Economics", "Financial Technology (FinTech)", "Business Analytics"],
    },
    {
        "key": "health",
        "label": "Health & Life Sciences",
        "courses": ["Public Health", "Nursing", "Biotechnology", "Pharmacy", "Biomedical Science", "Healthcare Management"],
    },
    {
        "key": "creative",
        "label": "Design, Media & Architecture",
        "courses": ["Graphic & Digital Design", "Fashion", "Architecture", "Film & Media Production", "Journalism & Communication"],
    },
    {
        "key": "social",
        "label": "Law, Social Sciences & Education",
        "courses": ["Law", "International Relations", "Psychology", "Education", "Social Work"],
    },
    {
        "key": "hospitality",
        "label": "Hospitality & Tourism",
        "courses": ["Hospitality Management", "Tourism Management", "Events Management", "Culinary Arts"],
    },
]

STUDY_LEVELS = [
    {"key": "foundation", "label": "Foundation / pathway"},
    {"key": "bachelors", "label": "Bachelor's"},
    {"key": "masters", "label": "Master's"},
    {"key": "mba", "label": "MBA"},
    {"key": "phd", "label": "PhD / research"},
]

# The countries AHat works with (the same list as the shortlist).
STUDY_DESTINATIONS = ["United Kingdom", "Ireland", "Germany", "France", "Netherlands", "Other in Europe"]

DIRECTIONS_BY_KEY = {d["key"]: d for d in CAREER_DIRECTIONS}
LEVELS_BY_KEY = {lvl["key"]: lvl["label"] for lvl in STUDY_LEVELS}


def options() -> dict:
    return {"directions": [{**d, "courses": [*d["courses"], OTHER_COURSE]} for d in CAREER_DIRECTIONS], "levels": STUDY_LEVELS, "destinations": STUDY_DESTINATIONS, "otherCourse": OTHER_COURSE}


def plan_summary(direction: str, course: str, level: str, destinations: list[str]) -> str:
    """One readable line, shown to the student in their progress tracker, e.g.
    "Data Science & Analytics (Master's) · United Kingdom, Ireland"."""
    subject = f"{DIRECTIONS_BY_KEY[direction]['label']} (other course)" if course == OTHER_COURSE else course
    return f"{subject} ({LEVELS_BY_KEY[level]}) · {', '.join(destinations)}"
