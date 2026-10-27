"""Choices for adding a shortlist option: universities by country and upcoming intakes. Served by
GET /shortlist-options. The lists are short on purpose (well-known universities Indian students apply to);
"Other" lets a counsellor type any university that isn't listed. Courses come from app/career.py."""

from datetime import date

from app.career import STUDY_DESTINATIONS

OTHER_UNIVERSITY = "Other (type the name)"

UNIVERSITIES: dict[str, list[str]] = {
    "United Kingdom": [
        "Imperial College London",
        "University of Oxford",
        "University of Cambridge",
        "University College London (UCL)",
        "King’s College London",
        "London School of Economics (LSE)",
        "University of Edinburgh",
        "University of Manchester",
        "University of Bristol",
        "University of Warwick",
        "University of Glasgow",
        "University of Birmingham",
        "University of Leeds",
        "University of Southampton",
        "University of Sheffield",
        "University of Nottingham",
        "Queen Mary University of London",
        "Newcastle University",
        "Lancaster University",
        "University of Liverpool",
        "Coventry University",
        "University of Hertfordshire",
    ],
    "Ireland": [
        "Trinity College Dublin",
        "University College Dublin",
        "University of Galway",
        "University College Cork",
        "Dublin City University",
        "University of Limerick",
        "Maynooth University",
        "Technological University Dublin",
    ],
    "Germany": [
        "Technical University of Munich",
        "Ludwig Maximilian University of Munich",
        "Heidelberg University",
        "Humboldt University of Berlin",
        "Free University of Berlin",
        "Technical University of Berlin",
        "RWTH Aachen University",
        "Karlsruhe Institute of Technology",
        "University of Stuttgart",
        "University of Mannheim",
        "TU Dresden",
        "University of Hamburg",
    ],
    "France": [
        "Université PSL",
        "Institut Polytechnique de Paris",
        "Sorbonne University",
        "Université Paris-Saclay",
        "HEC Paris",
        "ESSEC Business School",
        "Sciences Po",
        "Grenoble Alpes University",
        "NEOMA Business School",
        "SKEMA Business School",
    ],
    "Netherlands": [
        "Delft University of Technology",
        "University of Amsterdam",
        "Leiden University",
        "Utrecht University",
        "Erasmus University Rotterdam",
        "University of Groningen",
        "Eindhoven University of Technology",
        "Maastricht University",
        "Wageningen University & Research",
    ],
    "Other in Europe": [
        "ETH Zurich (Switzerland)",
        "EPFL (Switzerland)",
        "KTH Royal Institute of Technology (Sweden)",
        "Lund University (Sweden)",
        "Technical University of Denmark",
        "University of Copenhagen (Denmark)",
        "KU Leuven (Belgium)",
        "Politecnico di Milano (Italy)",
        "Bocconi University (Italy)",
        "University of Barcelona (Spain)",
        "IE University (Spain)",
    ],
}

# Main intakes: January, May and September; German and other continental universities also use
# summer (April) and winter (October) semesters.
INTAKE_MONTHS = {1: "January {y}", 4: "April {y} (summer semester)", 5: "May {y}", 9: "September {y}", 10: "October {y} (winter semester)"}


def upcoming_intakes(today: date | None = None, years: int = 2) -> list[str]:
    """Intakes from next month for the next `years` years, in date order."""
    t = today or date.today()
    out = []
    for y in range(t.year, t.year + years + 1):
        for m, label in INTAKE_MONTHS.items():
            if (y, m) > (t.year, t.month) and (y, m) <= (t.year + years, t.month):
                out.append(label.format(y=y))
    return out


def options() -> dict:
    assert set(UNIVERSITIES) == set(STUDY_DESTINATIONS)
    return {"universities": {c: [*names, OTHER_UNIVERSITY] for c, names in UNIVERSITIES.items()}, "intakes": upcoming_intakes(), "otherUniversity": OTHER_UNIVERSITY}
