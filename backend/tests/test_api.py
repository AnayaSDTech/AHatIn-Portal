"""End-to-end API tests against a real MongoDB (database ahat_test)."""

import os
from datetime import timedelta
from pathlib import Path

from app.config import get_settings
from app.core.clock import now, today
from app.core.security import hash_password
from app.course_catalog import parse_csv
from app.db import get_db
from app.scholarship_catalog import load_csv
from app.services.scheduling import slots_for, working_dates


async def test_student_login_and_record(make_api):
    api = await make_api()
    assert (await api.get("/auth/me")).status_code == 401
    user = await api.student_login()
    assert user["name"] == "Ananya Sharma" and user["studentReference"] == "AH-2026-00042"
    r = await api.get("/me/record")
    body = r.json()
    assert body["record"]["id"] == "s1"
    assert body["profile"]["passportNumber"] == "Z1234567"
    assert body["counsellor"]["meetingLink"] == "https://meet.google.com/juz-bodt-wbd"
    assert [d["id"] for d in body["record"]["documents"]][:3] == ["d1", "d2", "d3"]
    # Only their own record.
    assert len((await api.get("/students")).json()) == 1
    assert (await api.get("/students/s2")).status_code == 404


async def test_student_password_login(make_api):
    api = await make_api()
    r = await api.post("/auth/login", {"email": "demo.student@ahatin.example", "password": "wrong-password1"})
    assert r.status_code == 401 and "Forgot password" in r.json()["detail"]
    r = await api.post("/auth/login", {"email": "nobody@example.com", "password": "Student@1234"})
    assert r.status_code == 401
    # Staff can't use the student login.
    assert (await api.post("/auth/login", {"email": "demo.counsellor@ahatin.example", "password": "Staff@1234"})).status_code == 401
    # The old one-time-code login is gone.
    assert (await api.post("/auth/otp/request", {"email": "demo.student@ahatin.example"})).status_code in (404, 405)
    user = await api.student_login()
    assert user["role"] == "student"


async def test_registration_needs_the_emailed_code(make_api):
    db = get_db()
    api = await make_api()
    r = await api.post("/auth/register", {"name": "Kabir Shah", "email": "kabir@ahatin.example", "mobile": "9811155555", "password": "Kabir2027x", "consent": True})
    assert r.status_code == 200 and len(r.json()["demoCode"]) == 6
    assert (await api.get("/auth/me")).status_code == 401  # not signed in until the email is verified
    # A wrong code counts an attempt; asking again too soon is refused.
    r = await api.post("/auth/verify-email", {"email": "kabir@ahatin.example", "code": "000000"})
    assert r.status_code == 400 and "4 attempts left" in r.json()["detail"]
    assert (await api.post("/auth/verify-email/resend", {"email": "kabir@ahatin.example"})).status_code == 429
    # Logging in before verifying sends a fresh code instead of signing in.
    await db.otp_codes.update_many({}, {"$set": {"sentAt": (await db.otp_codes.find_one({}))["sentAt"] - timedelta(minutes=5)}})
    r = await api.post("/auth/login", {"email": "kabir@ahatin.example", "password": "Kabir2027x"})
    assert r.status_code == 200 and "user" not in r.json() and r.json()["verifyEmail"]["demoCode"]
    r = await api.post("/auth/verify-email", {"email": "kabir@ahatin.example", "code": r.json()["verifyEmail"]["demoCode"]})
    assert r.status_code == 200 and r.json()["user"]["name"] == "Kabir Shah"
    assert (await db.users.find_one({"email": "kabir@ahatin.example"}))["emailVerifiedAt"]
    # A code works once.
    assert (await api.post("/auth/verify-email", {"email": "kabir@ahatin.example", "code": "123456"})).status_code == 400
    other = await make_api()
    assert (await other.student_login("kabir@ahatin.example", "Kabir2027x"))["name"] == "Kabir Shah"


async def test_forgot_and_change_password(make_api):
    db = get_db()
    # Unknown emails and staff get the same answer, with no code.
    api = await make_api()
    r = await api.post("/auth/password/forgot", {"email": "nobody@example.com"})
    assert r.status_code == 200 and "demoCode" not in r.json() and r.json()["expiresIn"] == 600
    r = await api.post("/auth/password/forgot", {"email": "demo.counsellor@ahatin.example"})
    assert r.status_code == 200 and "demoCode" not in r.json()

    # Signed in on another device, then the password is reset: that sign-in ends.
    phone = await make_api()
    await phone.student_login()
    r = await api.post("/auth/password/forgot", {"email": "demo.student@ahatin.example"})
    code = r.json()["demoCode"]
    assert (await api.post("/auth/password/reset", {"email": "demo.student@ahatin.example", "code": code, "password": "short"})).status_code == 422
    assert (await api.post("/auth/password/reset", {"email": "demo.student@ahatin.example", "code": "000000", "password": "NewPass2027"})).status_code == 400
    r = await api.post("/auth/password/reset", {"email": "demo.student@ahatin.example", "code": code, "password": "NewPass2027"})
    assert r.status_code == 200 and r.json()["user"]["name"] == "Ananya Sharma"
    assert (await api.get("/auth/me")).status_code == 200
    assert (await phone.get("/auth/me")).status_code == 401
    assert (await (await make_api()).post("/auth/login", {"email": "demo.student@ahatin.example", "password": "Student@1234"})).status_code == 401
    # A reset code can't be used to verify an email, and vice versa.
    r = await api.post("/auth/password/forgot", {"email": "demo.student@ahatin.example"})
    assert (await api.post("/auth/verify-email", {"email": "demo.student@ahatin.example", "code": r.json()["demoCode"]})).status_code == 400

    # Change password while signed in: the current one is needed; other sign-ins end, this one stays.
    laptop = await make_api()
    await laptop.student_login(password="NewPass2027")
    r = await api.post("/auth/password/change", {"currentPassword": "wrong-one1", "newPassword": "Another2027"})
    assert r.status_code == 400 and r.json()["errors"][0]["field"] == "currentPassword"
    assert (await api.post("/auth/password/change", {"currentPassword": "NewPass2027", "newPassword": "Another2027"})).status_code == 204
    assert (await api.get("/auth/me")).status_code == 200 and (await laptop.get("/auth/me")).status_code == 401
    assert (await (await make_api()).student_login(password="Another2027"))["name"] == "Ananya Sharma"
    # The student is told by email each time (reset, then change).
    assert await db.notifications.count_documents({"to": "demo.student@ahatin.example", "subject": "Your AHat password was changed"}) == 2
    # Staff can't change their password here.
    staff = await make_api()
    await staff.staff_login()
    assert (await staff.post("/auth/password/change", {"currentPassword": "Staff@1234", "newPassword": "Another2027"})).status_code == 403


async def test_csrf_required(make_api):
    api = await make_api()
    await api.student_login()
    r = await api.c.post("/api/v1/messages", json={"text": "hi"})  # no CSRF header
    assert r.status_code == 403


async def test_register_creates_record_without_counsellor(make_api):
    api = await make_api()
    await api.register_student("Riya Kapoor", "riya@example.com", "+919812345678")
    rec = (await api.get("/me/record")).json()["record"]
    assert rec["destination"] == "Not decided" and rec["intake"] == "To be decided"  # not asked at registration
    assert rec["counsellorId"] is None  # the admin assigns one once the profile is complete
    assert len(rec["documents"]) == 4 and rec["reference"].startswith("AH-")
    r = await api.post("/auth/register", {"name": "Riya Kapoor", "email": "riya@example.com", "mobile": "9812345678", "password": "Welcome123", "consent": True})
    assert r.status_code == 409


async def test_register_validation(make_api):
    api = await make_api()
    r = await api.post("/auth/register", {"name": "R", "email": "bad", "mobile": "12345", "password": "short", "consent": False})
    assert r.status_code == 422
    fields = {e["field"] for e in r.json()["errors"]}
    assert {"name", "email", "mobile", "password", "consent"} <= fields
    r = await api.post("/auth/register", {"name": "Riya Kapoor", "email": "riya@example.com", "mobile": "9812345678", "password": "onlyletters", "consent": True})
    assert r.status_code == 422 and r.json()["errors"][0]["field"] == "password"


async def test_staff_login_scope_and_covering(make_api):
    api = await make_api()
    with_bad = await api.post("/auth/staff/login", {"email": "demo.counsellor@ahatin.example", "password": "wrong"})
    assert with_bad.status_code == 401
    user = await api.staff_login()
    assert user["role"] == "counsellor"
    students = {s["id"] for s in (await api.get("/students")).json()}
    # Priya's own students plus Rohan's (she is covering for him).
    assert {"s1", "s2", "s4", "s9", "s3", "s6", "s8"} == students
    assert (await api.get("/students/s5")).status_code == 404  # Neha's student
    scope = (await api.get("/staff/scope")).json()
    assert scope["myId"] == "c1" and scope["covering"][0]["ownerId"] == "c2"
    leads = {lead["id"] for lead in (await api.get("/leads")).json()}
    assert "l6" not in leads and "l2" in leads and "l1" not in leads  # l1 is a new website enquiry: the admin's


async def test_student_cannot_use_staff_actions(make_api):
    api = await make_api()
    await api.student_login()
    r = await api.post("/students/s1/documents/d5/verify")
    assert r.status_code == 403
    r = await api.post("/students/s1/applications/a2/status", {"to": "interview"})
    assert r.status_code == 403


async def test_document_upload_review_cycle(make_api, bucket):
    student = await make_api()
    await student.student_login()
    pdf = b"%PDF-1.4 sample cv" + b"." * (60 * 1024)  # within 1-300 KB
    r = await student.post("/students/s1/documents/d8/upload-url", {"fileName": "cv.pdf", "contentType": "application/pdf", "size": len(pdf)})
    assert r.status_code == 200, r.text
    up = r.json()
    assert up["method"] == "PUT" and up["headers"]["Content-Type"] == "application/pdf"
    bucket.put_url(up["url"], pdf)  # the browser uploads straight to the bucket
    r = await student.post("/students/s1/documents/d8/upload-complete", {"uploadId": up["uploadId"]})
    assert r.status_code == 200, r.text
    d8 = next(d for d in r.json()["documents"] if d["id"] == "d8")
    assert d8["state"] == "pending" and d8["fileName"] == "cv.pdf"
    assert r.json()["notes"][0]["text"] == "Uploaded “cv.pdf” for Updated CV."
    assert await get_db().follow_ups.find_one({"personId": "s1", "action": "Verify uploaded document: Updated CV", "done": False})

    staff = await make_api()
    await staff.staff_login()
    url = (await staff.get("/students/s1/documents/d8/download-url")).json()["url"]
    assert bucket.get_url(url) == pdf
    other = await make_api()
    await other.staff_login("demo.admin@ahatin.example", "Admin@1234")
    r = await other.post("/students/s1/documents/d8/reject", {"reason": "Please add your latest job"})
    assert r.status_code == 400 and "Open the document" in r.json()["detail"]  # only someone who has opened it
    r = await staff.post("/students/s1/documents/d8/reject", {"reason": "Please add your latest job"})
    assert r.status_code == 200
    assert not await get_db().follow_ups.find_one({"personId": "s1", "action": "Verify uploaded document: Updated CV", "done": False})


async def test_upload_rejects_fake_pdf(make_api, bucket):
    api = await make_api()
    await api.student_login()
    fake = b"MZ\x90\x00\x03" + bytes(60 * 1024)
    up = (await api.post("/students/s1/documents/d8/upload-url", {"fileName": "x.pdf", "contentType": "application/pdf", "size": len(fake)})).json()
    bucket.put_url(up["url"], fake)
    r = await api.post("/students/s1/documents/d8/upload-complete", {"uploadId": up["uploadId"]})
    assert r.status_code == 400
    assert bucket.key(up["url"]) not in bucket.objects  # the fake file is deleted


async def test_shortlist_approval_creates_applications(make_api):
    student = await make_api()
    await student.student_login("demo.student@ahatin.example")
    staff = await make_api()
    await staff.staff_login()
    # Rohan's student Fatima (s3) has a shared shortlist; Priya covers for Rohan.
    r = await staff.post("/students/s3/notes", {"text": "Covering note"})
    assert r.status_code == 200
    # Ananya can't touch Fatima's shortlist.
    assert (await student.put("/students/s3/shortlist/items/sl8/choice", {"choice": "apply"})).status_code == 404

    fatima_user = {"_id": "fatima-user", "role": "student", "name": "Fatima Sheikh", "email": "fatima.s@example.com", "mobile": "+919811130003", "status": "active", "emailVerifiedAt": "x", "passwordHash": hash_password("Student@1234")}
    await get_db().users.insert_one(fatima_user)
    await get_db().students.update_one({"_id": "s3"}, {"$set": {"userId": "fatima-user"}})
    fatima = await make_api()
    await fatima.student_login("fatima.s@example.com")
    assert (await fatima.post("/students/s3/shortlist/approve", {})).status_code == 400  # undecided options
    await fatima.put("/students/s3/shortlist/items/sl8/choice", {"choice": "apply"})
    r = await fatima.put("/students/s3/shortlist/items/sl9/choice", {"choice": "removed"})
    assert r.status_code == 422  # a reason is required
    await fatima.put("/students/s3/shortlist/items/sl9/choice", {"choice": "removed", "reason": "Too far from Dublin"})
    r = await fatima.post("/students/s3/shortlist/approve", {})
    assert r.status_code == 200, r.text
    rec = r.json()
    assert [a["university"] for a in rec["applications"]] == ["University College Dublin"]
    assert rec["journey"]["shortlist"]["status"] == "approved"
    assert rec["notes"][0]["text"] == "Approved the shortlist. Apply to: University College Dublin. Removed: Demo University of Galway (Too far from Dublin)."


async def test_application_rules(make_api):
    staff = await make_api()
    await staff.staff_login()
    assert (await staff.post("/students/s1/applications/a1/status", {"to": "accepted"})).status_code == 403
    assert (await staff.post("/students/s1/applications/a4/status", {"to": "interview"})).status_code == 400
    r = await staff.post("/students/s1/applications/a4/status", {"to": "submitted"})
    assert r.status_code == 200
    assert r.json()["notes"][0]["text"] == "University of Leeds: Draft → Submitted."
    r = await staff.post("/students/s1/applications/a4/correct", {"to": "draft", "reason": "Chose the wrong one"})
    assert r.status_code == 200 and next(a for a in r.json()["applications"] if a["id"] == "a4")["state"] == "draft"

    student = await make_api()
    await student.student_login()
    r = await student.post("/students/s1/applications/a1/decision", {"accept": True})
    assert r.status_code == 200 and r.json()["stage"] == "offer_accepted"
    assert (await staff.post("/students/s1/applications/a1/correct", {"to": "rejected", "reason": "Mistake made"})).status_code == 403


async def _free_slot(counsellor_id: str):
    db = get_db()
    av = await db.availability.find_one({"counsellorId": counsellor_id})
    sessions = await db.sessions.find({"counsellorId": counsellor_id}).to_list(None)
    off = await db.time_off.find({"counsellorId": counsellor_id}).to_list(None)
    for d in working_dates(av):
        for s in slots_for(av, d, sessions, off):
            if s["status"] == "free":
                return d, s
    raise AssertionError("no free slot")


async def test_booking_rules(make_api):
    student = await make_api()
    await student.student_login("new.student@ahatin.example")
    d, slot = await _free_slot("c1")
    r = await student.post("/sessions", {"type": "Career counselling", "date": d, "time": slot["time"], "mode": slot["modes"][0], "studentNote": "Hello"})
    assert r.status_code == 403  # profile not complete yet
    assert (await student.put("/me/profile", PROFILE)).status_code == 200
    r = await student.post("/sessions", {"type": "Career counselling", "date": d, "time": slot["time"], "mode": slot["modes"][0], "studentNote": "Hello"})
    assert r.status_code == 200, r.text
    booked = r.json()
    assert booked["bookedBy"] == "student" and booked["durationMinutes"] == 45
    # The same slot can't be booked twice.
    other = await make_api()
    await other.student_login()
    r = await other.post("/sessions", {"type": "Application review", "date": d, "time": slot["time"], "mode": slot["modes"][0]})
    assert r.status_code == 409
    # Students see others' bookings only as busy times.
    mine = (await other.get("/sessions")).json()
    busy = next(s for s in mine if s["id"] == f"busy-{booked['id']}")
    assert busy["studentId"] == "" and busy["type"] == ""
    # Too-soon slots are refused for students.
    r = await student.post("/sessions", {"type": "Career counselling", "date": today().isoformat(), "time": "10:00", "mode": "online"})
    assert r.status_code == 400
    r = await student.post(f"/sessions/{booked['id']}/cancel", {})
    assert r.status_code == 200 and r.json()["cancelReason"] == "Cancelled by the student"


async def test_complete_session_records_career_plan(make_api):
    staff = await make_api()
    await staff.staff_login()
    # ss8: Aarav's career counselling today at 17:00; move it to the past so it can be completed.
    await get_db().sessions.update_one({"_id": "ss8"}, {"$set": {"date": (today() - timedelta(days=1)).isoformat()}})
    plan = {"direction": "computing", "course": "Data Science & Analytics", "level": "masters", "destinations": ["United Kingdom", "Ireland"], "notes": ""}
    r = await staff.post("/sessions/ss8/complete", {"notes": "Discussed options", "careerPlan": plan})
    assert r.status_code == 200, r.text
    rec = (await staff.get("/students/s9")).json()
    saved = rec["journey"]["careerPlan"]
    assert saved["summary"] == "Data Science & Analytics (Master's) · United Kingdom, Ireland"
    assert saved["direction"] == "computing" and saved["destinations"] == ["United Kingdom", "Ireland"]
    assert rec["notes"][0]["text"] == "Career plan shared: Data Science & Analytics (Master's) · United Kingdom, Ireland."
    assert rec["notes"][1]["text"] == "Career counselling session completed: Discussed options"


async def test_messages_and_read_receipts(make_api):
    student = await make_api()
    await student.student_login()
    r = await student.post("/messages", {"text": "Can we talk about funding?"})
    assert r.status_code == 200
    staff = await make_api()
    await staff.staff_login()
    unread = [m for m in (await staff.get("/messages")).json() if m["studentId"] == "s1" and m["from"] == "student" and "readAt" not in m]
    assert len(unread) == 2
    assert (await staff.post("/messages/read", {"studentId": "s1"})).status_code == 204
    unread = [m for m in (await staff.get("/messages")).json() if m["from"] == "student" and "readAt" not in m]
    assert unread == []


async def test_enquiry_dedupes_and_goes_to_admin(make_api):
    api = await make_api()
    body = {"name": "Kabir Shah", "email": "kabir@example.com", "mobile": "9876543210", "destination": "uk", "intake": "2027-09", "course": "MSc AI", "callTime": "", "message": "", "consent": True, "website": ""}
    r = await api.post("/enquiries", body)
    assert r.status_code == 200 and r.json()["kind"] == "new"
    assert r.json()["counsellor"] is None  # handled by the admin
    lead = await get_db().leads.find_one({"email": "kabir@example.com"})
    assert lead["interest"] == "MSc AI · UK · Sep 2027" and lead["score"] == 80 and lead["counsellorId"] is None
    assert await get_db().follow_ups.find_one({"personId": lead["_id"], "counsellorId": None, "done": False})
    r = await api.post("/enquiries", {**body, "email": "other@example.com"})  # same mobile
    assert r.json()["kind"] == "lead"
    r = await api.post("/enquiries", {**body, "email": "demo.student@ahatin.example", "mobile": "9000000001"})
    assert r.json()["kind"] == "student"
    r = await api.post("/enquiries", body)
    assert r.status_code == 429  # 3 per 10 minutes
    spam = await (await make_api()).post("/enquiries", {**body, "website": "http://spam"})
    assert spam.json() == {"kind": "ignored"}


async def test_admin_overview_and_staff(make_api):
    admin = await make_api()
    await admin.staff_login("demo.admin@ahatin.example", "Admin@1234")
    ov = (await admin.get("/admin/overview")).json()
    assert ov["funnel"][0]["stage"] == "Enquiries" and ov["funnel"][0]["count"] >= ov["funnel"][-1]["count"]
    assert {w["name"] for w in ov["counsellorWorkload"]} == {"Priya Desai", "Rohan Kapoor", "Neha Joshi"}
    agencies = (await admin.get("/agencies")).json()
    assert next(a for a in agencies if a["name"] == "Demo Partner Agency A")["applications"] == 64
    r = await admin.post("/admin/staff", {"name": "Asha Rao", "email": "asha@ahat.example", "role": "counsellor"})
    assert r.status_code == 200 and "demoInviteLink" in r.json()
    token = r.json()["demoInviteLink"].rsplit("/", 1)[1]
    invite = (await admin.get(f"/auth/staff/invite/{token}")).json()
    import pyotp

    newbie = await make_api()
    r = await newbie.post(f"/auth/staff/invite/{token}", {"password": "Welcome2027x", "code": pyotp.TOTP(invite["secret"]).now()})
    assert r.status_code == 200 and r.json()["user"]["role"] == "counsellor"
    staff = (await admin.get("/admin/staff")).json()
    asha = next(u for u in staff if u["email"] == "asha@ahat.example")
    r = await admin.post(f"/admin/staff/{asha['id']}/deactivate")
    assert r.status_code == 200
    assert (await newbie.get("/auth/me")).status_code == 401  # signed out everywhere
    # A real person's set-up page and sign-in never show the demo authenticator code.
    assert invite["demo"] is True  # asha@ahat.example is a test address
    r = await admin.post("/admin/staff", {"name": "Real Person", "email": "real.person@gmail.com", "role": "counsellor"})
    real_token = r.json()["demoInviteLink"].rsplit("/", 1)[1]  # no email service in tests, so the link is on screen
    real = (await admin.get(f"/auth/staff/invite/{real_token}")).json()
    assert real["demo"] is False and real["secret"]
    real_api = await make_api()
    assert (await real_api.post(f"/auth/staff/invite/{real_token}", {"password": "Welcome2027x", "code": pyotp.TOTP(real["secret"]).now()})).status_code == 200
    await real_api.post("/auth/logout")
    r = await (await make_api()).post("/auth/staff/login", {"email": "real.person@gmail.com", "password": "Welcome2027x"})
    assert r.status_code == 200 and "demoSecret" not in r.json()
    r = await admin.post("/admin/access-grants", {"granteeId": "c3", "ownerId": "c3", "until": today().isoformat(), "reason": "Annual leave"})
    assert r.status_code == 400


async def test_counsellor_cannot_use_admin(make_api):
    api = await make_api()
    await api.staff_login()
    assert (await api.get("/admin/overview")).status_code == 403
    assert (await api.post("/students/s1/reassign", {"counsellorId": "c2", "reason": "Testing it"})).status_code == 403


async def test_profile_updates_record(make_api):
    api = await make_api()
    await api.student_login("new.student@ahatin.example")
    profile = {
        **{k: v for k, v in PROFILE.items() if k.startswith(("ssc", "hsc", "address", "state", "pincode", "graduation"))},
        "dateOfBirth": "2002-01-05", "city": "Mumbai", "degree": "B.Com", "institution": "Demo College", "grade": "72%", "englishTest": "IELTS", "englishScore": "7",
        "workExperience": "", "courseInterest": "MSc Finance", "destination": "Ireland", "intake": "January 2028",
    }
    r = await api.put("/me/profile", {**profile, "englishScore": "7.3"})
    assert r.status_code == 422
    r = await api.put("/me/profile", profile)
    assert r.status_code == 200
    rec = (await api.get("/me/record")).json()
    assert rec["record"]["goal"] == "MSc Finance" and rec["record"]["destination"] == "Ireland" and rec["profile"]["city"] == "Mumbai"
    assert rec["profile"]["courseInterests"] == ["MSc Finance"]  # an older app sending one course


async def test_profile_courses_gender_mobile_and_optional_grade(make_api):
    db = get_db()
    api = await make_api()
    await api.student_login("new.student@ahatin.example")
    mine = (await api.get("/me/record")).json()
    assert mine["profile"]["mobile"] == mine["record"]["mobile"].replace("+91", "").replace(" ", "")  # from registration
    body = {**PROFILE, "grade": "", "gender": "Female", "mobile": "+91 99887 76655", "courseInterests": ["MSc Data Science", " msc data science ", "MSc Business Analytics"]}
    body.pop("courseInterest")
    r = await api.put("/me/profile", body)
    assert r.status_code == 200, r.text
    mine = (await api.get("/me/record")).json()
    p, rec = mine["profile"], mine["record"]
    assert mine["profileComplete"] is True  # grade and gender are optional
    assert p["courseInterests"] == ["MSc Data Science", "MSc Business Analytics"] and p["courseInterest"] == "MSc Data Science"
    assert rec["goal"] == "MSc Data Science, MSc Business Analytics"
    assert p["gender"] == "Female" and p["mobile"] == "9988776655" and rec["mobile"] == "+91 99887 76655"
    assert (await db.users.find_one({"email": "new.student@ahatin.example"}))["mobile"] == "+919988776655"
    assert (await api.get("/auth/me")).json()["mobile"] == "+919988776655"

    assert (await api.put("/me/profile", {**body, "courseInterests": []})).status_code == 422
    assert (await api.put("/me/profile", {**body, "courseInterests": ["MSc A1", "MSc B2", "MSc C3", "MSc D4"]})).status_code == 422
    assert (await api.put("/me/profile", {**body, "gender": "Unknown"})).status_code == 422
    r = await api.put("/me/profile", {**body, "mobile": "12345"})
    assert r.status_code == 422 and r.json()["errors"][0]["field"] == "mobile"


async def test_career_plan_create_edit_and_validation(make_api):
    staff = await make_api()
    await staff.staff_login()
    options = (await staff.get("/career-options")).json()
    computing = next(d for d in options["directions"] if d["key"] == "computing")
    assert "Cyber Security" in computing["courses"] and computing["courses"][-1] == options["otherCourse"]

    # A course must belong to the chosen direction, and "Other" needs a description.
    bad = {"direction": "health", "course": "Cyber Security", "level": "masters", "destinations": ["Germany"]}
    assert (await staff.post("/students/s9/career-plan", bad)).status_code == 422
    other = {"direction": "health", "course": options["otherCourse"], "level": "masters", "destinations": ["Germany"]}
    assert (await staff.post("/students/s9/career-plan", other)).status_code == 422
    assert (await staff.post("/students/s9/career-plan", {**other, "destinations": []})).status_code == 422

    r = await staff.post("/students/s9/career-plan", {**other, "notes": "Occupational therapy"})
    assert r.status_code == 200, r.text
    first = r.json()["journey"]["careerPlan"]
    assert first["summary"] == "Health & Life Sciences (other course) (Master's) · Germany"

    # Editing keeps when it was first shared and records who changed it.
    edit = {"direction": "computing", "course": "Cyber Security", "level": "bachelors", "destinations": ["Ireland", "Ireland", "Netherlands"], "notes": ""}
    rec = (await staff.post("/students/s9/career-plan", edit)).json()
    plan = rec["journey"]["careerPlan"]
    assert plan["at"] == first["at"] and plan["updatedBy"] == "Priya Desai"
    assert plan["destinations"] == ["Ireland", "Netherlands"] and plan["level"] == "bachelors"
    assert rec["notes"][0]["text"] == "Career plan updated: Cyber Security (Bachelor's) · Ireland, Netherlands."

    # Students can read the options but can't record a plan.
    student = await make_api()
    await student.student_login("new.student@ahatin.example")
    assert (await student.get("/career-options")).status_code == 200
    assert (await student.post("/students/s9/career-plan", edit)).status_code == 403


async def test_shortlist_options(make_api):
    from datetime import date

    from app.universities import upcoming_intakes

    assert upcoming_intakes(date(2026, 10, 27))[:3] == ["January 2027", "April 2027 (summer semester)", "May 2027"]
    assert upcoming_intakes(date(2026, 10, 27))[-1] == "October 2028 (winter semester)"

    staff = await make_api()
    await staff.staff_login()
    opts = (await staff.get("/shortlist-options")).json()
    assert set(opts["universities"]) == {"United Kingdom", "Ireland", "Germany", "France", "Netherlands", "Other in Europe"}
    assert "University of Manchester" in opts["universities"]["United Kingdom"]
    assert all(names[-1] == opts["otherUniversity"] for names in opts["universities"].values())
    assert opts["intakes"]

    student = await make_api()
    await student.student_login()
    assert (await student.get("/shortlist-options")).status_code == 403


async def test_application_updates_seen(make_api):
    student = await make_api()
    await student.student_login()
    before = (await student.get("/me/record")).json()["seen"]["applications"]

    staff = await make_api()
    await staff.staff_login()
    await staff.post("/students/s1/applications/a2/status", {"to": "interview"})

    rec = (await student.get("/me/record")).json()
    change = next(a for a in rec["record"]["applications"] if a["id"] == "a2")["history"][-1]
    assert change["to"] == "interview" and change["at"] > before  # new since the student last looked

    assert (await student.post("/me/seen/applications")).status_code == 204
    after = (await student.get("/me/record")).json()["seen"]["applications"]
    assert after >= change["at"]
    assert (await student.post("/me/seen/other")).status_code == 404
    assert (await staff.post("/me/seen/applications")).status_code == 403


PROFILE = {
    "dateOfBirth": "2001-01-15", "city": "Pune", "addressLine1": "12 MG Road", "state": "Maharashtra", "pincode": "411001",
    "sscBoard": "CBSE", "sscSchool": "Demo School", "sscYear": "2017", "sscScore": "88%",
    "hscBoard": "State Board", "hscStream": "Science (PCM)", "hscCollege": "Demo Junior College", "hscYear": "2019", "hscScore": "82%",
    "graduationYear": "2023", "degree": "B.Tech Computer Science", "institution": "Demo Institute", "grade": "8.1 CGPA",
    "englishTest": "IELTS", "englishScore": "7", "workExperience": "", "courseInterest": "MSc Artificial Intelligence", "destination": "United Kingdom",
    "intake": "September 2027",
}


async def test_profile_gate_and_admin_assignment(make_api, monkeypatch):
    """With automatic assignment off, a student with a complete profile waits for the admin to choose."""
    monkeypatch.setattr(get_settings(), "auto_assign_counsellors", False)
    db = get_db()
    # An earlier website enquiry with the same email is linked when the person registers.
    web = await make_api()
    enquiry = {"name": "Dev Rao", "email": "dev@example.com", "mobile": "9811199999", "destination": "uk", "intake": "2027-09", "course": "MSc AI", "callTime": "", "message": "", "consent": True, "website": ""}
    assert (await web.post("/enquiries", enquiry)).json()["kind"] == "new"

    student = await make_api()
    await student.register_student("Dev Rao", "dev@example.com", "9811199999")
    mine = (await student.get("/me/record")).json()
    sid = mine["record"]["id"]
    assert mine["counsellor"] is None and mine["profileComplete"] is False
    lead = await db.leads.find_one({"email": "dev@example.com"})
    assert lead["stage"] == "registered" and lead["convertedStudentId"] == sid
    assert (await student.get("/counsellors")).json() == []

    # Nothing can start before the profile is complete.
    d, slot = await _free_slot("c1")
    book = {"type": "Career counselling", "date": d, "time": slot["time"], "mode": slot["modes"][0]}
    r = await student.post("/sessions", book)
    assert r.status_code == 403 and "complete your profile" in r.json()["detail"]
    assert (await student.post("/messages", {"text": "Hello"})).status_code == 400

    admin = await make_api()
    await admin.staff_login("demo.admin@ahatin.example", "Admin@1234")
    queue = (await admin.get("/admin/assignments")).json()
    assert sid in {s["id"] for s in queue["incomplete"]} and sid not in {s["id"] for s in queue["waiting"]}
    r = await admin.post(f"/students/{sid}/assign", {"counsellorId": "c1"})
    assert r.status_code == 400  # profile not complete
    assert (await admin.post(f"/students/{sid}/profile-reminder")).status_code == 204

    # Profile complete: the student joins the waiting list, with suggestions ranked on their profile.
    assert (await student.put("/me/profile", PROFILE)).status_code == 200
    assert (await student.get("/me/record")).json()["profileComplete"] is True
    r = await student.post("/sessions", book)
    assert r.status_code == 403 and "counsellor is assigned" in r.json()["detail"]
    queue = (await admin.get("/admin/assignments")).json()
    waiting = next(s for s in queue["waiting"] if s["id"] == sid)
    assert waiting["subject"] == "Computing & IT"
    best = waiting["matches"][0]
    assert best["counsellorId"] == "c1" and best["points"]["country"] > 0 and best["points"]["subject"] == 30  # UK + computing
    assert await db.follow_ups.find_one({"sourceEvent": f"student:{sid}:assign", "done": False, "counsellorId": None})

    # Only the admin assigns.
    counsellor = await make_api()
    await counsellor.staff_login()
    assert (await counsellor.post(f"/students/{sid}/assign", {"counsellorId": "c1"})).status_code == 403
    r = await admin.post(f"/students/{sid}/assign", {"counsellorId": "c1"})
    assert r.status_code == 200 and r.json()["counsellorId"] == "c1"
    assert r.json()["assignmentHistory"][-1]["from"] == ""
    assert not await db.follow_ups.find_one({"sourceEvent": f"student:{sid}:assign", "done": False})
    assert (await admin.post(f"/students/{sid}/assign", {"counsellorId": "c2"})).status_code == 409
    assert sid not in {s["id"] for s in (await admin.get("/admin/assignments")).json()["waiting"]}

    # Now the journey can start.
    mine = (await student.get("/me/record")).json()
    assert mine["counsellor"]["name"] == "Priya Desai"
    r = await student.post("/sessions", book)
    assert r.status_code == 200, r.text

    # Changing study plans later tells the counsellor.
    assert (await student.put("/me/profile", {**PROFILE, "destination": "Ireland"})).status_code == 200
    assert await db.notes.find_one({"studentId": sid, "text": {"$regex": "^Changed their study plans"}})


async def test_counsellor_edits_own_matching_profile(make_api):
    body = {"countries": [{"country": "Germany", "years": 2}], "universities": ["RWTH Aachen"], "subjects": ["engineering"], "languages": ["German"], "capacity": 25}
    counsellor = await make_api()
    await counsellor.staff_login()  # Priya (c1)
    mine = (await counsellor.get("/staff/me/matching-profile")).json()
    assert mine["matchingProfile"]["universities"] == ["University of Leeds"] and mine["activeStudents"] >= 1
    r = await counsellor.put("/staff/me/matching-profile", body)
    assert r.status_code == 200 and r.json()["capacity"] == 25
    assert (await counsellor.put("/staff/me/matching-profile", {**body, "subjects": ["astrology"]})).status_code == 422
    assert (await get_db().users.find_one({"_id": "c1"}))["matchingProfile"]["universities"] == ["RWTH Aachen"]
    assert (await counsellor.get("/admin/assignments")).status_code == 403

    # The admin only invites staff: no editing of matching profiles.
    admin = await make_api()
    await admin.staff_login("demo.admin@ahatin.example", "Admin@1234")
    assert (await admin.put("/staff/me/matching-profile", body)).status_code == 403
    assert (await admin.put("/admin/staff/c2/matching-profile", body)).status_code in (404, 405)
    officer = await make_api()
    await officer.staff_login("kavya.i@ahatin.example")
    assert (await officer.get("/staff/me/matching-profile")).status_code == 403  # officers aren't matched


async def test_officer_handovers_and_access(make_api):
    db = get_db()
    admin = await make_api()
    await admin.staff_login("demo.admin@ahatin.example", "Admin@1234")
    queue = (await admin.get("/admin/assignments")).json()
    # Arjun accepted an offer (Application Assistance complete); Nikhil's funding is verified.
    assert "s2" in {s["id"] for s in queue["waitingFinance"]} and "s5" in {s["id"] for s in queue["waitingVisa"]}
    assert [o["name"] for o in queue["officers"]["finance"]] == ["Kavya Iyer"]

    # Only the admin assigns, and only someone with the right role.
    counsellor = await make_api()
    await counsellor.staff_login()
    assert (await counsellor.post("/students/s2/officer", {"kind": "finance", "officerId": "u6"})).status_code == 403
    assert (await admin.post("/students/s2/officer", {"kind": "finance", "officerId": "u7"})).status_code == 400
    r = await admin.post("/students/s2/officer", {"kind": "finance", "officerId": "u6"})
    assert r.status_code == 200 and r.json()["financeOfficerId"] == "u6"
    assert not await db.follow_ups.find_one({"sourceEvent": "student:s2:assign-finance", "done": False})

    # The counsellor can still see funding but not change it; the officer can, and only funding.
    assert (await counsellor.put("/students/s2/funding/estimated-cost", {"lakh": 31})).status_code == 403
    kavya = await make_api()
    await kavya.staff_login("kavya.i@ahatin.example")
    assert {s["id"] for s in (await kavya.get("/students")).json()} == {"s2", "s4", "s5"}
    assert (await kavya.get("/students/s1")).status_code == 404
    assert (await kavya.get("/leads")).json() == []
    assert (await kavya.put("/students/s2/funding/estimated-cost", {"lakh": 31})).status_code == 200  # plan covers 30
    assert (await kavya.post("/students/s2/visa", {"stage": "documents_verified"})).status_code == 403

    # Separate chats: the officer's messages are in their own chat, not the counsellor's.
    assert (await kavya.post("/messages", {"studentId": "s2", "text": "Please upload the sponsor letter."})).json()["thread"] == "finance"
    assert all(m["thread"] == "counsellor" for m in (await counsellor.get("/messages")).json())

    # Proof of funds verified, but the plan doesn't cover the cost yet: not complete.
    assert (await kavya.get("/students/s2/documents/d11/download-url")).status_code == 200  # opened before verifying
    assert (await kavya.post("/students/s2/documents/d11/verify")).status_code == 200
    assert not await db.follow_ups.find_one({"sourceEvent": "student:s2:assign-visa"})
    # The plan now covers the cost: Scholarship & Financial Guidance is complete, so the admin is asked for a Visa Officer.
    assert (await kavya.post("/students/s2/funding/sources", {"kind": "Family savings", "amount": 1})).status_code == 200
    assert await db.follow_ups.find_one({"sourceEvent": "student:s2:assign-visa", "counsellorId": None, "done": False})
    assert "s2" in {s["id"] for s in (await admin.get("/admin/assignments")).json()["waitingVisa"]}
    assert (await admin.post("/students/s2/officer", {"kind": "visa", "officerId": "u7"})).status_code == 200
    assert (await counsellor.post("/students/s2/visa", {"stage": "documents_verified"})).status_code == 403
    sneha = await make_api()
    await sneha.staff_login("sneha.p@ahatin.example")
    assert (await sneha.post("/students/s2/visa", {"stage": "documents_verified"})).status_code == 200
    assert (await sneha.put("/students/s2/funding/estimated-cost", {"lakh": 20})).status_code == 403

    # Students book each kind of session with the person who looks after it.
    student = await make_api()
    await student.student_login()
    d, slot = await _free_slot("u6")
    r = await student.post("/sessions", {"type": "Scholarship & funding", "date": d, "time": slot["time"], "mode": slot["modes"][0]})
    assert r.status_code == 400 and "Financial Aid Officer" in r.json()["detail"]  # Ananya has none yet


async def test_seeded_documents_are_in_the_bucket(make_api, bucket):
    """Demo documents that have a file can be opened (their sample PDFs are in the bucket)."""
    staff = await make_api()
    await staff.staff_login()
    url = (await staff.get("/students/s1/documents/d1/download-url")).json()["url"]
    assert bucket.get_url(url).startswith(b"%PDF")


async def test_upload_size_limits(make_api):
    """Documents must be between 1 KB and 300 KB."""
    api = await make_api()
    await api.student_login()
    for size, ok in ((20, False), (1024 - 1, False), (1024, True), (300 * 1024, True), (300 * 1024 + 1, False), (5 * 1024 * 1024, False)):
        r = await api.post("/students/s1/documents/d8/upload-url", {"fileName": "f.pdf", "contentType": "application/pdf", "size": size})
        assert (r.status_code == 200) == ok, (size, r.text)
        if not ok:
            assert "between 1 KB and 300 KB" in r.json()["detail"]


def test_demo_codes_and_production_checks():
    from app.config import Settings

    prod = dict(app_env="production", session_secret="x" * 40, otp_pepper="y" * 40, field_encryption_key="k", cookie_secure=True, s3_bucket="b")
    s = Settings(**prod, demo_logins=True)
    s.check_production()  # complete production settings start fine
    assert s.show_demo_codes("demo.student@ahatin.example") and s.show_demo_codes("Kavya.I@AHATIN.example")
    assert not s.show_demo_codes("real.student@gmail.com")  # real people get codes by email only
    assert not Settings(**prod).show_demo_codes("demo.student@ahatin.example")  # DEMO_LOGINS off
    # Development too: only demo and test addresses, never a real person.
    assert Settings(app_env="development").show_demo_codes("demo.counsellor@ahatin.example") and Settings(app_env="development").show_demo_codes("asha@ahat.example")
    assert not Settings(app_env="development").show_demo_codes("anyone@gmail.com")
    # Emailed codes: never on screen for an address that really receives them.
    live = Settings(**prod, demo_logins=True, resend_api_key="k")
    assert live.show_email_code("demo.student@ahatin.example") and not live.show_email_code("real.student@gmail.com")
    dev = Settings(app_env="development", resend_api_key="k", smtp_host="")
    assert dev.show_email_code("demo.student@ahatin.example") and not dev.show_email_code("real.student@gmail.com")
    assert Settings(app_env="development", resend_api_key="", smtp_host="").show_email_code("real.student@gmail.com")  # nothing could arrive
    import pytest

    with pytest.raises(RuntimeError, match="SESSION_SECRET.*COOKIE_SECURE"):
        Settings(**{**prod, "session_secret": "dev-session-secret-change-me", "cookie_secure": False}).check_production()


async def test_admin_edits_staff_and_sets_passwords(make_api):
    import pyotp

    admin = await make_api()
    await admin.staff_login("demo.admin@ahatin.example", "Admin@1234")
    # Details: name, email, phone; emails stay unique.
    r = await admin.put("/admin/staff/c2", {"name": "Rohan K. Kapoor", "email": "rohan.kapoor@ahatin.example", "phone": "+91 98000 22223"})
    assert r.status_code == 200 and r.json()["name"] == "Rohan K. Kapoor" and r.json()["phone"] == "+91 98000 22223"
    assert (await admin.put("/admin/staff/c2", {"name": "Rohan", "email": "demo.counsellor@ahatin.example"})).status_code == 409

    # New password for an active counsellor: works, and they're signed out elsewhere.
    priya = await make_api()
    await priya.staff_login()
    assert (await admin.post("/admin/staff/c1/password", {"password": "short1"})).status_code == 422
    r = await admin.post("/admin/staff/c1/password", {"password": "NewPassword42"})
    assert r.status_code == 200 and "authenticatorKey" not in r.json()
    assert (await priya.get("/auth/me")).status_code == 401
    assert (await (await make_api()).post("/auth/staff/login", {"email": "demo.counsellor@ahatin.example", "password": "Staff@1234"})).status_code == 401
    again = await make_api()
    # The new password is accepted (the authenticator step is the same as before).
    assert (await again.post("/auth/staff/login", {"email": "demo.counsellor@ahatin.example", "password": "NewPassword42"})).status_code == 200

    # Someone invited but never set up: a password plus an authenticator key, shown once, and they can sign in.
    staff = (await admin.post("/admin/staff", {"name": "Test Officer", "email": "test.officer@ahat.example", "role": "visa_officer"})).json()["user"]
    assert staff["invited"] is True
    r = await admin.post(f"/admin/staff/{staff['id']}/password", {"password": "Welcome2027x"})
    key = r.json()["authenticatorKey"]
    assert r.json()["user"]["invited"] is False and r.json()["otpauthUri"].startswith("otpauth://")
    newbie = await make_api()
    j = (await newbie.post("/auth/staff/login", {"email": "test.officer@ahat.example", "password": "Welcome2027x"})).json()
    r = await newbie.post("/auth/staff/verify", {"challenge_id": j["challengeId"], "code": pyotp.TOTP(key).now()})
    assert r.status_code == 200 and r.json()["user"]["role"] == "visa_officer"

    # Only the admin can do this.
    assert (await newbie.put("/admin/staff/c2", {"name": "X Y", "email": "x@ahat.example"})).status_code == 403


async def test_staff_change_own_name(make_api):
    api = await make_api()
    await api.staff_login()
    r = await api.put("/staff/me/name", {"name": "Priya S. Desai"})
    assert r.status_code == 200 and r.json()["name"] == "Priya S. Desai"
    assert (await api.get("/auth/me")).json()["name"] == "Priya S. Desai"
    assert (await api.put("/staff/me/name", {"name": "P"})).status_code == 422
    student = await make_api()
    await student.student_login()
    assert (await student.put("/staff/me/name", {"name": "Someone Else"})).status_code == 403


async def test_full_student_journey(make_api, bucket, monkeypatch):
    # Officers assigned by the admin: what happens if the single officers aren't available.
    monkeypatch.setattr(get_settings(), "auto_assign_officers", False)
    """One new student from registration to the final post-arrival check-in, through every hand-over.
    With JOURNEY_SNAPSHOTS set, the student's view at each step is saved there (to check the dashboard's status rules)."""
    import json

    db = get_db()
    snapshots = []
    pdf = b"%PDF-1.4 journey" + b"." * (60 * 1024)

    student = await make_api()
    await student.register_student("Journey Tester", "journey@example.com", "9811188888")
    sid = (await student.get("/me/record")).json()["record"]["id"]
    admin, priya, kavya, sneha = [await make_api() for _ in range(4)]
    await admin.staff_login("demo.admin@ahatin.example", "Admin@1234")
    await priya.staff_login()
    await kavya.staff_login("kavya.i@ahatin.example")
    await sneha.staff_login("sneha.p@ahatin.example")

    async def snap(label):
        mine = (await student.get("/me/record")).json()
        snapshots.append({"label": label, "record": mine["record"], "sessions": (await student.get("/sessions")).json()})
        return mine["record"]

    async def upload(doc_id):
        up = (await student.post(f"/students/{sid}/documents/{doc_id}/upload-url", {"fileName": "proof.pdf", "contentType": "application/pdf", "size": len(pdf)})).json()
        bucket.put_url(up["url"], pdf)
        r = await student.post(f"/students/{sid}/documents/{doc_id}/upload-complete", {"uploadId": up["uploadId"]})
        assert r.status_code == 200, r.text

    def doc_named(rec, name):
        return next(d for d in rec["documents"] if d["name"] == name)

    async def open_follow_up(event):
        return await db.follow_ups.find_one({"sourceEvent": event, "done": False})

    await snap("Registered")

    # Profile complete -> the best-matched counsellor is assigned automatically.
    assert (await student.put("/me/profile", PROFILE)).status_code == 200
    assert (await student.get("/me/record")).json()["record"]["counsellorId"] == "c1"
    await snap("Counsellor assigned")

    # 1. Career Counselling: a session, then the career plan.
    d, slot = await _free_slot("c1")
    r = await student.post("/sessions", {"type": "Career counselling", "date": d, "time": slot["time"], "mode": slot["modes"][0]})
    assert r.status_code == 200 and r.json()["counsellorId"] == "c1", r.text
    await snap("Career session booked")
    plan = {"direction": "computing", "course": "Data Science & Analytics", "level": "masters", "destinations": ["United Kingdom"], "notes": ""}
    assert (await priya.post(f"/students/{sid}/career-plan", plan)).status_code == 200
    await snap("Career plan shared")

    # 2. University & Country Selection: shortlist shared, the student decides and approves.
    item = {"course": "MSc Data Science", "country": "United Kingdom", "intake": "September 2027", "duration": "1 year", "reason": "Strong programme"}
    await priya.post(f"/students/{sid}/shortlist/items", {**item, "university": "University of Leeds"})
    rec = (await priya.post(f"/students/{sid}/shortlist/items", {**item, "university": "University of Bristol"})).json()
    assert (await priya.post(f"/students/{sid}/shortlist/share")).status_code == 200
    await snap("Shortlist shared")
    leeds, bristol = rec["journey"]["shortlist"]["items"]
    assert leeds["duration"] == "1 year" and "agency" not in leeds and "earnsCommission" not in leeds
    await student.put(f"/students/{sid}/shortlist/items/{leeds['id']}/choice", {"choice": "apply"})
    await student.put(f"/students/{sid}/shortlist/items/{bristol['id']}/choice", {"choice": "removed", "reason": "Prefer Leeds"})
    assert (await student.post(f"/students/{sid}/shortlist/approve", {})).status_code == 200
    rec = await snap("Shortlist approved")
    app_id = rec["applications"][0]["id"]
    assert [(a["state"], a["agency"]) for a in rec["applications"]] == [("draft", "")]

    # 3. Application Assistance: submitted, offer, the student accepts -> the admin is asked for a Financial Aid Officer.
    assert (await priya.post(f"/students/{sid}/applications/{app_id}/status", {"to": "submitted"})).status_code == 200
    rec = await snap("Application submitted")
    assert rec["stage"] == "applications_submitted"
    assert (await priya.post(f"/students/{sid}/applications/{app_id}/status", {"to": "conditional_offer"})).status_code == 200
    await snap("Offer received")
    assert not await open_follow_up(f"student:{sid}:assign-finance")
    assert (await student.post(f"/students/{sid}/applications/{app_id}/decision", {"accept": True})).status_code == 200
    rec = await snap("Offer accepted")
    assert rec["stage"] == "offer_accepted"
    assert await open_follow_up(f"student:{sid}:assign-finance")
    assert sid in {s["id"] for s in (await admin.get("/admin/assignments")).json()["waitingFinance"]}
    d2, slot2 = await _free_slot("u6")
    funding_session = {"type": "Scholarship & funding", "date": d2, "time": slot2["time"], "mode": slot2["modes"][0]}
    assert (await student.post("/sessions", funding_session)).status_code == 400  # no Financial Aid Officer yet

    # 4. Scholarship & Financial Guidance: Kavya sets the cost and asks for proof of funds; the student plans and uploads.
    assert (await admin.post(f"/students/{sid}/officer", {"kind": "finance", "officerId": "u6"})).status_code == 200
    assert not await open_follow_up(f"student:{sid}:assign-finance")
    await snap("Financial Aid Officer assigned")
    assert (await priya.put(f"/students/{sid}/funding/estimated-cost", {"lakh": 30})).status_code == 403  # now the officer's
    assert (await kavya.put(f"/students/{sid}/funding/estimated-cost", {"lakh": 30})).status_code == 200
    await snap("Estimated cost set")
    rec = (await kavya.post(f"/students/{sid}/documents", {"name": "Bank statement (6 months)", "category": "funds"})).json()
    funds_id = doc_named(rec, "Bank statement (6 months)")["id"]
    assert (await student.post(f"/students/{sid}/funding/sources", {"kind": "Education loan", "amount": 20})).status_code == 200
    await snap("Funding plan started")
    assert (await student.post(f"/students/{sid}/funding/sources", {"kind": "Family savings", "amount": 10})).status_code == 200
    await upload(funds_id)
    await snap("Proof of funds uploaded")
    assert await db.follow_ups.find_one({"personId": sid, "counsellorId": "u6", "action": "Verify uploaded document: Bank statement (6 months)", "done": False})
    assert not await open_follow_up(f"student:{sid}:assign-visa")
    assert (await priya.post(f"/students/{sid}/documents/{funds_id}/verify")).status_code == 403
    assert (await kavya.get(f"/students/{sid}/documents/{funds_id}/download-url")).status_code == 200  # opened before verifying
    assert (await kavya.post(f"/students/{sid}/documents/{funds_id}/verify")).status_code == 200
    await snap("Proof of funds verified")
    assert await open_follow_up(f"student:{sid}:assign-visa")
    assert sid in {s["id"] for s in (await admin.get("/admin/assignments")).json()["waitingVisa"]}
    # Separate chats.
    assert (await student.post("/messages", {"text": "Thanks for the help!", "thread": "finance"})).json()["thread"] == "finance"
    assert any(m["thread"] == "finance" and m["studentId"] == sid for m in (await kavya.get("/messages")).json())
    assert not any(m["studentId"] == sid for m in (await priya.get("/messages")).json())
    r = await student.post("/sessions", funding_session)
    assert r.status_code == 200 and r.json()["counsellorId"] == "u6", r.text
    assert (await student.post(f"/sessions/{r.json()['id']}/cancel", {})).status_code == 200

    # 5. Visa Assistance: only the Visa Officer records visa progress.
    assert (await admin.post(f"/students/{sid}/officer", {"kind": "visa", "officerId": "u7"})).status_code == 200
    await snap("Visa Officer assigned")
    assert (await kavya.post(f"/students/{sid}/visa", {"stage": "cas_received"})).status_code == 403
    assert (await priya.post(f"/students/{sid}/visa", {"stage": "cas_received"})).status_code == 403
    assert (await student.put(f"/students/{sid}/departure/tasks/flight", {"done": True})).status_code == 400  # not before the visa
    assert (await sneha.post(f"/students/{sid}/visa", {"stage": "cas_received"})).status_code == 200
    await snap("CAS received")
    rec = (await sneha.post(f"/students/{sid}/documents", {"name": "Visa photograph", "category": "visa"})).json()
    visa_doc = doc_named(rec, "Visa photograph")["id"]
    await upload(visa_doc)
    assert (await kavya.post(f"/students/{sid}/documents/{visa_doc}/verify")).status_code == 403
    assert (await sneha.get(f"/students/{sid}/documents/{visa_doc}/download-url")).status_code == 200  # opened before verifying
    assert (await sneha.post(f"/students/{sid}/documents/{visa_doc}/verify")).status_code == 200
    for stage in ("documents_verified", "fees_paid"):
        assert (await sneha.post(f"/students/{sid}/visa", {"stage": stage})).status_code == 200
    assert (await sneha.post(f"/students/{sid}/visa", {"stage": "submitted", "reference": "GWF012345678"})).status_code == 200
    rec = await snap("Visa submitted")
    assert rec["stage"] == "visa_filed" and await open_follow_up(f"visa:{sid}:submitted")
    assert (await sneha.post(f"/students/{sid}/visa", {"stage": "biometrics"})).status_code == 200
    assert (await sneha.post(f"/students/{sid}/visa", {"stage": "granted"})).status_code == 200
    rec = await snap("Visa granted")
    assert rec["stage"] == "visa_granted" and not await open_follow_up(f"visa:{sid}:submitted")
    d3, slot3 = await _free_slot("u7")
    r = await student.post("/sessions", {"type": "Pre-departure briefing", "date": d3, "time": slot3["time"], "mode": slot3["modes"][0]})
    assert r.status_code == 200 and r.json()["counsellorId"] == "u7", r.text
    assert (await student.post(f"/sessions/{r.json()['id']}/cancel", {})).status_code == 200

    # 6. Pre-departure: the student ticks every task, the Visa Officer confirms.
    tasks = ["accommodation", "flight", "insurance", "money", "briefing", "documents"]
    for key in tasks[:3]:
        assert (await student.put(f"/students/{sid}/departure/tasks/{key}", {"done": True})).status_code == 200
    await snap("Pre-departure half done")
    assert (await sneha.post(f"/students/{sid}/departure/confirm")).status_code == 400  # tasks left
    for key in tasks[3:]:
        assert (await student.put(f"/students/{sid}/departure/tasks/{key}", {"done": True})).status_code == 200
    await snap("Pre-departure tasks done")
    assert (await priya.post(f"/students/{sid}/departure/confirm")).status_code == 403
    assert (await sneha.post(f"/students/{sid}/departure/confirm")).status_code == 200
    await snap("Ready to travel")

    # 7. Post-arrival Support: the student confirms arrival, the Visa Officer records the final check-in.
    assert (await student.post(f"/students/{sid}/arrival")).status_code == 200
    rec = await snap("Arrived")
    assert rec["stage"] == "arrived"
    assert await db.follow_ups.find_one({"sourceEvent": f"arrival:{sid}", "counsellorId": "u7", "done": False})
    assert (await sneha.post(f"/students/{sid}/final-check-in", {"note": "Settled in well, classes started."})).status_code == 200
    rec = await snap("Final check-in")
    assert rec["stage"] == "settled" and not await open_follow_up(f"arrival:{sid}")

    # Nothing is left waiting for the admin, and each person looking after the student can open the record.
    queue = (await admin.get("/admin/assignments")).json()
    assert sid not in {s["id"] for k in ("waiting", "waitingFinance", "waitingVisa") for s in queue[k]}
    for api in (priya, kavya, sneha):
        assert sid in {s["id"] for s in (await api.get("/students")).json()}

    if path := os.environ.get("JOURNEY_SNAPSHOTS"):
        with open(path, "w", encoding="utf-8") as f:
            json.dump(snapshots, f, default=str)


async def test_counsellor_assigned_automatically(make_api):
    """Completing the profile assigns the best-matched counsellor with room, with the reasons on the record."""
    db = get_db()
    student = await make_api()
    await student.register_student("Isha Verma", "isha@example.com", "9811177777")
    sid = (await student.get("/me/record")).json()["record"]["id"]
    # Saving an incomplete profile changes nothing.
    assert (await student.put("/me/profile", {**PROFILE, "city": ""})).status_code == 422
    assert (await student.get("/me/record")).json()["counsellor"] is None

    admin = await make_api()
    await admin.staff_login("demo.admin@ahatin.example", "Admin@1234")
    assert sid in {x["id"] for x in (await admin.get("/admin/assignments")).json()["incomplete"]}
    assert (await student.put("/me/profile", PROFILE)).status_code == 200  # UK + computing
    mine = (await student.get("/me/record")).json()
    assert mine["counsellor"]["name"] == "Priya Desai"  # c1: UK experience and computing
    entry = mine["record"]["assignmentHistory"][-1]
    assert entry["by"] == "AHat (automatic)" and entry["to"] == "c1" and entry["reason"].startswith("Matched automatically on the student's profile (score ")
    # Nothing left for the admin, and the journey can start straight away.
    queue = (await admin.get("/admin/assignments")).json()
    assert sid not in {x["id"] for x in queue["waiting"] + queue["incomplete"]}
    assert not await db.follow_ups.find_one({"sourceEvent": f"student:{sid}:assign", "done": False})
    assert await db.audit_log.find_one({"action": "student.assigned", "entityId": sid, "data.automatic": True})
    assert await db.notifications.find_one({"to": "isha@example.com", "subject": "Meet your counsellor: Priya Desai"})
    d, slot = await _free_slot("c1")
    assert (await student.post("/sessions", {"type": "Career counselling", "date": d, "time": slot["time"], "mode": slot["modes"][0]})).status_code == 200
    # Assigned once: later profile changes don't move the student.
    assert (await student.put("/me/profile", {**PROFILE, "destination": "Ireland"})).status_code == 200
    assert (await student.get("/me/record")).json()["counsellor"]["name"] == "Priya Desai"


async def test_full_counsellors_are_skipped_and_nobody_with_room_waits_for_admin(make_api):
    db = get_db()
    # Priya (the best match for this profile) is full: the next best counsellor with room is chosen.
    await db.users.update_one({"_id": "c1"}, {"$set": {"matchingProfile.capacity": 1}})
    first = await make_api()
    await first.register_student("Om Joshi", "om@example.com", "9811166666")
    assert (await first.put("/me/profile", PROFILE)).status_code == 200
    assigned = (await first.get("/me/record")).json()["counsellor"]
    assert assigned and assigned["id"] != "c1"

    # Every counsellor full: the student waits for the admin, as before.
    await db.users.update_many({"role": "counsellor"}, {"$set": {"matchingProfile.capacity": 1}})
    second = await make_api()
    await second.register_student("Tara Nair", "tara@example.com", "9811144444")
    sid = (await second.get("/me/record")).json()["record"]["id"]
    assert (await second.put("/me/profile", PROFILE)).status_code == 200
    assert (await second.get("/me/record")).json()["counsellor"] is None
    admin = await make_api()
    await admin.staff_login("demo.admin@ahatin.example", "Admin@1234")
    assert sid in {x["id"] for x in (await admin.get("/admin/assignments")).json()["waiting"]}
    assert await db.follow_ups.find_one({"sourceEvent": f"student:{sid}:assign", "done": False, "counsellorId": None})


async def test_profile_address_and_school_details(make_api):
    api = await make_api()
    await api.student_login("new.student@ahatin.example")
    bad = [
        ({"state": "Atlantis"}, "state"),
        ({"pincode": "011001"}, "pincode"),
        ({"pincode": "41100"}, "pincode"),
        ({"sscYear": "1950"}, "sscYear"),
        ({"addressLine1": ""}, "addressLine1"),
        ({"graduationYear": ""}, "graduationYear"),
        ({"institution": ""}, "institution"),
    ]
    for change, field in bad:
        r = await api.put("/me/profile", {**PROFILE, **change})
        assert r.status_code == 422 and field in {e["field"] for e in r.json()["errors"]}, (change, r.text)
    # Years must be in order: 10th, then 12th, then the highest qualification.
    assert (await api.put("/me/profile", {**PROFILE, "hscYear": "2017"})).status_code == 422
    assert (await api.put("/me/profile", {**PROFILE, "graduationYear": "2018"})).status_code == 422
    # The 10th and 12th are optional; only the highest qualification is required.
    no_school = {k: v for k, v in PROFILE.items() if not k.startswith(("ssc", "hsc"))}
    assert (await api.put("/me/profile", no_school)).status_code == 200
    assert (await api.put("/me/profile", {**no_school, "hscYear": "2030"})).status_code == 422  # after the highest qualification
    # Saved and returned with the profile.
    assert (await api.put("/me/profile", {**PROFILE, "addressLine2": "Near the station", "degreeSubject": "Computer Science"})).status_code == 200
    p = (await api.get("/me/record")).json()["profile"]
    assert (p["state"], p["pincode"], p["sscBoard"], p["hscStream"], p["graduationYear"], p["degreeSubject"], p["addressLine2"]) == (
        "Maharashtra", "411001", "CBSE", "Science (PCM)", "2023", "Computer Science", "Near the station",
    )


async def test_new_students_get_the_single_officers(make_api, monkeypatch):
    student = await make_api()
    await student.register_student("Nina Rao", "nina.rao@example.com", "9811133344")
    sid = (await student.get("/me/record")).json()["record"]["id"]
    # Not until the profile is complete.
    assert (await get_db().students.find_one({"_id": sid})).get("financeOfficerId") is None
    assert (await student.put("/me/profile", PROFILE)).status_code == 200
    rec = await get_db().students.find_one({"_id": sid})
    assert rec["financeOfficerId"] == "u6" and rec["visaOfficerId"] == "u7" and rec["counsellorId"]
    assert [h["role"] for h in rec["officerHistory"]] == ["finance", "visa"]
    # Each officer is told, and sees the student.
    kavya = await make_api()
    await kavya.staff_login("kavya.i@ahatin.example")
    assert [n["kind"] for n in await _notes(kavya)] == ["assigned"]
    assert (await kavya.get(f"/students/{sid}")).status_code == 200
    # Saving the profile again changes nothing.
    assert (await student.put("/me/profile", PROFILE)).status_code == 200
    assert len((await get_db().students.find_one({"_id": sid}))["officerHistory"]) == 2

    # If the officer can't be used, the student is left for the admin rather than given to someone else.
    await get_db().users.update_one({"_id": "u6"}, {"$set": {"status": "deactivated"}})
    other = await make_api()
    await other.register_student("Rina Das", "rina.das@example.com", "9811133345")
    assert (await other.put("/me/profile", PROFILE)).status_code == 200
    rec = await get_db().students.find_one({"email": "rina.das@example.com"})
    assert rec.get("financeOfficerId") is None and rec["visaOfficerId"] == "u7"


async def _delegate_link(student, email="papa.rao@example.com", relation="Parent"):
    r = await student.post("/me/delegates", {"name": "Papa Rao", "email": email, "relation": relation})
    assert r.status_code == 200, r.text
    return r.json()["id"], r.json()["demoLink"].rsplit("/", 1)[1]


async def test_parent_can_only_upload_through_their_link(make_api, bucket):
    student = await make_api()
    await student.student_login()
    delegate_id, token = await _delegate_link(student)
    # Listed for the student, without the link itself.
    [listed] = (await student.get("/me/delegates")).json()
    assert listed["name"] == "Papa Rao" and "tokenHash" not in listed and "demoLink" not in listed
    assert (await student.post("/me/delegates", {"name": "Papa Rao", "email": "papa.rao@example.com", "relation": "Parent"})).status_code == 409
    assert (await student.post("/me/delegates", {"name": "Me Myself", "email": "demo.student@ahatin.example", "relation": "Parent"})).status_code == 400

    parent = await make_api()  # no account
    view = (await parent.get(f"/delegate-access/{token}")).json()
    assert set(view) == {"studentName", "name", "expiresAt", "documents"} and view["studentName"] == "Ananya"
    assert {d["state"] for d in view["documents"]} <= {"missing", "rejected"}
    doc = next(d for d in view["documents"] if d["id"] == "d8")
    assert set(doc) <= {"id", "name", "state", "reason"}

    pdf = b"%PDF-1.4 sample" + b"." * 2048
    up = await parent.post(f"/delegate-access/{token}/documents/d8/upload-url", {"fileName": "cv.pdf", "contentType": "application/pdf", "size": len(pdf)})
    assert up.status_code == 200, up.text
    bucket.put_url(up.json()["url"], pdf)
    r = await parent.post(f"/delegate-access/{token}/documents/d8/upload-complete", {"uploadId": up.json()["uploadId"]})
    assert r.status_code == 200 and r.json() == {"ok": True}

    # It goes through the same review, and says who uploaded it.
    priya = await make_api()
    await priya.staff_login()
    d8 = next(d for d in (await priya.get("/students/s1")).json()["documents"] if d["id"] == "d8")
    assert d8["state"] == "pending" and d8["uploadedBy"] == "Papa Rao (Parent)"
    assert "Papa Rao (Parent)" in next(n["text"] for n in await _notes(priya) if n["kind"] == "document")
    assert not any(d["id"] == "d8" for d in (await parent.get(f"/delegate-access/{token}")).json()["documents"])
    assert (await student.get("/me/delegates")).json()[0]["uploads"] == 1

    # Nothing else is open to them: a document that isn't the student's, or anything needing an account.
    assert (await parent.post(f"/delegate-access/{token}/documents/not-theirs/upload-url", {"fileName": "x.pdf", "contentType": "application/pdf", "size": 2048})).status_code == 404
    for path in ("/students/s1", "/me/record", "/students/s1/documents/d8/download-url", "/messages"):
        assert (await parent.get(path)).status_code == 401, path
    assert (await parent.get("/delegate-access/wrong-token")).status_code == 404

    # Cancelled or expired: the link stops working.
    assert (await student.delete(f"/me/delegates/{delegate_id}")).status_code == 204
    assert (await parent.get(f"/delegate-access/{token}")).status_code == 404
    assert (await student.get("/me/delegates")).json() == []
    _, token2 = await _delegate_link(student, "sponsor@example.com", "Sponsor")
    await get_db().delegates.update_one({"email": "sponsor@example.com"}, {"$set": {"expiresAt": now() - timedelta(minutes=1)}})
    assert (await parent.get(f"/delegate-access/{token2}")).status_code == 404

    # Staff don't invite, and one student can't remove another's.
    assert (await priya.get("/me/delegates")).status_code == 403
    other_id, _ = await _delegate_link(student, "third@example.com", "Guardian")
    fresh = await make_api()
    await fresh.student_login("new.student@ahatin.example")
    assert (await fresh.delete(f"/me/delegates/{other_id}")).status_code == 404


async def test_referrals_track_people_through_the_journey(make_api):
    student = await make_api()
    await student.student_login()
    mine = (await student.get("/referrals")).json()
    assert mine["totals"]["referred"] == 0 and mine["link"].endswith(f"/register?ref={mine['code']}") and len(mine["code"]) == 8
    assert (await student.get("/referrals")).json()["code"] == mine["code"]  # stays the same

    r = await student.post("/referrals", {"name": "Riya Shah", "email": "riya.shah@example.com", "relation": "Friend"})
    assert r.status_code == 200 and r.json()["status"] == "invited", r.text
    assert (await student.post("/referrals", {"name": "Riya Shah", "email": "riya.shah@example.com", "relation": "Friend"})).status_code == 409
    assert (await student.post("/referrals", {"name": "Priya Desai", "email": "demo.counsellor@ahatin.example", "relation": "Friend"})).status_code == 409
    assert (await student.post("/referrals", {"name": "Me Myself", "email": "demo.student@ahatin.example", "relation": "Friend"})).status_code == 400
    invite = await get_db().notifications.find_one({"to": "riya.shah@example.com"})
    assert mine["link"] in invite["body"]

    # Invited by email: counted even if they register without the link.
    riya = await make_api()
    await riya.register_student("Riya Shah", "riya.shah@example.com", "9811144401")
    mine = (await student.get("/referrals")).json()
    assert mine["totals"] == {"referred": 1, "registered": 1, "applied": 0, "accepted": 0} and mine["items"][0]["status"] == "registered"
    assert (await riya.put("/me/profile", PROFILE)).status_code == 200
    assert (await student.get("/referrals")).json()["items"][0]["status"] == "profile"
    # The referrer sees progress only, not the person's email or record.
    assert set(mine["items"][0]) <= {"id", "name", "relation", "source", "status", "at", "registeredAt"}
    sid = (await riya.get("/me/record")).json()["record"]["id"]
    await get_db().applications.insert_one({"_id": "app-r", "studentId": sid, "university": "Leeds", "course": "MSc", "state": "submitted"})
    assert (await student.get("/referrals")).json()["items"][0]["status"] == "applied"
    await get_db().applications.update_one({"_id": "app-r"}, {"$set": {"state": "accepted"}})
    assert (await student.get("/referrals")).json()["totals"]["accepted"] == 1

    # A counsellor's link: credited from the code, and they are told.
    priya = await make_api()
    await priya.staff_login()
    code = (await priya.get("/referrals")).json()["code"]
    viaapi = await make_api()
    body = {"name": "Kabir Sen", "email": "kabir.sen@example.com", "mobile": "9811144402", "password": "Welcome123", "consent": True, "ref": code.lower()}
    assert (await viaapi.post("/auth/register", body)).status_code == 200
    theirs = (await priya.get("/referrals")).json()
    assert [(i["name"], i["source"], i["status"]) for i in theirs["items"]] == [("Kabir Sen", "link", "registered")]
    assert any("Kabir Sen registered" in n["title"] for n in await _notes(priya))
    assert (await student.get("/referrals")).json()["totals"]["referred"] == 1  # not mixed up with anyone else's

    # An unknown code is ignored; your own link doesn't count; officers have no referrals; the admin sees everyone's.
    nobody = await make_api()
    assert (await nobody.post("/auth/register", {**body, "email": "no.ref@example.com", "mobile": "9811144403", "ref": "NOPE"})).status_code == 200
    assert await get_db().referrals.count_documents({"email": "no.ref@example.com"}) == 0
    kavya = await make_api()
    await kavya.staff_login("kavya.i@ahatin.example")
    assert (await kavya.get("/referrals")).status_code == 403
    admin = await make_api()
    await admin.staff_login("demo.admin@ahatin.example", "Admin@1234")
    everyone = (await admin.get("/referrals")).json()
    assert {i["referrer"] for i in everyone["items"]} == {"Ananya Sharma", "Priya Desai"}


async def test_counsellor_can_edit_and_delete_suggested_scholarships(make_api):
    student = await make_api()
    await student.student_login()
    priya, kavya = await make_api(), await make_api()
    await priya.staff_login()
    await kavya.staff_login("kavya.i@ahatin.example")
    await get_db().students.update_one({"_id": "s1"}, {"$set": {"financeOfficerId": "u6"}})
    r = await kavya.post("/students/s1/funding/scholarships", {"name": "Chevening", "amount": "Full tuition", "deadline": "2027-02-01"})
    assert r.status_code == 200, r.text
    sch = r.json()["journey"]["funding"]["scholarships"][-1]
    await kavya.post("/staff/notifications/read-all")
    base = f"/students/s1/funding/scholarships/{sch['id']}"
    changed = {"name": "Chevening Award", "amount": "Full tuition fees and a generous annual living grant", "deadline": "2027-03-01"}

    # The counsellor can correct it, though the officer has the rest of the stage.
    assert (await priya.put("/students/s1/funding/estimated-cost", {"lakh": 20})).status_code == 403
    assert (await priya.post("/students/s1/funding/scholarships", changed)).status_code == 403
    assert (await priya.patch(base, {"status": "awarded"})).status_code == 403
    r = await priya.put(base, changed)
    assert r.status_code == 200, r.text
    saved = r.json()["journey"]["funding"]["scholarships"][-1]
    assert saved == {**sch, **changed}  # the id and status stay
    assert (await priya.put(base, {**changed, "name": "x"})).status_code == 422
    # The officer is told, and the student is emailed.
    assert any("Scholarship updated" in n["title"] for n in await _notes(kavya))
    assert await get_db().notifications.find_one({"to": "demo.student@ahatin.example", "subject": "Scholarship updated"})

    # Not the student, and not a counsellor who can't see them.
    assert (await student.put(base, changed)).status_code == 403
    assert (await student.delete(base)).status_code == 403
    assert (await kavya.put(base, {**changed, "amount": "£25,000"})).status_code == 200
    visa = await make_api()
    await visa.staff_login("sneha.p@ahatin.example")
    await get_db().students.update_one({"_id": "s1"}, {"$set": {"visaOfficerId": "u7"}})
    assert (await visa.delete(base)).status_code == 403
    neha = await make_api()
    await neha.staff_login("neha.j@ahatin.example")
    assert (await neha.delete(base)).status_code == 404

    r = await priya.delete(base)
    assert r.status_code == 200, r.text
    assert sch["id"] not in {s["id"] for s in r.json()["journey"]["funding"]["scholarships"]}
    assert (await priya.delete(base)).status_code == 404


async def test_a_requested_document_remembers_its_stage(make_api):
    staff = await make_api()
    await staff.staff_login()
    doc = lambda rec, name: next(d for d in rec["documents"] if d["name"] == name)  # noqa: E731
    rec = (await staff.post("/students/s1/documents", {"name": "Work experience letter", "category": "general", "stage": "S1"})).json()
    assert doc(rec, "Work experience letter")["requestedStage"] == "S1"
    # Without one it goes by the part of the checklist.
    rec = (await staff.post("/students/s1/documents", {"name": "TB test certificate", "category": "visa"})).json()
    assert doc(rec, "TB test certificate")["requestedStage"] == "S5"
    assert (await staff.post("/students/s1/documents", {"name": "Bad stage", "stage": "S2"})).status_code == 422
    # The starter documents weren't requested at any stage.
    await staff.get("/students/s1")
    assert "requestedStage" not in doc(rec, "Updated CV")


async def test_feedback_mode(make_api, monkeypatch):
    guest = await make_api()
    pin = {"text": "This button is confusing", "path": "/login", "x": 120.5, "y": 2400, "viewportWidth": 1280}
    r = await guest.post("/feedback", pin)
    assert r.status_code == 200 and r.json()["by"] == "Guest", r.text
    student = await make_api()
    await student.student_login()
    r = await student.post("/feedback", {**pin, "path": "/dashboard"})
    assert r.json()["by"] == "Ananya Sharma"

    # Saved, and fetched per page.
    assert [c["text"] for c in (await guest.get("/feedback", params={"path": "/login"})).json()] == [pin["text"]]
    assert (await guest.get("/feedback", params={"path": "/dashboard"})).json()[0]["x"] == 120.5
    assert (await guest.get("/feedback", params={"path": "/nowhere"})).json() == []
    assert len((await guest.get("/feedback")).json()) == 2

    # Secret links and query strings aren't kept, even if they are sent.
    r = await guest.post("/feedback", {**pin, "path": "/upload/secret-token-123"})
    assert r.json()["path"] == "/upload/(private link)"
    r = await guest.post("/feedback", {**pin, "path": "/staff/setup/secret-token-456?a=1"})
    assert r.json()["path"] == "/staff/setup/(private link)"
    r = await guest.post("/feedback", {**pin, "path": "/register?ref=ABC#top"})
    assert r.json()["path"] == "/register"
    stored = await get_db().feedback.find({}).to_list(None)
    assert not any("secret-token" in c["path"] for c in stored)

    for bad in ({"text": ""}, {"text": "x" * 1001}, {"x": -1}, {"viewportWidth": 0}):
        assert (await guest.post("/feedback", {**pin, **bad})).status_code == 422, bad

    # Off outside development, unless switched on.
    monkeypatch.setattr(get_settings(), "app_env", "production")
    monkeypatch.setattr(get_settings(), "feedback_mode", False)
    assert (await guest.get("/feedback")).status_code == 404
    assert (await guest.post("/feedback", pin)).status_code == 404
    monkeypatch.setattr(get_settings(), "feedback_mode", True)
    assert (await guest.get("/feedback")).status_code == 200

    # If switched on live: the author or staff can change a comment, and nobody else.
    mine = next(c for c in (await student.get("/feedback", params={"path": "/dashboard"})).json())
    theirs = next(c for c in (await student.get("/feedback", params={"path": "/login"})).json())
    assert mine["canChange"] is True and theirs["canChange"] is False
    other = await make_api()
    await other.student_login("new.student@ahatin.example")
    for api in (guest, other):
        assert (await api.put(f"/feedback/{mine['id']}", {"text": "Changed"})).status_code == 403
        assert (await api.delete(f"/feedback/{mine['id']}")).status_code == 403
    r = await student.put(f"/feedback/{mine['id']}", {"text": "Changed by me"})
    assert r.status_code == 200 and r.json()["text"] == "Changed by me"
    assert (await student.put(f"/feedback/{mine['id']}", {"text": ""})).status_code == 422
    assert (await student.delete(f"/feedback/{mine['id']}")).status_code == 204
    assert (await student.delete(f"/feedback/{mine['id']}")).status_code == 404
    staff = await make_api()
    await staff.staff_login()
    assert (await staff.delete(f"/feedback/{theirs['id']}")).status_code == 204

    # Off again: no changes either.
    monkeypatch.setattr(get_settings(), "feedback_mode", False)
    assert (await staff.delete("/feedback/anything")).status_code == 404


async def test_student_is_told_about_every_staff_action(make_api, bucket):
    student = await make_api()
    await student.student_login()
    priya = await make_api()
    await priya.staff_login()
    admin = await make_api()
    await admin.staff_login("demo.admin@ahatin.example", "Admin@1234")

    async def updates():
        r = await student.get("/me/updates")
        assert r.status_code == 200, r.text
        return r.json()

    async def told(result, *words, target=None):
        """The action worked, and the newest update says so."""
        assert result.status_code in (200, 204), result.text
        latest = (await updates())[0]
        assert all(w in latest["title"] for w in words), latest
        if target:
            assert latest["target"] == target, latest

    assert await updates() == []
    await told(await priya.post("/students/s1/documents", {"name": "Work experience letter", "category": "general", "stage": "S3"}), "Please upload", target="documents")
    doc = next(d for d in (await priya.get("/students/s1")).json()["documents"] if d["name"] == "Work experience letter")
    await told(await priya.delete(f"/students/s1/documents/{doc['id']}"), "no longer need", target="documents")
    plan = {"direction": "computing", "course": "Data Science & Analytics", "level": "masters", "destinations": ["United Kingdom"], "notes": ""}
    await told(await priya.post("/students/s1/career-plan", plan), "career plan", target="progress")
    await told(await admin.put("/students/s1/overrides/S4", {"status": "not_needed", "reason": "Self funded student"}), "Not needed", target="progress")
    await told(await admin.put("/students/s1/overrides/S4", {"status": None, "reason": "Set back to automatic"}), "was updated")
    await told(await admin.put("/students/s1/funding/estimated-cost", {"lakh": 40}), "estimated cost", target="funding")
    await told(await admin.post("/students/s1/funding/sources", {"kind": "Sponsor", "amount": 1}), "funding plan", target="funding")
    sch = await admin.post("/students/s1/funding/scholarships", {"name": "Chevening", "amount": "Full tuition fees", "deadline": "2027-02-01"})
    await told(sch, "New scholarship", target="funding")
    sch_id = sch.json()["journey"]["funding"]["scholarships"][-1]["id"]
    await told(await admin.patch(f"/students/s1/funding/scholarships/{sch_id}", {"status": "awarded"}), "Chevening", "Awarded", target="funding")
    await told(await priya.delete(f"/students/s1/funding/scholarships/{sch_id}"), "Scholarship removed", target="funding")
    await told(await admin.post("/students/s1/visa", {"stage": "cas_received"}), "Visa update", target="visa")
    d, slot = await _free_slot("c1")
    booked = await priya.post("/sessions", {"studentId": "s1", "type": "Application review", "date": d, "time": slot["time"], "mode": slot["modes"][0]})
    await told(booked, "booked a session", target="sessions")
    await told(await priya.post(f"/sessions/{booked.json()['id']}/cancel", {"reason": "I am unwell today"}), "cancelled", target="sessions")
    await told(await admin.post("/students/s1/reassign", {"counsellorId": "c2", "reason": "Testing it"}), "now your counsellor", target="counsellor")

    # The student's own actions and private staff notes aren't updates.
    before = len(await updates())
    assert (await student.post("/students/s1/funding/sources", {"kind": "Other", "amount": 1})).status_code == 200
    assert (await admin.post("/students/s1/notes", {"text": "Private note"})).status_code == 200
    assert len(await updates()) == before

    # Separate per student, and they go when read.
    other = await make_api()
    await other.student_login("new.student@ahatin.example")
    assert (await other.get("/me/updates")).json() == []
    first = (await updates())[0]
    assert (await other.post(f"/me/updates/{first['id']}/read")).status_code == 204  # not theirs: no effect
    assert len(await updates()) == before
    assert (await student.post(f"/me/updates/{first['id']}/read")).status_code == 204
    assert len(await updates()) == before - 1
    assert (await student.post("/me/updates/read-all")).status_code == 204
    assert await updates() == []


async def test_budget_is_no_longer_part_of_the_profile(make_api):
    student = await make_api()
    await student.register_student("Nina Rao", "nina.rao@example.com", "9811133344")
    assert "budget" not in PROFILE
    assert (await student.put("/me/profile", PROFILE)).status_code == 200
    mine = (await student.get("/me/record")).json()
    assert mine["profileComplete"] is True and "budget" not in mine["profile"]
    # An older version of the app sending one is ignored.
    assert (await student.put("/me/profile", {**PROFILE, "budget": "₹25–35 lakh"})).status_code == 200
    assert "budget" not in (await student.get("/me/record")).json()["profile"]


HEADER = "university,country,course,study_level,study_area,intakes,intake_years,status,duration_months,tuition_per_year,currency,application_fee,avg_scholarship,min_qualification,min_ug_percent,min_12th_percent,max_backlogs,min_ielts,min_pte,min_toefl,min_duolingo,featured,qs_ranking,source_url,checked_on"
COURSES = [
    "Test University A,United Kingdom,MSc Computer Science,Master's,Computing & IT,Sep;Jan,2027;2028,Open,12,\"20,000\",GBP,0,3000,Bachelor's,60,55,3,6.5,58,88,110,Yes,320,https://example.org/a-cs,2026-10-01",
    "Test University A,United Kingdom,MBA,Master's,Business & Management,Sep,2027,Closed,24,30000,GBP,100,,Bachelor's,70,,0,7,,,,Yes,320,,2026-10-01",
    "Test University B,Germany,MSc Data Engineering,Master's,Computing & IT,Oct,2027,Open,24,1000,EUR,75,500,Bachelor's,75,,,6,,,,,90,,2026-10-01",
    "Test University C,Ireland,BSc Computing,Bachelor's,Computing & IT,Sep;May,2028,Open,36,15000,EUR,50,,12th,,65,,6,,,,,,,2026-10-01",
]


def test_the_demo_course_list_is_valid_and_sourced():
    text = (Path(__file__).parents[2] / "frontend/public/course-demo.csv").read_text(encoding="utf-8")
    rows, errors = parse_csv(text)
    assert not errors and rows and all(r["sourceUrl"] and r["checkedOn"] for r in rows)


async def test_explore_universities(make_api):
    admin = await make_api()
    await admin.staff_login("demo.admin@ahatin.example", "Admin@1234")
    student = await make_api()
    await student.student_login()

    async def find(**params):
        r = await student.get("/courses", params=params)
        assert r.status_code == 200, r.text
        return r.json()

    names = lambda body: [c["course"] for c in body["items"]]  # noqa: E731

    # Nothing to show until the team uploads the list.
    assert (await student.get("/courses/options")).json()["total"] == 0
    assert (await find())["total"] == 0

    # Only the admin uploads, and a file with any problem saves nothing.
    good = "\n".join([HEADER, *COURSES])
    assert (await student.post("/admin/courses/import", {"csv": good})).status_code == 403
    priya = await make_api()
    await priya.staff_login()
    assert (await priya.post("/admin/courses/import", {"csv": good})).status_code == 403
    assert (await priya.get("/courses")).status_code == 403
    r = await admin.post("/admin/courses/import", {"csv": "university,course\nA,B"})
    assert r.status_code == 400 and "Missing columns" in r.json()["errors"][0]["message"]
    bad = COURSES[0].replace("Master's", "Masters").replace("GBP", "XXX").replace("Sep;Jan", "Sept;Foo"), COURSES[1].replace("100,", "lots,", 1)
    r = await admin.post("/admin/courses/import", {"csv": "\n".join([HEADER, COURSES[0], *bad])})
    assert r.status_code == 400
    problems = r.json()["errors"][0]["message"]
    assert "Row 3: study_level" in problems and "Row 3: currency" in problems and "Row 3: intakes" in problems and "Row 4: application_fee" in problems
    assert (await student.get("/courses/options")).json()["total"] == 0
    r = await admin.post("/admin/courses/import", {"csv": "\n".join([HEADER, COURSES[0], COURSES[0]])})
    assert r.status_code == 400 and "already in the file" in r.json()["errors"][0]["message"]

    r = await admin.post("/admin/courses/import", {"csv": "\ufeff" + good})
    assert r.status_code == 200 and r.json()["total"] == 4, r.text
    assert (await admin.get("/admin/courses")).json()["total"] == 4
    options = (await student.get("/courses/options")).json()
    assert options["destinations"] == ["Germany", "Ireland", "United Kingdom"]
    assert options["levels"] == ["Bachelor's", "Master's"] and options["years"] == ["2027", "2028"] and options["intakes"] == ["Jan", "May", "Sep", "Oct"]

    # The details.
    first = next(c for c in (await find())["items"] if c["course"] == "MSc Computer Science")
    assert (first["status"], first["intakes"], first["durationMonths"], first["tuitionPerYear"], first["currency"], first["applicationFee"], first["avgScholarship"], first["level"]) == (
        "Open", ["Sep", "Jan"], 12, 20000, "GBP", 0, 3000, "Master's",
    )

    # Search.
    assert names(await find(destination="Germany")) == ["MSc Data Engineering"]
    assert names(await find(level="Bachelor's")) == ["BSc Computing"]
    assert set(names(await find(area="Business & Management"))) == {"MBA"}
    assert set(names(await find(intake="Jan"))) == {"MSc Computer Science"}
    assert set(names(await find(year="2028"))) == {"MSc Computer Science", "BSc Computing"}
    assert set(names(await find(q="engineering test university b"))) == {"MSc Data Engineering"}
    assert set(names(await find(destination="United Kingdom", intake="Sep", year="2027"))) == {"MSc Computer Science", "MBA"}

    # Sorting: featured first by default, then by QS ranking, with no ranking last.
    assert names(await find()) == ["MBA", "MSc Computer Science", "MSc Data Engineering", "BSc Computing"]
    assert names(await find(sort="qs")) == ["MSc Data Engineering", "MBA", "MSc Computer Science", "BSc Computing"]
    assert names(await find(sort="tuition")) == ["MSc Data Engineering", "BSc Computing", "MSc Computer Science", "MBA"]
    assert first["featured"] is True and first["qsRanking"] == 320
    assert (first["sourceUrl"], first["checkedOn"]) == ("https://example.org/a-cs", "2026-10-01")

    # Without an eligibility check, nothing is judged.
    assert (await find())["eligible"] is None and first["eligible"] is None

    # Eligibility: only what's entered is checked, and the reasons are given.
    body = await find(qualification="Bachelor's", ugPercent=65, hscPercent=60, backlogs=1, englishTest="IELTS", englishScore=6.5)
    by = {c["course"]: c for c in body["items"]}
    assert by["MSc Computer Science"]["eligible"] is True
    assert set(by["MBA"]["unmet"]) == {"Needs 70% in undergraduate", "Allows up to 0 backlogs", "Needs IELTS 7"}
    assert by["MSc Data Engineering"]["unmet"] == ["Needs 75% in undergraduate"]
    assert by["BSc Computing"]["unmet"] == ["Needs 65% in 12th"]
    assert body["eligible"] == 1 and body["total"] == 4 and body["universities"] == 3
    only = await find(qualification="Bachelor's", ugPercent=65, hscPercent=60, backlogs=1, englishTest="IELTS", englishScore=6.5, eligibleOnly="true")
    assert names(only) == ["MSc Computer Science"]
    # A lower qualification, and only one thing entered.
    assert "Needs Bachelor's or higher" in {c["course"]: c for c in (await find(qualification="12th"))["items"]}["MBA"]["unmet"]
    assert all(c["eligible"] for c in (await find(backlogs=0))["items"])
    # A test the course doesn't list isn't failed; no test at all is.
    assert {c["course"]: c for c in (await find(englishTest="PTE", englishScore=10))["items"]}["MBA"]["eligible"] is True
    assert "Needs an English test" in {c["course"]: c for c in (await find(englishTest="Not taken yet"))["items"]}["BSc Computing"]["unmet"][0]
    assert (await student.get("/courses", params={"ugPercent": 150})).status_code == 422

    # A university can't be featured or ranked on only some of its rows.
    r = await admin.post("/admin/courses/import", {"csv": "\n".join([HEADER, COURSES[0], COURSES[1].replace(",Yes,320", ",,320")])})
    assert r.status_code == 400 and "every row of a university" in r.json()["errors"][0]["message"]
    # The checked date is required and real, and the source is a web page.
    bad = [COURSES[3].replace(",2026-10-01", ",2099-01-01"), COURSES[3].replace("Test University C", "Test University D").replace(",,2026-10-01", ",ftp://x,2026-10-01"), COURSES[3].replace("Test University C", "Test University E").replace(",2026-10-01", ",")]
    r = await admin.post("/admin/courses/import", {"csv": "\n".join([HEADER, *bad])})
    problems = r.json()["errors"][0]["message"]
    assert r.status_code == 400 and "Row 2: checked_on can't be in the future" in problems
    assert "Row 3: source_url must be a web address" in problems and "Row 4: checked_on is required" in problems

    # Each upload replaces the list.
    assert (await admin.post("/admin/courses/import", {"csv": "\n".join([HEADER, COURSES[3]])})).json()["total"] == 1
    assert names(await find()) == ["BSc Computing"]


def test_the_scholarship_list_is_valid_and_sourced():
    rows = load_csv()
    assert len(rows) == 28 and all(r["sourceUrl"] and r["lastChecked"] and r["coverage"] and r["eligibility"] and r["howToApply"] for r in rows)


async def test_a_missing_scholarship_file_keeps_the_list_and_the_api_up(monkeypatch, tmp_path):
    from app import scholarship_catalog

    monkeypatch.setattr(scholarship_catalog, "CSV_PATH", tmp_path / "missing.csv")
    await scholarship_catalog.sync_scholarships()  # logged, not raised
    assert await get_db().scholarships.count_documents({}) == 28


async def test_home_page_scholarship_preview_is_public_and_basic(make_api):
    visitor = await make_api()  # not signed in
    r = await visitor.get("/scholarships/preview")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] == 28 and body["central"] > 0 and body["states"] > 0
    items = body["items"]
    assert len(items) == 6 and len({s["id"] for s in items}) == 6
    # A mix of kinds, not only central schemes.
    assert len({s["type"] for s in items}) >= 3
    # Only the basics: the details stay behind an account.
    for s in items:
        assert s["name"] and s["offeredBy"] and s["levels"]
        assert not {"coverage", "eligibility", "howToApply", "officialWebsite", "sourceUrl", "notes"} & s.keys()


async def test_explore_scholarships(make_api):
    student = await make_api()
    await student.student_login()

    async def page(**params):
        r = await student.get("/scholarships", params=params)
        assert r.status_code == 200, r.text
        return r.json()

    async def find(**params):
        """Every page of results, put together."""
        body = await page(**params)
        while len(body["items"]) < body["total"]:
            body["items"] += (await page(**params, offset=len(body["items"])))["items"]
        return body

    ids = lambda body: {s["id"] for s in body["items"]}  # noqa: E731

    # Five to a page.
    pages = [await page(offset=n) for n in range(0, 30, 5)]
    assert pages[0]["pageSize"] == 5 and len(pages[0]["items"]) == 5 and len(pages[-1]["items"]) == 3 and pages[0]["total"] == 28
    assert sum(len(p["items"]) for p in pages) == len(set().union(*(ids(p) for p in pages))) == 28

    # Staff other than admins don't browse it.
    priya = await make_api()
    await priya.staff_login()
    assert (await priya.get("/scholarships")).status_code == 403

    options = (await student.get("/scholarships/options")).json()
    assert options["total"] == 28 and options["states"][0] == "All India" and "Maharashtra" in options["states"]
    assert options["types"] == ["Central government", "State government", "International", "Trust"]
    assert "Interest subsidy" not in options["supportTypes"]

    # Every card has its details; nothing is judged without an eligibility check.
    everything = await find()
    assert everything["total"] == 28 and everything["eligible"] is None
    nos = next(s for s in everything["items"] if s["id"] == "nos-sc")
    assert nos["offeredBy"].startswith("Ministry of Social Justice") and nos["levels"] == ["Master's", "PhD"] and nos["coverage"][0] == "Tuition fees"
    assert nos["incomeLimitLakh"] == 8 and nos["needsOffer"] is True and "active" not in nos
    # Central schemes come first.
    assert everything["items"][0]["type"] == "Central government"

    # Filters. A group also brings the scholarships open to everyone.
    assert {s["state"] for s in (await find(state="Telangana"))["items"]} == {"Telangana"}
    st = await find(group="ST")
    assert "nos-st" in ids(st) and "commonwealth-uk" in ids(st) and "nos-sc" not in ids(st)
    assert all(s["supportType"] == "Low-interest loan" for s in (await find(support="Low-interest loan"))["items"])
    assert "rj-vivekananda" in ids(await find(level="Post-doctoral"))
    assert ids(await find(q="tata endowment")) == {"jn-tata-endowment"}

    # Eligibility: only what's entered is checked, with the reasons.
    body = await find(homeState="Telangana", category="SC", disability="false", studyLevel="Master's", incomeLakh=7, age=26, marks=65)
    by = {s["id"]: s for s in body["items"]}
    assert by["nos-sc"]["eligible"] is True
    assert by["ts-ambedkar-overseas"]["unmet"] == ["Family income up to ₹5 lakh"]
    assert by["mh-shahu-foreign"]["unmet"] == ["Only for students from Maharashtra"]
    assert by["nos-st"]["unmet"] == ["For ST students", "Family income up to ₹6 lakh"]
    assert by["nos-swd"]["unmet"] == ["For students with disabilities"]
    assert by["commonwealth-uk"]["eligible"] is True
    # The student's own state comes straight after the central schemes.
    assert [s for s in body["items"] if s["type"] != "Central government"][0]["state"] == "Telangana"
    only = await find(homeState="Telangana", category="SC", disability="false", studyLevel="Master's", incomeLakh=7, age=26, marks=65, eligibleOnly="true")
    assert only["total"] == body["eligible"] and all(s["eligible"] for s in only["items"])
    # Work experience, ranking and level.
    assert (await find(workYears=1))["items"] and {s["id"]: s for s in (await find(workYears=1))["items"]}["fulbright-nehru-masters"]["unmet"] == ["Needs 3 years of work experience"]
    assert {s["id"]: s for s in (await find(qsRank=350))["items"]}["mh-sarthi"]["unmet"] == ["University must be in the QS top 200"]
    assert "Not for Undergraduate study" in {s["id"]: s for s in (await find(studyLevel="Undergraduate"))["items"]}["nos-sc"]["unmet"]
    assert (await student.get("/scholarships", params={"marks": 150})).status_code == 422


async def test_english_score_report_is_only_on_request(make_api):
    student = await make_api()
    await student.register_student("Nina Rao", "nina.rao@example.com", "9811133344")
    record = (await student.get("/me/record")).json()["record"]
    assert [d["name"] for d in record["documents"]] == ["Passport (first and last page)", "Degree certificate", "Academic transcripts", "Updated CV"]
    # The counsellor asks for it when it is needed.
    admin = await make_api()
    await admin.staff_login("demo.admin@ahatin.example", "Admin@1234")
    r = await admin.post(f"/students/{record['id']}/documents", {"name": "English test score report"})
    assert r.status_code == 200, r.text
    assert "English test score report" in [d["name"] for d in r.json()["documents"]]


async def test_career_and_university_selection_are_one_stage(make_api):
    from app.domain import SERVICE_AREA, SERVICE_TITLES

    assert list(SERVICE_TITLES) == ["S1", "S3", "S4", "S5", "S6", "S7"] and set(SERVICE_AREA) == set(SERVICE_TITLES)
    staff = await make_api()
    await staff.staff_login()
    assert (await staff.put("/students/s1/overrides/S2", {"status": "completed", "reason": "No longer a stage"})).status_code == 404
    r = await staff.put("/students/s1/overrides/S1", {"status": "completed", "reason": "Handled outside the portal"})
    assert r.status_code == 200 and r.json()["journey"]["overrides"]["S1"]["status"] == "completed"


async def test_profile_highest_qualification_is_the_12th(make_api):
    api = await make_api()
    await api.student_login("new.student@ahatin.example")
    school = {
        **{k: v for k, v in PROFILE.items() if not k.startswith(("ssc", "institution", "graduation", "grade"))},
        "degree": "12th / HSC", "degreeSubject": "", "institution": "", "graduationYear": "", "grade": "",
        "hscYear": "2026",
    }
    # Its details are the 12th's, so those are required.
    for field in ("hscCollege", "hscYear", "hscBoard"):
        assert (await api.put("/me/profile", {**school, field: ""})).status_code == 422, field
    assert (await api.put("/me/profile", {**school, "hscYear": str(today().year + 2)})).status_code == 200  # still studying
    r = await api.put("/me/profile", school)
    assert r.status_code == 200, r.text
    mine = (await api.get("/me/record")).json()
    p = mine["profile"]
    assert mine["profileComplete"] is True
    # The rest of the app reads them as the highest qualification.
    assert (p["degree"], p["institution"], p["graduationYear"], p["grade"], p["degreeSubject"]) == ("12th / HSC", "Demo Junior College", "2026", "82%", "Science (PCM)")
    # The 10th can be added; it must come before the 12th.
    assert (await api.put("/me/profile", {**school, "sscBoard": "CBSE", "sscYear": "2024"})).status_code == 200
    assert (await api.put("/me/profile", {**school, "sscBoard": "CBSE", "sscYear": "2026"})).status_code == 422


async def test_new_student_shows_for_counsellor_until_opened(make_api):
    student = await make_api()
    await student.register_student("Nina Rao", "nina@example.com", "9811133333")
    assert (await student.put("/me/profile", PROFILE)).status_code == 200  # assigned to Priya automatically
    sid = (await student.get("/me/record")).json()["record"]["id"]

    priya = await make_api()
    await priya.staff_login()
    mine = {x["id"]: x for x in (await priya.get("/students")).json()}
    assert mine[sid]["newForCounsellor"] is True and mine[sid]["counsellorAssignedAt"]
    assert mine["s1"]["newForCounsellor"] is False  # assigned before this was recorded
    # Someone else opening the record doesn't count.
    admin = await make_api()
    await admin.staff_login("demo.admin@ahatin.example", "Admin@1234")
    assert (await admin.get(f"/students/{sid}")).json()["newForCounsellor"] is True
    # The counsellor opens it: no longer new.
    assert (await priya.get(f"/students/{sid}")).json()["newForCounsellor"] is False
    assert {x["id"]: x for x in (await priya.get("/students")).json()}[sid]["newForCounsellor"] is False
    # Reassigned: new again for the next counsellor.
    r = await admin.post(f"/students/{sid}/reassign", {"counsellorId": "c3", "reason": "Neha knows Germany well"})
    assert r.status_code == 200 and r.json()["newForCounsellor"] is True


async def test_document_is_verified_only_after_being_opened(make_api, bucket):
    student = await make_api()
    await student.student_login()
    pdf = b"%PDF-1.4 cv" + b"." * (60 * 1024)
    up = (await student.post("/students/s1/documents/d8/upload-url", {"fileName": "cv.pdf", "contentType": "application/pdf", "size": len(pdf)})).json()
    bucket.put_url(up["url"], pdf)
    assert (await student.post("/students/s1/documents/d8/upload-complete", {"uploadId": up["uploadId"]})).status_code == 200

    priya = await make_api()
    await priya.staff_login()
    r = await priya.post("/students/s1/documents/d8/verify")
    assert r.status_code == 400 and "Open the document" in r.json()["detail"]
    # Someone else opening it doesn't count for Priya.
    admin = await make_api()
    await admin.staff_login("demo.admin@ahatin.example", "Admin@1234")
    assert (await admin.get("/students/s1/documents/d8/download-url")).status_code == 200
    assert (await priya.post("/students/s1/documents/d8/verify")).status_code == 400
    # Priya opens it, then verifies.
    assert (await priya.get("/students/s1/documents/d8/download-url")).status_code == 200
    doc = next(d for d in (await priya.get("/students/s1")).json()["documents"] if d["id"] == "d8")
    assert "c1" in doc["viewedBy"]
    assert (await priya.post("/students/s1/documents/d8/verify")).status_code == 200
    # Verified documents can still be opened by the student's team.
    assert (await admin.get("/students/s1/documents/d8/download-url")).status_code == 200


async def _notes(api):
    r = await api.get("/staff/notifications")
    assert r.status_code == 200, r.text
    return r.json()


async def test_staff_notifications(make_api, bucket):
    student = await make_api()
    await student.student_login()
    priya = await make_api()
    await priya.staff_login()
    assert await _notes(priya) == []
    # Only staff have them.
    assert (await student.get("/staff/notifications")).status_code == 403

    # Booking a session.
    d, slot = await _free_slot("c1")
    r = await student.post("/sessions", {"type": "Application review", "date": d, "time": slot["time"], "mode": slot["modes"][0]})
    assert r.status_code == 200, r.text
    [booked] = await _notes(priya)
    assert booked["kind"] == "session" and booked["path"] == "/staff/schedule" and "\n" not in booked["text"]

    # Someone else can't read Priya's notifications.
    rohan = await make_api()
    await rohan.staff_login("rohan.k@ahatin.example")
    assert await _notes(rohan) == []
    await rohan.post(f"/staff/notifications/{booked['id']}/read")
    assert len(await _notes(priya)) == 1
    # Marked as read: gone.
    assert (await priya.post(f"/staff/notifications/{booked['id']}/read")).status_code == 204
    assert await _notes(priya) == []

    # Two messages in a chat are one notification, showing the latest; reading the chat clears it.
    await student.post("/messages", {"text": "First question"})
    await student.post("/messages", {"text": "Second question"})
    [message] = await _notes(priya)
    assert message["kind"] == "message" and message["text"] == "Second question" and message["path"] == "/staff/students/s1#messages"
    await priya.post("/messages/read", {"studentId": "s1"})
    assert await _notes(priya) == []

    # An upload is notified; dealing with the document clears it.
    pdf = b"%PDF-1.4 sample cv" + b"." * (60 * 1024)
    up = (await student.post("/students/s1/documents/d8/upload-url", {"fileName": "cv.pdf", "contentType": "application/pdf", "size": len(pdf)})).json()
    bucket.put_url(up["url"], pdf)
    assert (await student.post("/students/s1/documents/d8/upload-complete", {"uploadId": up["uploadId"]})).status_code == 200
    [upload] = await _notes(priya)
    assert upload["kind"] == "document"
    assert (await priya.get("/students/s1/documents/d8/download-url")).status_code == 200  # opened before rejecting
    assert (await priya.post("/students/s1/documents/d8/reject", {"reason": "Please send a clearer copy"})).status_code == 200
    assert await _notes(priya) == []

    # Mark all as read.
    await student.post("/messages", {"text": "Third question"})
    assert (await student.put("/me/profile", PROFILE)).status_code == 200
    assert len(await _notes(priya)) == 2
    assert (await priya.post("/staff/notifications/read-all")).status_code == 204
    assert await _notes(priya) == []

    # Reassigned: the new counsellor is told (opening the record reads it) and the old one's stop.
    await student.post("/messages", {"text": "Fourth question"})
    assert len(await _notes(priya)) == 1
    admin = await make_api()
    await admin.staff_login("demo.admin@ahatin.example", "Admin@1234")
    assert (await admin.post("/students/s1/reassign", {"counsellorId": "c2", "reason": "Testing it"})).status_code == 200
    assert await _notes(priya) == []
    [assigned] = await _notes(rohan)
    assert assigned["kind"] == "assigned" and assigned["path"] == "/staff/students/s1"
    assert (await rohan.get("/students/s1")).status_code == 200
    assert await _notes(rohan) == []


async def test_notifications_reach_officers_and_admins(make_api):
    student = await make_api()
    await student.student_login()
    officer = await get_db().users.find_one({"role": "finance_officer"})
    await get_db().students.update_one({"_id": "s1"}, {"$set": {"financeOfficerId": officer["_id"]}})
    r = await student.post("/students/s1/funding/sources", {"kind": "Savings", "amount": 5})
    assert r.status_code == 200, r.text
    kavya = await make_api()
    await kavya.staff_login(officer["email"])
    [funding] = await _notes(kavya)
    assert "funding plan" in funding["title"]
    # Staff changing it themselves don't notify anyone.
    await kavya.post("/staff/notifications/read-all")
    assert (await kavya.post("/students/s1/funding/sources", {"kind": "Loan", "amount": 5})).status_code == 200
    assert await _notes(kavya) == []

    # A student nobody can take waits for the admin, who is told.
    await get_db().users.update_many({"role": "counsellor"}, {"$set": {"status": "inactive"}})
    newcomer = await make_api()
    await newcomer.register_student("Mira Joshi", "mira.joshi@example.com", "9811100099")
    assert (await newcomer.put("/me/profile", PROFILE)).status_code == 200
    admin = await make_api()
    await admin.staff_login("demo.admin@ahatin.example", "Admin@1234")
    [waiting] = await _notes(admin)
    assert waiting["path"] == "/admin/assign" and "waiting for a counsellor" in waiting["text"]

