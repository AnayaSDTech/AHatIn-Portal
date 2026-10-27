"""Demo data (development) and the first administrator (production).

    python -m app.seed                         # load the demo data (development only)
    python -m app.seed --bootstrap-admin EMAIL "Full Name"   # first admin: prints a one-time set-up link

The demo data is the same as the original demo app: the same people, records and IDs, with dates relative to
today, so every screen looks the same. All people, numbers and agencies are fictional.
"""

import argparse
import asyncio
import base64
import hashlib
from datetime import date, datetime, timedelta

from app import career
from app.config import get_settings
from app.core.clock import UTC, iso, local_dt, local_now, now, today
from app.core.security import encrypt, hash_password
from app.db import ensure_indexes, get_db, new_id
from app.domain import DEPARTURE_TASKS, blank_profile, empty_journey, mobile_digits
from app.services import storage
from app.services.students import profile_in

BUSINESS = ["students", "documents", "applications", "notes", "sessions", "availability", "time_off", "messages", "leads", "follow_ups", "access_grants", "agencies", "uploads", "counters", "locks"]

COUNSELLORS = [
    ("c1", "Priya Desai", "demo.counsellor@ahatin.example", "+91 98000 11111", "https://meet.google.com/juz-bodt-wbd", 40),
    ("c2", "Rohan Kapoor", "rohan.k@ahatin.example", "+91 98000 22222", "https://meet.google.com/juz-bodt-wbd", 180),
    ("c3", "Neha Joshi", "neha.j@ahatin.example", "+91 98000 33333", "https://meet.google.com/juz-bodt-wbd", 1200),
]
# What the admin knows about each counsellor, for matching students to them (see app/matching.py).
MATCHING = {
    "c1": {"countries": [{"country": "United Kingdom", "years": 6}, {"country": "Ireland", "years": 2}], "universities": ["University of Leeds"], "subjects": ["computing", "engineering"], "languages": ["English", "Hindi", "Marathi"], "capacity": 40},
    "c2": {"countries": [{"country": "Ireland", "years": 4}, {"country": "France", "years": 3}], "universities": ["University College Dublin"], "subjects": ["health", "business"], "languages": ["English", "Hindi", "French"], "capacity": 35},
    "c3": {"countries": [{"country": "Germany", "years": 5}, {"country": "United Kingdom", "years": 3}], "universities": ["Technical University of Munich"], "subjects": ["finance", "business", "engineering"], "languages": ["English", "Hindi", "German"], "capacity": 30},
}
DEFAULT_STAFF_PASSWORD = "Staff@1234"


def demo_totp_secret(email: str) -> str:
    """A fixed authenticator secret per demo account (development only)."""
    return base64.b32encode(hashlib.sha1(f"ahat-demo:{email}".encode()).digest()).decode().rstrip("=")


# ---------------------------------------------------------------- relative dates (as in the demo app)


def minutes_from_now(m: float) -> datetime:
    return now() + timedelta(minutes=m)


def ago(days: float) -> datetime:
    return minutes_from_now(-60 * 24 * days)


def ago_iso(days: float) -> str:
    return iso(ago(days))


def days_from_now(d: int) -> str:
    return (today() + timedelta(days=d)).isoformat()


def workday(offset: int, weekdays_only: bool = False) -> str:
    """A date N days from today, moved past Sundays (and Saturdays when weekdays_only)."""
    d = today() + timedelta(days=offset)
    while d.weekday() == 6 or (weekdays_only and d.weekday() == 5):
        d += timedelta(days=1)
    return d.isoformat()


# ---------------------------------------------------------------- builders


def item(id_: str, university: str, course: str, country: str, **extra) -> dict:
    return {
        "id": id_,
        "university": university,
        "course": course,
        "country": country,
        "intake": "September 2027",
        "tuition": "£30,000 a year",
        "livingCost": "£1,300 a month",
        "deadline": days_from_now(40),
        "agency": "Demo Partner Agency A",
        "earnsCommission": True,
        "reason": "Good match for your profile and goals.",
        "comments": [],
        **extra,
    }


def journey(**parts) -> dict:
    return {**empty_journey(), **parts}


def plan(direction: str, course: str, level: str, destinations: list[str], days: float, by: str = "Priya Desai", notes: str = "") -> dict:
    summary = career.plan_summary(direction, course, level, destinations)
    return {"at": ago_iso(days), "by": by, "direction": direction, "course": course, "level": level, "destinations": destinations, "notes": notes, "summary": summary}


def approved(items: list[dict], shared: float, approved_days: float) -> dict:
    return {"version": 1, "status": "approved", "sharedAt": ago_iso(shared), "approvedAt": ago_iso(approved_days), "firstApprovedAt": ago_iso(approved_days), "items": items}


def sample_pdf(title: str) -> bytes:
    """A small one-page PDF so seeded documents can be opened."""
    text = title.replace("(", "[").replace(")", "]").encode("latin-1", "replace")
    stream = b"BT /F1 18 Tf 72 720 Td (" + text + b") Tj 0 -28 Td /F1 11 Tf (Sample document - demo data) Tj ET"
    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for i, o in enumerate(objs, 1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n".encode() + o + b"\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n".encode()
    out += b"".join(f"{o:010d} 00000 n \n".encode() for o in offsets)
    out += f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    return bytes(out)


# ---------------------------------------------------------------- users


async def upsert_user(doc: dict, password: str | None = None) -> None:
    db = get_db()
    existing = await db.users.find_one({"_id": doc["_id"]})
    if password:
        doc["passwordHash"] = existing["passwordHash"] if existing and existing.get("passwordHash") else hash_password(password)
        doc["totpSecretEnc"] = encrypt(demo_totp_secret(doc["email"]))
    doc.setdefault("status", "active")
    doc.setdefault("createdAt", now() - timedelta(days=400))
    await db.users.delete_many({"email": doc["email"], "_id": {"$ne": doc["_id"]}})
    await db.users.update_one({"_id": doc["_id"]}, {"$set": doc}, upsert=True)


async def seed_users() -> None:
    await upsert_user({"_id": "u1", "role": "admin", "name": "Vikram Rao", "email": "demo.admin@ahatin.example", "mobile": "+919800022222", "lastLoginAt": minutes_from_now(-5)}, "Admin@1234")
    for cid, name, email, phone, link, last in COUNSELLORS:
        await upsert_user(
            {"_id": cid, "role": "counsellor", "name": name, "email": email, "mobile": "+91" + mobile_digits(phone), "counsellorProfile": {"phone": phone, "meetingLink": link}, "matchingProfile": MATCHING[cid], "lastLoginAt": minutes_from_now(-last)},
            DEFAULT_STAFF_PASSWORD,
        )
    # Specialist officers: funding (service 4), then visa, pre-departure and arrival (services 5-7).
    await upsert_user({"_id": "u6", "role": "finance_officer", "name": "Kavya Iyer", "email": "kavya.i@ahatin.example", "mobile": "+919800044444", "counsellorProfile": {"phone": "+91 98000 44444"}, "lastLoginAt": minutes_from_now(-90)}, DEFAULT_STAFF_PASSWORD)
    await upsert_user({"_id": "u7", "role": "visa_officer", "name": "Aditya Rao", "email": "aditya.r@ahatin.example", "mobile": "+919800055555", "counsellorProfile": {"phone": "+91 98000 55555"}, "lastLoginAt": minutes_from_now(-150)}, DEFAULT_STAFF_PASSWORD)
    await upsert_user({"_id": "u5", "role": "officer", "name": "Sameer Khan", "email": "sameer.k@ahatin.example", "mobile": "", "lastLoginAt": minutes_from_now(-120)}, DEFAULT_STAFF_PASSWORD)
    for uid, name, email, mobile, ref in [
        ("demo-student-1", "Ananya Sharma", "demo.student@ahatin.example", "+919800000000", "AH-2026-00042"),
        ("demo-student-2", "Aarav Patel", "new.student@ahatin.example", "+919800033333", "AH-2026-00090"),
    ]:
        await upsert_user({"_id": uid, "role": "student", "name": name, "email": email, "mobile": mobile, "studentReference": ref, "emailVerifiedAt": now() - timedelta(days=60), "consentAt": now() - timedelta(days=60)})


# ---------------------------------------------------------------- students


def doc(id_: str, name: str, state: str, category: str = "general", days: float = 3, reason: str | None = None) -> dict:
    d = {"_id": id_, "name": name, "state": state, "category": category}
    if state != "missing":
        d["uploadedAt"] = ago(days)
        d["fileKey"] = f"seed/{id_}.pdf"
        d["contentType"] = "application/pdf"
    if reason:
        d["reason"] = reason
    return d


def app_(id_: str, university: str, course: str, agency: str, state: str, deadline: str | None = None, conditions: list | None = None) -> dict:
    a = {"_id": id_, "university": university, "course": course, "agency": agency, "state": state, "history": []}
    if deadline:
        a["deadline"] = deadline
    if conditions:
        a["conditions"] = conditions
    return a


def students() -> list[dict]:
    all_departure_done = {k: ago_iso(20) for k in DEPARTURE_TASKS}
    return [
        {
            "_id": "s1", "counsellorId": "c1", "userId": "demo-student-1", "reference": "AH-2026-00042", "name": "Ananya Sharma", "email": "demo.student@ahatin.example", "mobile": "+91 98000 00000",
            "goal": "MSc Data Science", "destination": "United Kingdom", "intake": "September 2027", "stage": "applications_submitted",
            "documents": [
                doc("d1", "Passport (first and last page)", "verified", "general", 20),
                doc("d2", "Degree certificate", "verified", "general", 20),
                doc("d3", "Academic transcripts", "verified", "general", 20),
                doc("d4", "IELTS score report", "verified", "general", 6),
                doc("d5", "Statement of Purpose (final)", "pending", "general", 0.2),
                doc("d6", "Letter of Recommendation 1", "verified", "general", 8),
                doc("d7", "Letter of Recommendation 2", "rejected", "general", 2, "Signature missing; please upload a signed copy"),
                doc("d8", "Updated CV", "missing"),
                doc("d9", "Bank statement (last 3 months)", "missing", "funds"),
            ],
            "applications": [
                app_("a1", "University of Manchester", "MSc Data Science", "Demo Partner Agency A", "conditional_offer", days_from_now(30),
                     [{"text": "Final degree certificate with at least 60% / 7.0 CGPA", "met": False}, {"text": "IELTS 6.5 overall with no band below 6.0", "met": True}]),
                app_("a2", "King’s College London", "MSc Data Science", "Demo Partner Agency A", "under_review", days_from_now(45)),
                app_("a3", "University College Dublin", "MSc Business Analytics", "Demo Partner Agency B", "submitted", days_from_now(60)),
                app_("a4", "University of Leeds", "MSc Data Science and Analytics", "Demo Partner Agency A", "draft", days_from_now(9)),
            ],
            "journey": journey(
                careerPlan=plan("computing", "Data Science & Analytics", "masters", ["United Kingdom", "Ireland"], 40, notes="UK first; Ireland as a back-up for the two-year stay-back visa."),
                shortlist=approved(
                    [
                        item("sl1", "University of Manchester", "MSc Data Science", "United Kingdom", tuition="£33,000 a year", choice="apply", reason="Strong data-science department; your 8.4 CGPA meets the entry requirement."),
                        item("sl2", "King’s College London", "MSc Data Science", "United Kingdom", tuition="£35,000 a year", livingCost="£1,600 a month", choice="apply", reason="Ambitious choice with excellent London employer links."),
                        item("sl3", "University College Dublin", "MSc Business Analytics", "Ireland", tuition="€29,000 a year", livingCost="€1,400 a month", agency="Demo Partner Agency B", choice="apply", reason="Good back-up with a two-year stay-back visa in Ireland."),
                        item("sl4", "University of Leeds", "MSc Data Science and Analytics", "United Kingdom", tuition="£31,000 a year", choice="apply", reason="Safe option with a strong scholarship record for Indian students."),
                        item("sl5", "University of Glasgow", "MSc Data Analytics", "United Kingdom", choice="removed", removeReason="I prefer to stay in England.", reason="Well-ranked, lower living costs."),
                    ],
                    30, 28,
                ),
                funding={
                    "estimatedCost": 34,
                    "sources": [{"id": "fs1", "kind": "Family savings", "amount": 12}, {"id": "fs2", "kind": "Education loan", "amount": 18}],
                    "scholarships": [{"id": "sc1", "name": "Demo Global Excellence Scholarship (Manchester)", "amount": "£5,000", "deadline": days_from_now(25), "status": "applied"}],
                },
            ),
            "notes": [(3, "Priya Desai", "Strong profile. Prioritise Manchester; check scholarship for international students.")],
            "profile": {
                "dateOfBirth": "2001-04-18", "city": "Pune", "passportNumber": "Z1234567", "degree": "B.Tech Computer Science", "institution": "Demo Institute of Technology",
                "grade": "8.4 CGPA", "englishTest": "IELTS", "englishScore": "7.5", "workExperience": "2 years · Data Analyst", "courseInterest": "MSc Data Science",
                "destination": "United Kingdom", "intake": "September 2027", "budget": "₹25–35 lakh",
            },
        },
        {
            "_id": "s2", "counsellorId": "c1", "reference": "AH-2026-00031", "name": "Arjun Mehta", "email": "arjun.m@example.com", "mobile": "+91 98111 30002",
            "goal": "MSc Computer Science", "destination": "United Kingdom", "intake": "September 2027", "stage": "offer_accepted",
            "documents": [doc("d10", "Passport (first and last page)", "verified", "general", 40), doc("d11", "Bank statement (sponsor, 28 days)", "pending", "funds", 0.8), doc("d12", "TB test certificate", "missing", "visa")],
            "applications": [
                app_("a5", "University of Glasgow", "MSc Computer Science", "Demo Partner Agency A", "accepted"),
                app_("a6", "University of Leeds", "MSc Advanced Computer Science", "Demo Partner Agency A", "declined"),
            ],
            "journey": journey(
                careerPlan=plan("computing", "Computer Science", "masters", ["United Kingdom"], 90),
                shortlist=approved([item("sl6", "University of Glasgow", "MSc Computer Science", "United Kingdom", choice="apply"), item("sl7", "University of Leeds", "MSc Advanced Computer Science", "United Kingdom", choice="apply")], 80, 78),
                funding={"estimatedCost": 30, "sources": [{"id": "fs3", "kind": "Sponsor", "amount": 30}], "scholarships": []},
                visa={"stage": "cas_received", "history": [{"at": ago_iso(2), "by": "Priya Desai", "stage": "cas_received", "note": "CAS from Glasgow received."}]},
            ),
            "notes": [(1, "Priya Desai", "CAS received. Mock credibility interview scheduled next week.")],
        },
        {
            "_id": "s3", "counsellorId": "c2", "reference": "AH-2026-00055", "name": "Fatima Sheikh", "email": "fatima.s@example.com", "mobile": "+91 98111 30003",
            "goal": "MSc Public Health", "destination": "Ireland", "intake": "September 2027", "stage": "documents_shortlist",
            "documents": [doc("d13", "Passport (first and last page)", "pending", "general", 0.1), doc("d14", "Degree certificate", "pending", "general", 0.1)],
            "applications": [],
            "journey": journey(
                careerPlan=plan("health", "Public Health", "masters", ["Ireland"], 12, "Rohan Kapoor"),
                shortlist={
                    "version": 1, "status": "shared", "sharedAt": ago_iso(1),
                    "items": [
                        item("sl8", "University College Dublin", "MSc Public Health", "Ireland", tuition="€24,000 a year", livingCost="€1,400 a month", agency="Demo Partner Agency B"),
                        item("sl9", "Demo University of Galway", "MSc Health Promotion", "Ireland", tuition="€19,000 a year", livingCost="€1,100 a month", agency="Demo Partner Agency B", earnsCommission=False),
                    ],
                },
            ),
            "notes": [],
        },
        {
            "_id": "s4", "counsellorId": "c1", "financeOfficerId": "u6", "visaOfficerId": "u7", "reference": "AH-2025-00187", "name": "Meera Krishnan", "email": "meera.k@example.com", "mobile": "+91 98111 30004",
            "goal": "MSc Mechanical Engineering", "destination": "Germany", "intake": "Winter 2026", "stage": "arrived",
            "documents": [doc("d15", "Blocked account confirmation", "verified", "funds", 70)],
            "applications": [app_("a7", "Technical University of Munich", "MSc Mechanical Engineering", "Own application", "accepted")],
            "journey": journey(
                careerPlan=plan("engineering", "Mechanical Engineering", "masters", ["Germany"], 300, notes="Public universities with no tuition fee; APS certificate needed."),
                shortlist=approved([item("sl10", "Technical University of Munich", "MSc Mechanical Engineering", "Germany", tuition="No tuition fee", livingCost="€1,100 a month", agency="Own application", earnsCommission=False, choice="apply")], 280, 275),
                funding={"estimatedCost": 14, "sources": [{"id": "fs4", "kind": "Family savings", "amount": 14}], "scholarships": []},
                visa={"stage": "granted", "history": [{"at": ago_iso(60), "by": "Priya Desai", "stage": "granted"}]},
                departure={"done": all_departure_done, "confirmedAt": ago_iso(18), "confirmedBy": "Priya Desai"},
                arrival={"arrivedAt": ago_iso(10)},
            ),
            "notes": [(5, "Priya Desai", "Arrived in Munich. Anmeldung appointment booked.")],
        },
        {
            "_id": "s5", "counsellorId": "c3", "financeOfficerId": "u6", "reference": "AH-2026-00060", "name": "Nikhil Bose", "email": "nikhil.b@example.com", "mobile": "+91 98111 30005",
            "goal": "MSc Finance", "destination": "United Kingdom", "intake": "January 2027", "stage": "visa_filed",
            "documents": [doc("d16", "Bank statement (28 days)", "verified", "funds", 25)],
            "applications": [app_("a8", "University of Leeds", "MSc Finance", "Demo Partner Agency A", "accepted")],
            "journey": journey(
                careerPlan=plan("finance", "Finance", "masters", ["United Kingdom"], 120, "Neha Joshi"),
                shortlist=approved([item("sl11", "University of Leeds", "MSc Finance", "United Kingdom", intake="January 2027", choice="apply")], 110, 108),
                funding={"estimatedCost": 32, "sources": [{"id": "fs5", "kind": "Education loan", "amount": 32}], "scholarships": []},
                visa={"stage": "submitted", "reference": "GWF0123456", "history": [{"at": ago_iso(6), "by": "Neha Joshi", "stage": "submitted", "note": "Reference GWF0123456"}]},
            ),
            "notes": [],
        },
        {
            "_id": "s6", "counsellorId": "c2", "reference": "AH-2026-00071", "name": "Tanvi Kulkarni", "email": "tanvi.k@example.com", "mobile": "+91 98111 30006",
            "goal": "MSc Marketing", "destination": "Ireland", "intake": "September 2027", "stage": "registered",
            "documents": [doc("d17", "Passport (first and last page)", "missing"), doc("d18", "Degree certificate", "missing")],
            "applications": [], "journey": journey(), "notes": [],
        },
        {
            "_id": "s7", "counsellorId": "c3", "reference": "AH-2026-00077", "name": "Harsh Vardhan", "email": "harsh.v@example.com", "mobile": "+91 98111 30007",
            "goal": "MSc Business Analytics", "destination": "Germany", "intake": "Winter 2027", "stage": "documents_shortlist",
            "documents": [doc("d19", "APS certificate", "pending", "general", 0.3)],
            "applications": [],
            "journey": journey(
                careerPlan=plan("finance", "Business Analytics", "masters", ["Germany"], 9, "Neha Joshi"),
                shortlist={"version": 1, "status": "draft", "items": [item("sl12", "Demo University of Mannheim", "MSc Business Analytics", "Germany", intake="Winter 2027", tuition="€1,500 a semester", livingCost="€1,000 a month", agency="Demo Master Agent C")]},
            ),
            "notes": [],
        },
        {
            "_id": "s8", "counsellorId": "c2", "reference": "AH-2026-00081", "name": "Leela Menon", "email": "leela.m@example.com", "mobile": "+91 98111 30008",
            "goal": "MSc International Business", "destination": "France", "intake": "September 2027", "stage": "applications_submitted",
            "documents": [],
            "applications": [app_("a9", "Demo Business School, Lyon", "MSc International Business", "Demo Master Agent C", "under_review", days_from_now(35))],
            "journey": journey(
                careerPlan=plan("business", "International Business", "masters", ["France"], 50, "Rohan Kapoor"),
                shortlist=approved([item("sl13", "Demo Business School, Lyon", "MSc International Business", "France", tuition="€18,000 a year", livingCost="€1,100 a month", agency="Demo Master Agent C", choice="apply")], 40, 38),
            ),
            "notes": [],
        },
        {
            # Demo login new.student@ahatin.example: nothing started, for trying every service by hand.
            "_id": "s9", "counsellorId": "c1", "userId": "demo-student-2", "reference": "AH-2026-00090", "name": "Aarav Patel", "email": "new.student@ahatin.example", "mobile": "+91 98000 33333",
            "goal": "To be decided", "destination": "United Kingdom", "intake": "September 2027", "stage": "registered",
            "documents": [
                doc("d20", "Passport (first and last page)", "missing"),
                doc("d21", "Degree certificate", "missing"),
                doc("d22", "Academic transcripts", "missing"),
                doc("d23", "English test score report", "missing"),
                doc("d24", "Updated CV", "missing"),
            ],
            "applications": [], "journey": journey(), "notes": [(1, "System", "Registered online.")],
        },
        {
            # Profile complete, no counsellor yet: in the admin's "Waiting for a counsellor" list.
            "_id": "s10", "counsellorId": None, "reference": "AH-2026-00091", "name": "Rhea Kulkarni", "email": "rhea.k@example.com", "mobile": "+91 98111 30010",
            "goal": "MSc Public Health", "destination": "Ireland", "intake": "September 2027", "stage": "registered",
            "documents": [doc("d25", "Passport (first and last page)", "missing"), doc("d26", "Degree certificate", "missing")],
            "applications": [], "journey": journey(), "notes": [(2, "System", "Registered online."), (1, "Rhea Kulkarni (student)", "Completed their profile. Waiting for the admin to assign a counsellor.")],
            "profile": {
                "dateOfBirth": "2000-09-02", "city": "Nagpur", "passportNumber": "", "degree": "B.Pharm", "institution": "Demo College of Pharmacy",
                "grade": "78%", "englishTest": "IELTS", "englishScore": "7", "workExperience": "1 year · Hospital pharmacist", "courseInterest": "MSc Public Health",
                "destination": "Ireland", "intake": "September 2027", "budget": "₹25–35 lakh",
            },
            "profileCompletedAt": ago(1),
        },
        {
            # Registered, profile not complete yet: in the admin's "Profile incomplete" list.
            "_id": "s11", "counsellorId": None, "reference": "AH-2026-00092", "name": "Kabir Shah", "email": "kabir.s@example.com", "mobile": "+91 98111 30011",
            "goal": "To be decided", "destination": "Not decided", "intake": "To be decided", "stage": "registered",
            "documents": [doc("d27", "Passport (first and last page)", "missing")],
            "applications": [], "journey": journey(), "notes": [(0.5, "System", "Registered online.")],
        },
    ]


async def seed_students() -> None:
    db = get_db()
    # The demo documents' sample PDFs go into the document bucket (skipped if storage isn't set up yet).
    upload = storage.is_configured()
    if not upload:
        print("Document storage isn't configured (S3_* settings): demo documents are listed but their files won't open.")
    for i, s in enumerate(students()):
        documents = s.pop("documents")
        applications = s.pop("applications")
        notes = s.pop("notes")
        profile = s.pop("profile", None) or blank_profile()
        t = now() - timedelta(days=200 - i)
        await db.students.insert_one(
            {**s, "assignmentHistory": [], "mobileDigits": mobile_digits(s["mobile"]), "profile": profile_in(profile), "createdAt": t, "updatedAt": t}
        )
        for d in documents:
            await db.documents.insert_one({**d, "studentId": s["_id"], "createdAt": t, "deletedAt": None})
            if d.get("fileKey") and upload:
                await storage.put(d["fileKey"], sample_pdf(d["name"]), "application/pdf")
        for a in applications:
            await db.applications.insert_one({**a, "deadline": a.get("deadline"), "studentId": s["_id"], "createdAt": t})
        for days, by, text in notes:
            await db.notes.insert_one({"_id": new_id(), "studentId": s["_id"], "at": ago(days), "by": by, "text": text, "kind": "note" if by != "System" else "event"})
    await db.counters.update_one({"_id": f"student_ref_{local_now().year}"}, {"$max": {"seq": 92}}, upsert=True)


# ---------------------------------------------------------------- leads and follow-ups


def lead(id_, name, email, mobile, city, source, interest, stage, score, created_min, cid, activities) -> dict:
    acts = [{"at": minutes_from_now(m), "channel": ch, "outcome": out, **({"notes": n} if n else {})} for m, ch, out, n in activities]
    first = min((a["at"] for a in acts if a["channel"] != "System"), default=None)
    out = {
        "_id": id_, "name": name, "email": email, "mobile": mobile, "mobileDigits": mobile_digits(mobile), "city": city, "source": source, "interest": interest,
        "stage": stage, "score": score, "createdAt": minutes_from_now(created_min), "counsellorId": cid, "activities": acts,
    }
    if first:
        out["firstContactAt"] = first
    return out


async def seed_leads() -> None:
    h = 60
    leads = [
        lead("l1", "Karan Malhotra", "karan.m@example.com", "+91 98111 20001", "Delhi", "Website", "MSc Computer Science · UK · Sep 2027", "new_lead", 82, -22, None, []),
        lead("l2", "Diya Patel", "diya.p@example.com", "+91 98111 20002", "Ahmedabad", "Instagram ad", "MBA · Ireland · Sep 2027", "new_lead", 64, -6, "c1", []),
        lead("l3", "Aman Gill", "aman.g@example.com", "+91 98111 20003", "Chandigarh", "Google ad", "MSc Data Science · UK · Sep 2027", "contacted", 71, -h * 26, "c2",
             [(-h * 25, "Call", "Reached", "Interested in the Graduate Route. Wants a session this week.")]),
        lead("l4", "Sara Thomas", "sara.t@example.com", "+91 98111 20004", "Kochi", "Referral", "MSc Nursing · UK · Jan 2028", "assessment_booked", 77, -h * 50, "c1",
             [(-h * 48, "WhatsApp", "Reached", "Session booked for Friday.")]),
        lead("l5", "Rahul Nair", "rahul.n@example.com", "+91 98111 20005", "Bengaluru", "Seminar", "MSc Mechanical Engineering · Germany · Winter 2027", "assessed", 88, -h * 120, "c1",
             [(-h * 30, "Meeting", "Reached", "Plan shared: TU options, APS needed.")]),
        lead("l6", "Ishita Sen", "ishita.s@example.com", "+91 98111 20006", "Kolkata", "Website", "MSc Finance · UK · Sep 2027", "contacted", 58, -h * 75, "c3",
             [(-h * 70, "Call", "No answer", None), (-h * 46, "Call", "No answer", None)]),
        lead("l7", "Vivek Reddy", "vivek.r@example.com", "+91 98111 20007", "Hyderabad", "WhatsApp", "MSc Information Systems · Ireland · Jan 2028", "new_lead", 45, -h * 3, None, []),
        lead("l8", "Pooja Iyer", "pooja.i@example.com", "+91 98111 20008", "Chennai", "Walk-in", "MSc Biotechnology · Ireland · Sep 2027", "assessed", 69, -h * 200, "c3",
             [(-h * 90, "Meeting", "Reached", "Shared plan; waiting for budget confirmation from parents.")]),
    ]
    # The demo shows activity newest first.
    for item_ in leads:
        item_["activities"].sort(key=lambda a: a["at"], reverse=True)
    await get_db().leads.insert_many(leads)

    def fu(id_, cid, person, pid, ptype, action, rule, due_min, type_, source=None):
        d = {"_id": id_, "counsellorId": cid, "person": person, "personId": pid, "personType": ptype, "action": action, "rule": rule, "dueAt": minutes_from_now(due_min), "type": type_, "done": False, "createdAt": now()}
        if source:
            d["sourceEvent"] = source
        # Already-overdue demo follow-ups count as escalated, so loading the demo doesn't email the managers.
        if due_min < 0:
            d["escalatedAt"] = now()
        return d

    await get_db().follow_ups.insert_many(
        [
            fu("f1", None, "Karan Malhotra", "l1", "lead", "First contact with new enquiry", "New enquiry · 15 minutes", -7, "call", "lead:l1:first-contact"),
            fu("f2", "c1", "Diya Patel", "l2", "lead", "First contact with new enquiry", "New enquiry · 15 minutes", 9, "call", "lead:l2:first-contact"),
            fu("f3", "c3", "Ishita Sen", "l6", "lead", "Follow up (2 unanswered calls)", "No session booked · 48 hours", -h * 2, "whatsapp"),
            fu("f4", "c1", "Ananya Sharma", "s1", "student", "Verify uploaded document: Statement of Purpose", "Document uploaded · 1 working day", h * 3, "verify", "doc:d5:seed"),
            fu("f5", "c1", "Rahul Nair", "l5", "lead", "Follow up on shared plan", "Plan shared, not registered · 48 hours", h * 5, "call", "lead:l5:plan"),
            fu("f6", "u7", "Meera Krishnan", "s4", "student", "1-week check-in after arrival", "After arrival · 1 week", h * 26, "checkin", "arrival:s4"),
            fu("f8", "c2", "Aman Gill", "l3", "lead", "Book an assessment session", "Contacted, no session booked · 48 hours", h * 4, "call", "lead:l3:book"),
            fu("f9", "c3", "Nikhil Bose", "s5", "student", "Check visa decision status", "Visa filed · follow up", -30, "reminder", "visa:s5:submitted"),
            fu("f10", None, "Rhea Kulkarni", "s10", "student", "Assign a counsellor (profile complete)", "Profile complete · 1 working day", h * 6, "reminder", "student:s10:assign"),
            fu("f11", None, "Arjun Mehta", "s2", "student", "Assign a Financial Aid Officer", "Application Assistance complete · 1 working day", h * 5, "reminder", "student:s2:assign-finance"),
            fu("f12", None, "Nikhil Bose", "s5", "student", "Assign a Visa Officer", "Scholarship & Financial Guidance complete · 1 working day", h * 7, "reminder", "student:s5:assign-visa"),
            fu("f7", "c1", "Arjun Mehta", "s2", "student", "Remind about visa fee due", "Visa fee due · 7 days before", h * 30, "reminder"),
        ]
    )


# ---------------------------------------------------------------- scheduling, messages, access, agencies


async def seed_schedule() -> None:
    db = get_db()

    def weekdays(blocks):
        return {str(d): blocks for d in range(1, 6)}

    await db.availability.insert_many(
        [
            {"_id": "av-c1", "counsellorId": "c1", "weekly": {**weekdays([{"start": "10:00", "end": "13:00", "mode": "both"}, {"start": "14:00", "end": "18:00", "mode": "both"}]), "6": [{"start": "10:00", "end": "14:00", "mode": "office"}]},
             "slotMinutes": 45, "bufferMinutes": 15, "minNoticeHours": 12, "horizonDays": 14},
            {"_id": "av-c2", "counsellorId": "c2", "weekly": weekdays([{"start": "11:00", "end": "19:00", "mode": "online"}]), "slotMinutes": 30, "bufferMinutes": 0, "minNoticeHours": 4, "horizonDays": 14},
            {"_id": "av-u6", "counsellorId": "u6", "weekly": weekdays([{"start": "10:00", "end": "17:00", "mode": "online"}]), "slotMinutes": 30, "bufferMinutes": 0, "minNoticeHours": 4, "horizonDays": 14},
            {"_id": "av-u7", "counsellorId": "u7", "weekly": weekdays([{"start": "11:00", "end": "18:00", "mode": "both"}]), "slotMinutes": 45, "bufferMinutes": 15, "minNoticeHours": 12, "horizonDays": 14},
            {"_id": "av-c3", "counsellorId": "c3", "weekly": {str(d): [{"start": "10:00", "end": "16:00", "mode": "both"}] for d in range(2, 7)}, "slotMinutes": 60, "bufferMinutes": 0, "minNoticeHours": 24, "horizonDays": 21},
        ]
    )
    await db.time_off.insert_many(
        [
            {"_id": "to1", "counsellorId": "c1", "date": workday(6, True), "reason": "Education fair (demo)"},
            {"_id": "to2", "counsellorId": "c2", "date": workday(2, True), "start": "15:00", "end": "19:00", "reason": "Training (demo)"},
        ]
    )
    yesterday = now() - timedelta(days=1)
    today_iso = today().isoformat()
    past = lambda n: (today() - timedelta(days=n)).isoformat()  # noqa: E731

    def session(id_, sid, cid, type_, d, time, minutes, mode, status, booked_by, by, **extra):
        start = local_dt(d, time)
        return {
            "_id": id_, "studentId": sid, "counsellorId": cid, "type": type_, "date": d, "time": time, "durationMinutes": minutes, "mode": mode, "status": status,
            "bookedBy": booked_by, "history": [{"at": yesterday, "by": by, "text": "Session booked."}], "startsAt": start, "endsAt": start + timedelta(minutes=minutes),
            # Reminders for the demo sessions count as sent, so loading the demo doesn't email anyone.
            "remindedAt": now(), "createdAt": yesterday, **extra,
        }

    await db.sessions.insert_many(
        [
            session("ss1", "s1", "c1", "Application review", workday(3, True), "16:00", 45, "online", "booked", "student", "Ananya Sharma", studentNote="Want to discuss the Manchester offer conditions."),
            session("ss2", "s2", "c1", "Visa preparation", today_iso, "17:00", 45, "online", "booked", "counsellor", "Priya Desai"),
            session("ss3", "s4", "u7", "Post-arrival check-in", today_iso, "11:00", 45, "online", "booked", "counsellor", "Aditya Rao"),
            session("ss4", "s3", "c2", "Career counselling", workday(2, True), "12:00", 30, "online", "booked", "student", "Fatima Sheikh"),
            session("ss5", "s5", "c3", "Visa preparation", workday(2), "11:00", 60, "office", "booked", "student", "Nikhil Bose"),
            session("ss6", "s2", "c1", "Scholarship & funding", past(5), "15:00", 45, "office", "completed", "student", "Arjun Mehta", outcomeNotes="Confirmed sponsor funds; bank letter to be uploaded."),
            session("ss7", "s6", "c2", "Career counselling", past(2), "13:00", 30, "online", "no_show", "student", "Tanvi Kulkarni"),
            # Aarav's first session, booked by Priya for the day the demo data loads (same time as Arjun's, on request).
            session("ss8", "s9", "c1", "Career counselling", today_iso, "17:00", 45, "online", "booked", "counsellor", "Priya Desai"),
        ]
    )
    await db.messages.insert_many(
        [
            {"_id": "m1", "studentId": "s1", "from": "student", "by": "Ananya Sharma", "text": "Hi Priya, does Manchester offer any scholarship for Indian students?", "at": minutes_from_now(-60 * 26), "readAt": minutes_from_now(-60 * 25)},
            {"_id": "m2", "studentId": "s1", "from": "staff", "by": "Priya Desai", "text": "Yes. The Global Excellence Scholarship (£5,000). I have added it to your funding plan; the deadline is in your dashboard.", "at": minutes_from_now(-60 * 25), "readAt": minutes_from_now(-60 * 24)},
            {"_id": "m3", "studentId": "s1", "from": "student", "by": "Ananya Sharma", "text": "Thank you! I will apply this week.", "at": minutes_from_now(-60 * 3), "readAt": None},
        ]
    )
    await db.access_grants.insert_one({"_id": "g1", "granteeId": "c1", "ownerId": "c2", "until": workday(4, True), "reason": "Rohan on leave (demo)", "grantedBy": "Vikram Rao", "createdAt": now()})
    # "historicApplications" are applications from before the portal; live ones are counted from the records.
    await db.agencies.insert_many(
        [
            {"_id": "ag1", "name": "Demo Partner Agency A", "type": "Aggregator", "countries": "UK, Ireland", "commissionShare": "60%", "agreementEnd": days_from_now(240), "status": "Active", "historicApplications": 59},
            {"_id": "ag2", "name": "Demo Partner Agency B", "type": "Aggregator", "countries": "Ireland, Germany", "commissionShare": "55%", "agreementEnd": days_from_now(21), "status": "Active", "historicApplications": 40},
            {"_id": "ag3", "name": "Demo Master Agent C", "type": "Master agent", "countries": "Germany, France", "commissionShare": "50%", "agreementEnd": days_from_now(400), "status": "Active", "historicApplications": 11},
            {"_id": "ag4", "name": "Demo Partner Agency D", "type": "Aggregator", "countries": "UK", "commissionShare": "58%", "agreementEnd": days_from_now(-30), "status": "Inactive", "historicApplications": 9},
        ]
    )


async def recreate_missing_records() -> None:
    """Students who registered themselves keep their login after a demo reset, with a fresh record."""
    from app.services.students import create_student_record

    db = get_db()
    async for u in db.users.find({"role": "student", "_id": {"$nin": ["demo-student-1", "demo-student-2"]}}):
        if not await db.students.find_one({"userId": u["_id"]}):
            record = await create_student_record(u, destination=None, intake=None)
            await db.users.update_one({"_id": u["_id"]}, {"$set": {"studentReference": record["reference"]}})


async def seed(keep_logins: bool = True) -> None:
    s = get_settings()
    if not s.is_dev:
        raise SystemExit("Demo data can only be loaded in development.")
    db = get_db()
    await ensure_indexes()
    for name in BUSINESS:
        await db[name].delete_many({})
    if not keep_logins:
        await db.auth_sessions.delete_many({})
    await db.notifications.delete_many({"status": "queued"})
    await db.rate_limits.delete_many({})
    await seed_users()
    await seed_students()
    await seed_leads()
    await seed_schedule()
    await recreate_missing_records()


async def bootstrap_admin(email: str, name: str) -> None:
    from app.routers.admin import _send_invite

    db = get_db()
    await ensure_indexes()
    email = email.strip().lower()
    if await db.users.find_one({"email": email}):
        raise SystemExit("A user with this email already exists.")
    user = {"_id": new_id(), "role": "admin", "name": name.strip(), "email": email, "mobile": "", "status": "invited", "createdAt": now()}
    await db.users.insert_one(user)
    link = await _send_invite(user, {"_id": "system", "name": "AHat"})
    print(f"Administrator created. One-time set-up link (valid 72 hours):\n{link}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--bootstrap-admin", nargs=2, metavar=("EMAIL", "NAME"))
    args = parser.parse_args()
    if args.bootstrap_admin:
        asyncio.run(bootstrap_admin(*args.bootstrap_admin))
    else:
        asyncio.run(seed(keep_logins=False))
        print("Demo data loaded.")
        for email in ["demo.counsellor@ahatin.example", "demo.admin@ahatin.example"]:
            print(f"  {email}: authenticator secret {demo_totp_secret(email)}")


if __name__ == "__main__":
    main()


__all__ = ["seed", "UTC", "date"]
