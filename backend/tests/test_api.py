"""End-to-end API tests against a real MongoDB (database ahat_test)."""

from datetime import timedelta

from app.core.clock import today
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


async def test_wrong_otp_counts_attempts(make_api):
    api = await make_api()
    await api.post("/auth/otp/request", {"email": "demo.student@ahatin.example"})
    r = await api.post("/auth/otp/verify", {"email": "demo.student@ahatin.example", "code": "000000"})
    assert r.status_code == 400
    assert "4 attempts left" in r.json()["detail"]
    r = await api.post("/auth/otp/request", {"email": "demo.student@ahatin.example"})
    assert r.status_code == 429  # resend too soon


async def test_unknown_email_gets_same_answer(make_api):
    api = await make_api()
    r = await api.post("/auth/otp/request", {"email": "nobody@example.com"})
    assert r.status_code == 200 and "demoCode" not in r.json() and r.json()["expiresIn"] == 600


async def test_csrf_required(make_api):
    api = await make_api()
    await api.student_login()
    r = await api.c.post("/api/v1/messages", json={"text": "hi"})  # no CSRF header
    assert r.status_code == 403


async def test_register_creates_record_without_counsellor(make_api):
    api = await make_api()
    r = await api.post("/auth/register", {"name": "Riya Kapoor", "email": "riya@example.com", "mobile": "+919812345678", "consent": True})
    assert r.status_code == 200, r.text
    code = r.json()["demoCode"]
    r = await api.post("/auth/otp/verify", {"email": "riya@example.com", "code": code})
    assert r.status_code == 200
    rec = (await api.get("/me/record")).json()["record"]
    assert rec["destination"] == "Not decided" and rec["intake"] == "To be decided"  # not asked at registration
    assert rec["counsellorId"] is None  # the admin assigns one once the profile is complete
    assert len(rec["documents"]) == 5 and rec["reference"].startswith("AH-")
    r = await api.post("/auth/register", {"name": "Riya Kapoor", "email": "riya@example.com", "mobile": "9812345678", "consent": True})
    assert r.status_code == 409


async def test_register_validation(make_api):
    api = await make_api()
    r = await api.post("/auth/register", {"name": "R", "email": "bad", "mobile": "12345", "consent": False})
    assert r.status_code == 422
    fields = {e["field"] for e in r.json()["errors"]}
    assert {"name", "email", "mobile", "consent"} <= fields


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
    pdf = b"%PDF-1.4 sample cv" + b"." * (60 * 1024)  # within 50-200 KB
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

    fatima_user = {"_id": "fatima-user", "role": "student", "name": "Fatima Sheikh", "email": "fatima.s@example.com", "mobile": "+919811130003", "status": "active", "emailVerifiedAt": "x"}
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
        "dateOfBirth": "2002-01-05", "city": "Mumbai", "degree": "B.Com", "institution": "Demo College", "grade": "72%", "englishTest": "IELTS", "englishScore": "7",
        "workExperience": "", "courseInterest": "MSc Finance", "destination": "Ireland", "intake": "January 2028", "budget": "₹15–25 lakh",
    }
    r = await api.put("/me/profile", {**profile, "englishScore": "7.3"})
    assert r.status_code == 422
    r = await api.put("/me/profile", profile)
    assert r.status_code == 200
    rec = (await api.get("/me/record")).json()
    assert rec["record"]["goal"] == "MSc Finance" and rec["record"]["destination"] == "Ireland" and rec["profile"]["city"] == "Mumbai"


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
    "dateOfBirth": "2001-01-15", "city": "Pune", "degree": "B.Tech Computer Science", "institution": "Demo Institute", "grade": "8.1 CGPA",
    "englishTest": "IELTS", "englishScore": "7", "workExperience": "", "courseInterest": "MSc Artificial Intelligence", "destination": "United Kingdom",
    "intake": "September 2027", "budget": "₹25–35 lakh",
}


async def test_profile_gate_and_admin_assignment(make_api):
    db = get_db()
    # An earlier website enquiry with the same email is linked when the person registers.
    web = await make_api()
    enquiry = {"name": "Dev Rao", "email": "dev@example.com", "mobile": "9811199999", "destination": "uk", "intake": "2027-09", "course": "MSc AI", "callTime": "", "message": "", "consent": True, "website": ""}
    assert (await web.post("/enquiries", enquiry)).json()["kind"] == "new"

    student = await make_api()
    code = (await student.post("/auth/register", {"name": "Dev Rao", "email": "dev@example.com", "mobile": "9811199999", "consent": True})).json()["demoCode"]
    assert (await student.post("/auth/otp/verify", {"email": "dev@example.com", "code": code})).status_code == 200
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


async def test_matching_profile_admin_only(make_api):
    admin = await make_api()
    await admin.staff_login("demo.admin@ahatin.example", "Admin@1234")
    body = {"countries": [{"country": "Germany", "years": 2}], "universities": ["RWTH Aachen"], "subjects": ["engineering"], "languages": ["German"], "capacity": 25}
    r = await admin.put("/admin/staff/c2/matching-profile", body)
    assert r.status_code == 200 and r.json()["capacity"] == 25
    assert (await admin.put("/admin/staff/c2/matching-profile", {**body, "subjects": ["astrology"]})).status_code == 422
    assert (await admin.put("/admin/staff/u5/matching-profile", body)).status_code == 400  # officers aren't matched
    profiles = (await admin.get("/admin/counsellors/matching")).json()
    assert next(p for p in profiles if p["id"] == "c2")["matchingProfile"]["universities"] == ["RWTH Aachen"]
    counsellor = await make_api()
    await counsellor.staff_login()
    assert (await counsellor.get("/admin/assignments")).status_code == 403


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
    """Documents must be between 50 KB and 200 KB."""
    api = await make_api()
    await api.student_login()
    for size, ok in ((20, False), (50 * 1024 - 1, False), (50 * 1024, True), (200 * 1024, True), (200 * 1024 + 1, False), (5 * 1024 * 1024, False)):
        r = await api.post("/students/s1/documents/d8/upload-url", {"fileName": "f.pdf", "contentType": "application/pdf", "size": size})
        assert (r.status_code == 200) == ok, (size, r.text)
        if not ok:
            assert "between 50 KB and 200 KB" in r.json()["detail"]


def test_demo_codes_and_production_checks():
    from app.config import Settings

    prod = dict(app_env="production", session_secret="x" * 40, otp_pepper="y" * 40, field_encryption_key="k", cookie_secure=True, s3_bucket="b")
    s = Settings(**prod, demo_logins=True)
    s.check_production()  # complete production settings start fine
    assert s.show_demo_codes("demo.student@ahatin.example") and s.show_demo_codes("Kavya.I@AHATIN.example")
    assert not s.show_demo_codes("real.student@gmail.com")  # real people get codes by email only
    assert not Settings(**prod).show_demo_codes("demo.student@ahatin.example")  # DEMO_LOGINS off
    assert Settings(app_env="development").show_demo_codes("anyone@gmail.com")
    import pytest

    with pytest.raises(RuntimeError, match="SESSION_SECRET.*COOKIE_SECURE"):
        Settings(**{**prod, "session_secret": "dev-session-secret-change-me", "cookie_secure": False}).check_production()
