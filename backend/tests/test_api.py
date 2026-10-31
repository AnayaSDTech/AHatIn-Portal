"""End-to-end API tests against a real MongoDB (database ahat_test)."""

import os
from datetime import timedelta

from app.config import get_settings
from app.core.clock import today
from app.core.security import hash_password
from app.db import get_db
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
        "workExperience": "", "courseInterest": "MSc Finance", "destination": "Ireland", "intake": "January 2028", "budget": "₹15–25 lakh",
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
    "intake": "September 2027", "budget": "₹25–35 lakh",
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
    aditya = await make_api()
    await aditya.staff_login("aditya.r@ahatin.example")
    assert (await aditya.post("/students/s2/visa", {"stage": "documents_verified"})).status_code == 200
    assert (await aditya.put("/students/s2/funding/estimated-cost", {"lakh": 20})).status_code == 403

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
    assert Settings(app_env="development").show_demo_codes("anyone@gmail.com")
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


async def test_full_student_journey(make_api, bucket):
    """One new student from registration to the final post-arrival check-in, through every hand-over.
    With JOURNEY_SNAPSHOTS set, the student's view at each step is saved there (to check the dashboard's status rules)."""
    import json

    db = get_db()
    snapshots = []
    pdf = b"%PDF-1.4 journey" + b"." * (60 * 1024)

    student = await make_api()
    await student.register_student("Journey Tester", "journey@example.com", "9811188888")
    sid = (await student.get("/me/record")).json()["record"]["id"]
    admin, priya, kavya, aditya = [await make_api() for _ in range(4)]
    await admin.staff_login("demo.admin@ahatin.example", "Admin@1234")
    await priya.staff_login()
    await kavya.staff_login("kavya.i@ahatin.example")
    await aditya.staff_login("aditya.r@ahatin.example")

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
    assert (await aditya.post(f"/students/{sid}/visa", {"stage": "cas_received"})).status_code == 200
    await snap("CAS received")
    rec = (await aditya.post(f"/students/{sid}/documents", {"name": "Visa photograph", "category": "visa"})).json()
    visa_doc = doc_named(rec, "Visa photograph")["id"]
    await upload(visa_doc)
    assert (await kavya.post(f"/students/{sid}/documents/{visa_doc}/verify")).status_code == 403
    assert (await aditya.get(f"/students/{sid}/documents/{visa_doc}/download-url")).status_code == 200  # opened before verifying
    assert (await aditya.post(f"/students/{sid}/documents/{visa_doc}/verify")).status_code == 200
    for stage in ("documents_verified", "fees_paid"):
        assert (await aditya.post(f"/students/{sid}/visa", {"stage": stage})).status_code == 200
    assert (await aditya.post(f"/students/{sid}/visa", {"stage": "submitted", "reference": "GWF012345678"})).status_code == 200
    rec = await snap("Visa submitted")
    assert rec["stage"] == "visa_filed" and await open_follow_up(f"visa:{sid}:submitted")
    assert (await aditya.post(f"/students/{sid}/visa", {"stage": "biometrics"})).status_code == 200
    assert (await aditya.post(f"/students/{sid}/visa", {"stage": "granted"})).status_code == 200
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
    assert (await aditya.post(f"/students/{sid}/departure/confirm")).status_code == 400  # tasks left
    for key in tasks[3:]:
        assert (await student.put(f"/students/{sid}/departure/tasks/{key}", {"done": True})).status_code == 200
    await snap("Pre-departure tasks done")
    assert (await priya.post(f"/students/{sid}/departure/confirm")).status_code == 403
    assert (await aditya.post(f"/students/{sid}/departure/confirm")).status_code == 200
    await snap("Ready to travel")

    # 7. Post-arrival Support: the student confirms arrival, the Visa Officer records the final check-in.
    assert (await student.post(f"/students/{sid}/arrival")).status_code == 200
    rec = await snap("Arrived")
    assert rec["stage"] == "arrived"
    assert await db.follow_ups.find_one({"sourceEvent": f"arrival:{sid}", "counsellorId": "u7", "done": False})
    assert (await aditya.post(f"/students/{sid}/final-check-in", {"note": "Settled in well, classes started."})).status_code == 200
    rec = await snap("Final check-in")
    assert rec["stage"] == "settled" and not await open_follow_up(f"arrival:{sid}")

    # Nothing is left waiting for the admin, and each person looking after the student can open the record.
    queue = (await admin.get("/admin/assignments")).json()
    assert sid not in {s["id"] for k in ("waiting", "waitingFinance", "waitingVisa") for s in queue[k]}
    for api in (priya, kavya, aditya):
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

