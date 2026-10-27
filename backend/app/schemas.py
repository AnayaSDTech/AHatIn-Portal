"""Request bodies. Validation mirrors the frontend forms so the same messages appear either way."""

import re
from datetime import date
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from app.domain import APP_LABELS, DEPARTURE_TASKS, DOC_CATEGORIES, SCHOLARSHIP_STATUSES, SESSION_TYPES, STAGES

NAME_RE = re.compile(r"^[^\W\d_](?:[^\W\d_]|[ .'-])*$", re.UNICODE)
HHMM_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


class Body(BaseModel):
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)


def clean_name(v: str) -> str:
    v = " ".join(v.split())
    if len(v) < 2:
        raise ValueError("Enter your full name.")
    if len(v) > 100:
        raise ValueError("Name is too long.")
    if not NAME_RE.match(v):
        raise ValueError("Use letters, spaces, dots, apostrophes or hyphens only.")
    return v


def clean_mobile(v: str) -> str:
    """Returns the 10-digit Indian mobile number (country code or trunk zero removed)."""
    digits = re.sub(r"[\s()-]", "", v)
    if re.fullmatch(r"\+91\d{10}", digits):
        digits = digits[3:]
    elif re.fullmatch(r"91\d{10}", digits):
        digits = digits[2:]
    elif re.fullmatch(r"0\d{10}", digits):
        digits = digits[1:]
    if not re.fullmatch(r"[6-9]\d{9}", digits):
        raise ValueError("Enter a valid 10-digit Indian mobile number.")
    return digits


def check_date(v: str, message: str = "Enter a valid date.") -> str:
    if not DATE_RE.match(v):
        raise ValueError(message)
    try:
        date.fromisoformat(v)
    except ValueError:
        raise ValueError(message) from None
    return v


def check_time(v: str) -> str:
    if not HHMM_RE.match(v):
        raise ValueError("Enter a time as HH:MM.")
    return v


Name = Annotated[str, AfterValidator(clean_name)]
Mobile = Annotated[str, AfterValidator(clean_mobile)]
Time = Annotated[str, AfterValidator(check_time)]
SlotDate = Annotated[str, AfterValidator(lambda v: check_date(v, "Choose a date and a free time slot."))]
NewDate = Annotated[str, AfterValidator(lambda v: check_date(v, "Choose a new date and time."))]
AnyDate = Annotated[str, AfterValidator(lambda v: check_date(v, "Choose a date."))]
UntilDate = Annotated[str, AfterValidator(lambda v: check_date(v, "Choose an end date."))]
EndDate = Annotated[str, AfterValidator(lambda v: check_date(v, "Choose the agreement end date."))]


# ---------------------------------------------------------------- auth


class EmailBody(Body):
    email: EmailStr = Field(max_length=254)

    @field_validator("email")
    @classmethod
    def lower(cls, v: str) -> str:
        return v.lower()


class RegisterBody(EmailBody):
    name: Name
    mobile: Mobile
    # Not asked at registration; the student adds them in their profile (or the counsellor agrees them later).
    destination: str | None = None
    intake: str | None = None
    consent: bool

    @field_validator("consent")
    @classmethod
    def consented(cls, v: bool) -> bool:
        if not v:
            raise ValueError("Please accept to continue.")
        return v


class OtpVerifyBody(EmailBody):
    code: str = Field(pattern=r"^\d{6}$")


class StaffLoginBody(EmailBody):
    password: str = Field(min_length=1, max_length=200)


class StaffVerifyBody(Body):
    challenge_id: str = Field(min_length=1, max_length=100)
    code: str = Field(pattern=r"^\d{6}$")


class InviteCompleteBody(Body):
    password: str = Field(min_length=10, max_length=200)
    code: str = Field(pattern=r"^\d{6}$")

    @field_validator("password")
    @classmethod
    def strong(cls, v: str) -> str:
        if not (re.search(r"[A-Za-z]", v) and re.search(r"\d", v)):
            raise ValueError("Use at least 10 characters, with letters and numbers.")
        return v


# ---------------------------------------------------------------- public


class EnquiryBody(EmailBody):
    name: Name
    mobile: Mobile
    destination: str = Field(min_length=1)
    intake: str = Field(min_length=1)
    course: str = Field(default="", max_length=100)
    callTime: str = Field(default="", max_length=60)
    message: str = Field(default="", max_length=500)
    consent: bool
    website: str = ""


    @field_validator("consent")
    @classmethod
    def consented(cls, v: bool) -> bool:
        if not v:
            raise ValueError("Please agree so we can contact you.")
        return v


# ---------------------------------------------------------------- student profile

SCORE_RANGES = {"IELTS": (0, 9, 0.5), "PTE": (10, 90, 1), "TOEFL": (0, 120, 1), "Duolingo": (10, 160, 1)}


class ProfileBody(Body):
    dateOfBirth: str
    city: str = Field(min_length=2, max_length=60)
    degree: str = Field(min_length=2, max_length=100)
    institution: str = Field(min_length=2, max_length=100)
    grade: str = Field(min_length=1, max_length=30)
    englishTest: str = Field(min_length=1)
    englishScore: str = ""
    workExperience: str = Field(default="", max_length=60)
    courseInterest: str = Field(min_length=2, max_length=100)
    destination: str = Field(min_length=1, max_length=60)
    intake: str = Field(min_length=1, max_length=60)
    budget: str = Field(min_length=1, max_length=60)

    @field_validator("dateOfBirth")
    @classmethod
    def dob(cls, v: str) -> str:
        check_date(v, "Enter your date of birth.")
        d = date.fromisoformat(v)
        t = date.today()
        age = t.year - d.year - ((t.month, t.day) < (d.month, d.day))
        if not 14 <= age <= 60:
            raise ValueError("Age must be between 14 and 60.")
        return v

    @model_validator(mode="after")
    def score(self):
        rng = SCORE_RANGES.get(self.englishTest)
        if rng:
            lo, hi, step = rng
            try:
                n = float(self.englishScore)
            except ValueError:
                n = None
            if n is None or not lo <= n <= hi or (n / step) != int(n / step):
                steps = f" in steps of {step}" if step != 1 else ""
                raise ValueError(f"Enter a {self.englishTest} score between {lo} and {hi}{steps}.")
        return self


# ---------------------------------------------------------------- staff: students and journey


class TextBody(Body):
    text: str = Field(min_length=1, max_length=2000)


class ReassignBody(Body):
    counsellorId: str = Field(min_length=1)
    reason: str = Field(min_length=5, max_length=500)


class AssignBody(Body):
    """The admin's first choice of counsellor for a student (the reason is optional)."""

    counsellorId: str = Field(min_length=1)
    reason: str = Field(default="", max_length=500)


class AssignOfficerBody(Body):
    """The admin's choice of Financial Aid Officer (kind "finance") or Visa Officer (kind "visa")."""

    kind: Literal["finance", "visa"]
    officerId: str = Field(min_length=1)
    reason: str = Field(default="", max_length=500)


class CountryExperience(Body):
    country: str = Field(min_length=1, max_length=60)
    years: int = Field(ge=0, le=50)


class MatchingProfileBody(Body):
    """What the admin records about a counsellor for matching. Not shown to students."""

    countries: list[CountryExperience] = Field(default_factory=list, max_length=10)
    universities: list[Annotated[str, Field(min_length=2, max_length=120)]] = Field(default_factory=list, max_length=10)
    subjects: list[str] = Field(default_factory=list, max_length=10)
    languages: list[Annotated[str, Field(min_length=2, max_length=40)]] = Field(default_factory=list, max_length=10)
    capacity: int = Field(default=40, ge=1, le=500)

    @field_validator("countries")
    @classmethod
    def distinct_countries(cls, v: list[CountryExperience]) -> list[CountryExperience]:
        if len({c.country for c in v}) != len(v):
            raise ValueError("List each country once.")
        return v

    @field_validator("subjects")
    @classmethod
    def known_subjects(cls, v: list[str]) -> list[str]:
        from app.career import DIRECTIONS_BY_KEY

        if any(s not in DIRECTIONS_BY_KEY for s in v):
            raise ValueError("Choose subject areas from the list.")
        return list(dict.fromkeys(v))


class CareerPlanBody(Body):
    """The agreed career plan: structured choices (see app/career.py) and optional notes."""

    direction: str
    course: str
    level: str
    destinations: list[str] = Field(min_length=1, max_length=6)
    notes: str = Field(default="", max_length=1000)

    @model_validator(mode="after")
    def known_choices(self):
        from app.career import DIRECTIONS_BY_KEY, LEVELS_BY_KEY, OTHER_COURSE, STUDY_DESTINATIONS

        direction = DIRECTIONS_BY_KEY.get(self.direction)
        if not direction:
            raise ValueError("Choose a career direction.")
        if self.course != OTHER_COURSE and self.course not in direction["courses"]:
            raise ValueError("Choose a course for this career direction.")
        if self.level not in LEVELS_BY_KEY:
            raise ValueError("Choose a study level.")
        if any(d not in STUDY_DESTINATIONS for d in self.destinations):
            raise ValueError("Choose study destinations from the list.")
        self.destinations = list(dict.fromkeys(self.destinations))  # no duplicates, order kept
        if self.course == OTHER_COURSE and len(self.notes) < 3:
            raise ValueError("Describe the course in the notes when choosing “Other”.")
        return self


class ShortlistItemBody(Body):
    university: str = Field(min_length=2, max_length=150)
    course: str = Field(min_length=2, max_length=150)
    country: str = Field(min_length=2, max_length=60)
    intake: str = Field(min_length=1, max_length=60)
    tuition: str = Field(default="", max_length=60)
    livingCost: str = Field(default="", max_length=60)
    deadline: str = ""
    agency: str = Field(min_length=1, max_length=100)
    earnsCommission: bool = False
    reason: str = Field(min_length=3, max_length=500)

    @field_validator("deadline")
    @classmethod
    def deadline_ok(cls, v: str) -> str:
        return check_date(v, "Choose a valid deadline.") if v else v


class ChoiceBody(Body):
    choice: Literal["apply", "removed"] | None = None
    reason: str | None = Field(default=None, max_length=300)

    @model_validator(mode="after")
    def reason_for_removal(self):
        if self.choice == "removed" and len((self.reason or "").strip()) < 3:
            raise ValueError("Tell your counsellor why you're removing this option.")
        return self


class ApproveBody(Body):
    summary: str = Field(default="", max_length=500)


class AppStatusBody(Body):
    to: str

    @field_validator("to")
    @classmethod
    def known(cls, v: str) -> str:
        if v not in APP_LABELS:
            raise ValueError("Unknown status.")
        return v


class AppCorrectBody(AppStatusBody):
    reason: str = Field(min_length=5, max_length=500)


class DecisionBody(Body):
    accept: bool


class CostBody(Body):
    lakh: float = Field(gt=0, lt=500)


class FundingSourceBody(Body):
    kind: str = Field(min_length=1, max_length=40)
    amount: float = Field(gt=0, lt=1000)


class ScholarshipBody(Body):
    name: str = Field(min_length=3, max_length=150)
    amount: str = Field(default="", max_length=40)
    deadline: str = ""

    @field_validator("deadline")
    @classmethod
    def deadline_ok(cls, v: str) -> str:
        return check_date(v, "Choose a valid deadline.") if v else v


class ScholarshipStatusBody(Body):
    status: str

    @field_validator("status")
    @classmethod
    def known(cls, v: str) -> str:
        if v not in SCHOLARSHIP_STATUSES:
            raise ValueError("Unknown status.")
        return v


class DocumentRequestBody(Body):
    name: str = Field(min_length=3, max_length=150)
    category: str = "general"

    @field_validator("category")
    @classmethod
    def known(cls, v: str) -> str:
        if v not in DOC_CATEGORIES:
            raise ValueError("Unknown category.")
        return v


class RejectBody(Body):
    reason: str = Field(min_length=5, max_length=500)


class UploadUrlBody(Body):
    fileName: str = Field(min_length=1, max_length=200)
    contentType: str
    size: int = Field(gt=0)


class UploadCompleteBody(Body):
    uploadId: str = Field(min_length=1)


class VisaBody(Body):
    stage: Literal["cas_received", "documents_verified", "fees_paid", "submitted", "biometrics", "granted", "refused"]
    note: str | None = Field(default=None, max_length=500)
    reference: str | None = Field(default=None, max_length=60)

    @model_validator(mode="after")
    def refusal_reason(self):
        if self.stage == "refused" and len((self.note or "").strip()) < 5:
            raise ValueError("Give the refusal reason (at least 5 characters).")
        return self


class DepartureTaskBody(Body):
    done: bool


class FinalCheckInBody(Body):
    note: str = Field(min_length=5, max_length=1000)


class OverrideBody(Body):
    status: Literal["not_started", "in_progress", "completed", "not_needed"] | None = None
    reason: str = Field(min_length=5, max_length=500)


# ---------------------------------------------------------------- scheduling


class SessionBody(Body):
    studentId: str | None = None  # staff only (students always book for themselves)
    counsellorId: str | None = None  # staff only
    type: str
    date: SlotDate
    time: Time
    mode: Literal["online", "office"]
    studentNote: str | None = Field(default=None, max_length=300)


    @field_validator("type")
    @classmethod
    def known(cls, v: str) -> str:
        if v not in SESSION_TYPES:
            raise ValueError("Choose what the session is about.")
        return v


class CancelBody(Body):
    reason: str | None = Field(default=None, max_length=1000)


class RescheduleBody(Body):
    date: NewDate
    time: Time
    mode: Literal["online", "office"]
    reason: str = Field(min_length=5, max_length=1000)



class CompleteBody(Body):
    notes: str = Field(min_length=5, max_length=1000)
    careerPlan: CareerPlanBody | None = None
    finalCheckIn: bool = False


class NoShowBody(Body):
    note: str | None = Field(default=None, max_length=1000)


class TimeBlock(Body):
    start: Time
    end: Time
    mode: Literal["both", "online", "office"]



class AvailabilityBody(Body):
    weekly: dict[str, list[TimeBlock]]
    slotMinutes: Literal[30, 45, 60]
    bufferMinutes: Literal[0, 10, 15, 30]
    minNoticeHours: Literal[0, 4, 12, 24, 48]
    horizonDays: Literal[7, 14, 21, 30]


class TimeOffBody(Body):
    counsellorId: str | None = None
    date: AnyDate
    start: str | None = None
    end: str | None = None
    reason: str = Field(min_length=3, max_length=200)


    @model_validator(mode="after")
    def times(self):
        if (self.start is None) != (self.end is None):
            raise ValueError("Give both a start and an end time, or neither for the whole day.")
        if self.start and self.end:
            check_time(self.start)
            check_time(self.end)
            if self.end <= self.start:
                raise ValueError("End time must be after start time.")
        return self


# ---------------------------------------------------------------- messages, leads, follow-ups


Thread = Literal["counsellor", "finance", "visa"]


class MessageBody(Body):
    studentId: str | None = None  # staff only
    text: str = Field(min_length=1, max_length=1000)
    # Which chat: with the counsellor, the Financial Aid Officer or the Visa Officer. Officers always write in their own.
    thread: Thread = "counsellor"


class ReadBody(Body):
    studentId: str | None = None  # staff only
    thread: Thread = "counsellor"


class ContactBody(Body):
    channel: Literal["Call", "WhatsApp", "Email", "Meeting"]
    outcome: Literal["Reached", "No answer", "Call back later", "Wrong number", "Not interested"]
    notes: str | None = Field(default=None, max_length=1000)


class LeadStageBody(Body):
    stage: str
    reason: str | None = Field(default=None, max_length=500)

    @field_validator("stage")
    @classmethod
    def lead_stage(cls, v: str) -> str:
        if v not in STAGES[:4]:
            raise ValueError("Choose a lead stage.")
        return v


# ---------------------------------------------------------------- admin


class StaffUserBody(EmailBody):
    name: Name
    role: Literal["counsellor", "officer", "finance_officer", "visa_officer", "admin"]
    phone: str = Field(default="", max_length=30)
    meetingLink: str = Field(default="", max_length=300)



class GrantBody(Body):
    granteeId: str = Field(min_length=1)
    ownerId: str = Field(min_length=1)
    until: UntilDate
    reason: str = Field(min_length=5, max_length=300)



class AgencyBody(Body):
    name: str = Field(min_length=2, max_length=120)
    type: Literal["Aggregator", "Master agent", "Direct"]
    countries: str = Field(min_length=2, max_length=200)
    commissionShare: str = Field(min_length=1, max_length=10)
    agreementEnd: EndDate
    status: Literal["Active", "Inactive"] = "Active"



DEPARTURE_KEYS = set(DEPARTURE_TASKS)
