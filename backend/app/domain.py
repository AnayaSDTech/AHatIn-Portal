"""Business vocabulary shared by every module (mirrors the frontend's constants)."""

STAGES = [
    "new_lead",
    "contacted",
    "assessment_booked",
    "assessed",
    "registered",
    "documents_shortlist",
    "applications_submitted",
    "offer_accepted",
    "visa_filed",
    "visa_granted",
    "arrived",
    "enrolled",
    "settled",
]
LEAD_STAGES = STAGES[:4]
STAGE_LABELS = {
    "new_lead": "New lead",
    "contacted": "Contacted",
    "assessment_booked": "Assessment booked",
    "assessed": "Assessed / plan shared",
    "registered": "Registered client",
    "documents_shortlist": "Documents and shortlist",
    "applications_submitted": "Applications submitted",
    "offer_accepted": "Offer accepted",
    "visa_filed": "Visa filed",
    "visa_granted": "Visa granted",
    "arrived": "Arrived",
    "enrolled": "Enrolled",
    "settled": "Settled",
}


def stage_index(stage: str) -> int:
    return STAGES.index(stage) if stage in STAGES else -1


APP_LABELS = {
    "draft": "Draft",
    "submitted": "Submitted",
    "under_review": "Under review",
    "more_info_requested": "More information requested",
    "interview": "Interview",
    "conditional_offer": "Conditional offer",
    "unconditional_offer": "Unconditional offer",
    "accepted": "Accepted",
    "declined": "Declined",
    "rejected": "Rejected",
    "withdrawn": "Withdrawn",
}
APP_TRANSITIONS = {
    "draft": ["submitted", "withdrawn"],
    "submitted": ["under_review", "more_info_requested", "interview", "conditional_offer", "unconditional_offer", "rejected", "withdrawn"],
    "under_review": ["more_info_requested", "interview", "conditional_offer", "unconditional_offer", "rejected", "withdrawn"],
    "more_info_requested": ["under_review", "withdrawn"],
    "interview": ["under_review", "conditional_offer", "unconditional_offer", "rejected", "withdrawn"],
    "conditional_offer": ["unconditional_offer", "accepted", "declined", "rejected", "withdrawn"],
    "unconditional_offer": ["accepted", "declined", "withdrawn"],
    "accepted": ["withdrawn"],
    "declined": [],
    "rejected": [],
    "withdrawn": [],
}
STUDENT_DECISIONS = ("accepted", "declined")
OFFER_STATES = ("conditional_offer", "unconditional_offer")

VISA_PATH = ["cas_received", "documents_verified", "fees_paid", "submitted", "biometrics"]
VISA_LABELS = {
    "cas_received": "CAS or admission letter received",
    "documents_verified": "Visa documents checked",
    "fees_paid": "Visa fee and health surcharge paid",
    "submitted": "Visa application submitted",
    "biometrics": "Biometrics appointment done",
    "granted": "Visa granted",
    "refused": "Visa refused",
}

DEPARTURE_TASKS = ["accommodation", "flight", "insurance", "money", "briefing", "documents"]

SERVICE_TITLES = {
    # S1 covers the career plan and the university shortlist (there is no S2 any more; the other codes stay as they were).
    "S1": "Career Counselling & University Selection",
    "S3": "Application Assistance",
    "S4": "Scholarship & Financial Guidance",
    "S5": "Visa Assistance",
    "S6": "Pre-Departure Support",
    "S7": "Post-Arrival Support",
}
# Who looks after each service: the counsellor (1-3), the Financial Aid Officer (4), the Visa Officer (5-7).
SERVICE_AREA = {"S1": "counsellor", "S3": "counsellor", "S4": "finance", "S5": "visa", "S6": "visa", "S7": "visa"}
OFFICER_FIELD = {"finance": "financeOfficerId", "visa": "visaOfficerId"}
OFFICER_ROLE = {"finance": "finance_officer", "visa": "visa_officer"}
AREA_OF_ROLE = {"finance_officer": "finance", "visa_officer": "visa"}
OFFICER_TITLE = {"finance": "Financial Aid Officer", "visa": "Visa Officer"}
# Documents and sessions belong to the person looking after their service.
DOC_AREA = {"general": "counsellor", "funds": "finance", "visa": "visa"}
SESSION_AREA = {"Scholarship & funding": "finance", "Visa preparation": "visa", "Pre-departure briefing": "visa", "Post-arrival check-in": "visa"}
SERVICE_STATUS_LABELS = {"not_started": "Not started", "in_progress": "In progress", "completed": "Completed", "not_needed": "Not needed"}

SESSION_TYPES = [
    "Career counselling",
    "Application review",
    "Scholarship & funding",
    "Visa preparation",
    "Pre-departure briefing",
    "Post-arrival check-in",
]
FUNDING_SOURCES = ["Family savings", "Education loan", "Scholarship", "Sponsor", "Other"]
SCHOLARSHIP_STATUSES = ["to_apply", "applied", "awarded", "not_awarded"]
DOC_CATEGORIES = ["general", "funds", "visa"]

STARTER_DOCUMENTS = ["Passport (first and last page)", "Degree certificate", "Academic transcripts", "Updated CV"]

DESTINATION_LABELS = {"uk": "United Kingdom", "europe": "Europe", "undecided": "Not decided"}

PROFILE_DESTINATIONS = ["United Kingdom", "Germany", "Ireland", "France", "Not sure yet"]
PROFILE_INTAKES = ["January 2027", "September 2027", "January 2028", "September 2028"]
REGISTER_INTAKES = ["2027-01", "2027-09", "2028-01", "2028-09"]
BUDGETS = ["Under ₹15 lakh", "₹15–25 lakh", "₹25–35 lakh", "₹35–50 lakh", "Above ₹50 lakh"]
ENGLISH_TESTS = ["IELTS", "PTE", "TOEFL", "Duolingo", "Not taken yet"]

FOLLOW_UP_RULES = [
    {"trigger": "New enquiry (working hours)", "action": "Make first contact", "limit": "15 minutes", "escalation": "Manager alerted"},
    {"trigger": "New enquiry (out of hours)", "action": "Make first contact", "limit": "11:00 next working day", "escalation": "Manager alerted"},
    {"trigger": "Contacted, no session booked", "action": "Follow up", "limit": "48 hours, then 7 days", "escalation": "Nurture after 3 failed tries"},
    {"trigger": "Assessment done", "action": "Share the plan", "limit": "24 hours", "escalation": "Manager alerted"},
    {"trigger": "Document uploaded", "action": "Verify or reject", "limit": "1 working day", "escalation": "Manager alerted"},
    {"trigger": "Application or scholarship deadline", "action": "Remind student and staff", "limit": "14, 7 and 2 days before", "escalation": "Manager alerted at 2 days"},
    {"trigger": "Planned arrival", "action": "Confirm safe arrival", "limit": "24 hours", "escalation": "Counsellor and manager alerted"},
    {"trigger": "Urgent support message", "action": "Respond", "limit": "2 hours, any day", "escalation": "Manager alerted immediately"},
]


def empty_journey() -> dict:
    return {"funding": {"sources": [], "scholarships": []}, "departure": {"done": {}}, "arrival": {}, "overrides": {}}


def blank_profile() -> dict:
    return {
        "dateOfBirth": "",
        "gender": "",
        # Permanent address (city is part of it).
        "addressLine1": "",
        "addressLine2": "",
        "city": "",
        "state": "",
        "pincode": "",
        "passportNumber": "",
        # 10th (SSC) and 12th (HSC).
        "sscBoard": "",
        "sscSchool": "",
        "sscYear": "",
        "sscScore": "",
        "hscBoard": "",
        "hscStream": "",
        "hscCollege": "",
        "hscYear": "",
        "hscScore": "",
        # Highest qualification.
        "degree": "",
        "degreeSubject": "",
        "institution": "",
        "graduationYear": "",
        "grade": "",
        "englishTest": "Not taken yet",
        "englishScore": "",
        "workExperience": "",
        # Up to MAX_COURSES courses; `courseInterest` is the first one (used for matching and as the record's goal).
        "courseInterests": [],
        "courseInterest": "",
        "destination": "",
        "intake": "",
        "budget": "",
    }


GENDERS = ("Female", "Male", "Other", "Prefer not to say")
INDIAN_STATES = (
    "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh",
    "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir",
    "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
    "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
    "Uttar Pradesh", "Uttarakhand", "West Bengal",
)
MAX_COURSES = 3
# Starting the journey needs only these. The form also requires the address and the highest qualification's year (the 10th,
# 12th, gender and grade are optional), but profiles completed before those were added stay complete.
PROFILE_REQUIRED = ["dateOfBirth", "city", "degree", "institution", "englishTest", "courseInterest", "destination", "intake", "budget"]
STUDY_PLAN_FIELDS = {"courseInterests": "courses of interest", "destination": "preferred destination", "intake": "preferred intake"}


def courses_of(profile: dict | None) -> list[str]:
    """The student's courses of interest (profiles saved before there could be several have just `courseInterest`)."""
    p = profile or {}
    return list(p.get("courseInterests") or ([p["courseInterest"]] if p.get("courseInterest") else []))


def profile_complete(profile: dict | None) -> bool:
    """Everything the profile form requires (work experience is optional; the passport is added by staff).
    A student's journey starts, and the admin can assign a counsellor, only once this is true."""
    p = profile or {}
    if any(not str(p.get(k) or "").strip() for k in PROFILE_REQUIRED):
        return False
    return p["englishTest"] == "Not taken yet" or bool(str(p.get("englishScore") or "").strip())


def mobile_digits(mobile: str) -> str:
    return "".join(ch for ch in mobile if ch.isdigit())[-10:]


def format_mobile(ten: str) -> str:
    return f"+91 {ten[:5]} {ten[5:]}"
