"""Which students and leads a staff member may see.

- admin: everything.
- officer (Application officer): all students (documents, applications, visa); no leads.
- finance_officer / visa_officer: only the students the admin assigned to them; no leads.
- counsellor: own records, plus those of counsellors they cover for (an active, unrevoked grant).
Records outside the scope are reported as "not found".
"""

from dataclasses import dataclass

from app.core.clock import today_iso
from app.core.errors import not_found
from app.db import get_db
from app.domain import AREA_OF_ROLE, OFFICER_FIELD


@dataclass
class Scope:
    user: dict
    all_students: bool
    all_leads: bool
    owner_ids: list[str]  # counsellors whose records are visible (own + covered); an officer's own id
    covering: list[dict]  # active grants where the user is the grantee
    officer_field: str | None = None  # financeOfficerId / visaOfficerId for specialist officers

    @property
    def is_admin(self) -> bool:
        return self.user["role"] == "admin"

    def student_filter(self) -> dict:
        if self.all_students:
            return {}
        if self.officer_field:
            return {self.officer_field: self.user["_id"]}
        return {"counsellorId": {"$in": self.owner_ids}}

    def lead_filter(self) -> dict:
        if self.all_leads:
            return {}
        if self.user["role"] != "counsellor":
            return {"_id": None}  # officers don't work on leads
        return {"counsellorId": {"$in": self.owner_ids}}

    def can_see_student(self, student: dict) -> bool:
        if self.all_students:
            return True
        if self.officer_field:
            return student.get(self.officer_field) == self.user["_id"]
        return student.get("counsellorId") in self.owner_ids


def active_grant_filter() -> dict:
    return {"revoked": {"$ne": True}, "until": {"$gte": today_iso()}}


async def scope_for(user: dict) -> Scope:
    role = user["role"]
    if role == "admin":
        return Scope(user, True, True, [], [])
    if role in AREA_OF_ROLE:
        return Scope(user, False, False, [user["_id"]], [], OFFICER_FIELD[AREA_OF_ROLE[role]])
    covering = await get_db().access_grants.find({"granteeId": user["_id"], **active_grant_filter()}).to_list(None)
    owners = [user["_id"], *[g["ownerId"] for g in covering]]
    return Scope(user, role == "officer", False, owners, covering)


async def visible_student(user: dict, student_id: str) -> dict:
    student = await get_db().students.find_one({"_id": student_id})
    if not student:
        raise not_found("Student not found.")
    scope = await scope_for(user)
    if not scope.can_see_student(student):
        raise not_found("Student not found.")
    return student


async def visible_lead(user: dict, lead_id: str) -> dict:
    lead = await get_db().leads.find_one({"_id": lead_id})
    scope = await scope_for(user)
    if not lead or not (scope.all_leads or (user["role"] == "counsellor" and lead["counsellorId"] in scope.owner_ids)):
        raise not_found("Lead not found.")
    return lead
