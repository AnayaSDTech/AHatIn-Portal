# Portal update: complete profile, counsellor matching and specialist officers

This document describes three planned changes to the student portal:

1. Students must complete their profile before their journey starts.
2. Only the admin assigns a counsellor to each student, based on the student's profile.
3. A Financial Aid Officer looks after Scholarship & Financial Guidance, then a Visa Officer looks after Visa Assistance, Pre-Departure Support and Post-Arrival Support.

All three changes are built. Decisions are summarised at the end.

---

## 1. Complete profile first

### Today
After registering or logging in, the student goes straight to their dashboard. The profile can be filled in at any time, and a "Complete your profile" notification reminds them. They can book sessions and use every part of the portal straight away.

### Planned
Until a student's profile is complete, the **Complete your profile** form opens every time they register or log in. They can close it, but their journey does not start until the profile is complete.

### How it works
1. **After registering**, the student goes straight to the profile form, with a short welcome explaining why the details are needed.
2. **After logging in**, a student whose profile is still incomplete is shown the same form.
3. **Closing the form** takes the student to their dashboard, where they can look around, but their progress does not start:
   - A banner at the top of every page says "Complete your profile to start your journey", with a **Complete profile** button.
   - The progress tracker shows only one step, "Complete your profile", and its buttons open the profile form.
   - **Booking a session** opens a message asking them to complete their profile first, with a button to open the form. No session can be booked until the profile is complete.
4. **Saving** keeps what they have entered, even if it is not complete yet. Once the profile is complete, the form no longer opens at login, the banner disappears, and the student joins the admin's "Waiting for a counsellor" list (section 2). From then on the profile can be edited from **My profile** as today.
5. **Changes to study plans.** When a student later changes their course of interest, preferred destination or preferred intake, their counsellor is notified by email and the change is recorded in the student's history.

### What counts as complete
These are the fields the profile form already requires:

| Section | Required |
|---|---|
| Personal | Date of birth, city |
| Education and tests | Highest qualification, college or university, grade, English test (and the score, if a test has been taken) |
| Study plans | Course of interest, preferred destination, preferred intake, budget |

Work experience stays optional. The passport number is added later by staff, as today.

The same check is made by the server, so a student with an incomplete profile cannot book a session or be assigned a counsellor, even through a direct request.

---

## 2. Admin assigns each student's counsellor

### Today
A student is given a counsellor automatically when they register (the counsellor with the fewest students), or keeps the counsellor whose registration link they used. Website enquiries are given to a counsellor automatically (the one with the fewest open enquiries).

### Planned
- **Only the admin** assigns a counsellor to a student. Nothing is assigned automatically.
- The assignment is **based only on the student's profile**, so the admin assigns only once the profile is complete.
- Students register **from the website only**. Counsellors no longer send registration links.
- **Website enquiries are handled by the admin.**

### How it works
1. **Registration.** The student registers on the website and is asked to complete their profile (section 1).
2. **Profile complete.** The student joins the admin's **"Waiting for a counsellor"** list. Students with an incomplete profile are not on this list; the admin can see them separately as "Profile incomplete" and send a reminder.
3. **Matching.** When the admin opens a waiting student, the portal suggests counsellors ranked by how well they match the student's profile, with the reasons shown.
4. **Assignment.** The admin chooses the counsellor. The student is emailed and sees their counsellor on the dashboard. The counsellor is emailed and the student appears in their list.
5. **Counselling starts.** The student can now book sessions with their counsellor, who shares the career plan and continues with the shortlist and applications.

### What the student sees in the first step

| Situation | Progress tracker |
|---|---|
| Profile incomplete | "Complete your profile to start your journey" (button opens the profile) |
| Profile complete, no counsellor yet | "We're matching you with a counsellor who knows {preferred destination}. We'll email you when they're assigned." Booking is not available yet |
| Counsellor assigned | "{Counsellor} will share your career plan" (book a session) |
| Career plan shared | Completed |

### Website enquiries
- New enquiries from the website go to the **admin's enquiry list**. Counsellors do not see unassigned enquiries.
- **The admin handles enquiries** for now: contacting the person, logging each contact and moving the enquiry through its stages.
- Instead of sending a registration link, the admin asks the person to **register on the website**.
- **When the person registers** with the same email, the enquiry is marked **Registered** and linked to the new student, so its contact history is kept.
- **Later option.** The admin can assign an enquiry to a counsellor, who then follows it up and sees it in their list. This does not decide the student's counsellor: once they register and complete their profile, the student still goes through the admin's matching. The admin sees who handled the enquiry when assigning.
- Each new enquiry creates a follow-up for the admin, so none is left waiting.

### Counsellor profiles (for matching)
Each counsellor has a profile kept up to date by the admin. It is used only for matching and is not shown to students:

| Field | Example |
|---|---|
| Countries with experience | United Kingdom (6 years), Ireland (2 years) |
| Universities studied at | University of Leeds (MSc, alumnus) |
| Subject areas | Computing & IT, Business |
| Languages | English, Hindi, Marathi |
| Capacity | 40 active students |

Students continue to see only what they see today: the counsellor's name, email and phone.

### Matching score
The score uses only the student's profile. The portal suggests; the admin always decides. These are the starting weights, which can be adjusted later:

| Factor | Compared with | Weight |
|---|---|---|
| Country | Student's preferred destination vs. the counsellor's countries (more years scores higher) | 50% |
| Subject | Student's course of interest vs. the counsellor's subject areas | 30% |
| Spare capacity | The counsellor's active students vs. their capacity (counsellors at capacity are flagged, not hidden) | 20% |

The counsellor's universities and languages are shown beside each suggestion to help the admin choose, but do not change the score.

---

## 3. Specialist officers for funding, visa and travel

### Today
The counsellor handles all seven services, from Career Counselling to Post-Arrival Support.

### Planned
The student's journey is handed over in three parts. Each handover starts when the previous part is complete, and the admin chooses the next person:

| Part | Services | Looked after by | Assigned when |
|---|---|---|---|
| 1 | Career Counselling, University & Country Selection, Application Assistance | **Counsellor** | The student's profile is complete (section 2) |
| 2 | Scholarship & Financial Guidance | **Financial Aid Officer** | Application Assistance is complete (the student has accepted an offer) |
| 3 | Visa Assistance, Pre-Departure Support, Post-Arrival Support | **Visa Officer** | Scholarship & Financial Guidance is complete (proof of funds verified, or marked "Not needed") |

### How it works
1. **Application Assistance complete.** When the student accepts an offer, the admin is notified by email and a task on their Today page, and the student joins the **"Waiting for a Financial Aid Officer"** list.
2. **The admin assigns a Financial Aid Officer**, seeing each officer's current workload. The student and the officer are emailed, and the officer appears on the student's dashboard.
3. **Scholarship & Financial Guidance.** The Financial Aid Officer sets the estimated cost, suggests scholarships, and checks the funding plan and the proof-of-funds documents.
4. **Scholarship & Financial Guidance complete.** When every proof-of-funds document is verified (or the service is marked "Not needed"), the admin is notified again and the student joins the **"Waiting for a Visa Officer"** list.
5. **The admin assigns a Visa Officer**, who then looks after the visa stages and visa documents, the pre-departure checklist and "ready to travel" confirmation, the post-arrival check-ins and the final check-in.
6. **While a student waits** for an officer, their progress tracker shows "We're assigning your Financial Aid Officer" (or Visa Officer), so they always know where things stand.

### Who does what

| Person | Responsible for | Can see |
|---|---|---|
| Counsellor | Services 1–3, and remains the student's main contact throughout | Everything for their students; services 4–7 are **read-only** for them once an officer is assigned |
| Financial Aid Officer | Service 4: estimated cost, funding plan, scholarships, proof-of-funds documents | Their assigned students only |
| Visa Officer | Services 5–7: visa, pre-departure, post-arrival | Their assigned students only |
| Admin | Website enquiries; assigning counsellors and officers; overseeing all work | Everything |

Each officer gets their own tasks: proof-of-funds documents to verify go to the Financial Aid Officer; visa documents, visa follow-ups and arrival check-ins go to the Visa Officer.

### Messages
Each student has a **separate chat with each person** looking after them: their counsellor, their Financial Aid Officer and their Visa Officer. On the student's Messages page each chat is listed by name and role, with its own unread count. Each staff member sees only their own chats with the student.

### Sessions
Students book each kind of session with the person responsible for it, using that person's free times:

| Session type | With |
|---|---|
| Career counselling, Application review | Counsellor |
| Scholarship & funding | Financial Aid Officer |
| Visa preparation, Pre-departure briefing, Post-arrival check-in | Visa Officer |

Officers can also book sessions on the student's behalf, and each manages their own availability and time off in the Schedule page.

### Settled points
- **Visa timing.** The Visa Officer is assigned once Scholarship & Financial Guidance is complete (this can be revisited, e.g. to assign one when the CAS arrives).
- **Students who don't need funding help.** If Scholarship & Financial Guidance is marked "Not needed", the student goes straight to "Waiting for a Visa Officer"; no Financial Aid Officer is assigned.
- **Counsellor after handover.** The counsellor keeps their chat with the student and can view services 4–7, but cannot change them.
- **Students already under way.** Until an officer is assigned, the counsellor can still act on services 4–7, so students who started before officers existed are not blocked.

---

## Changes for everyone

- **Admin.** Handles all website enquiries. New lists on the Overview: "Profile incomplete", "Waiting for a counsellor", "Waiting for a Financial Aid Officer", "Waiting for a Visa Officer" and new website enquiries. Each student gets a Team panel for assigning and reassigning staff.
- **Staff accounts.** Two new roles: Financial Aid Officer and Visa Officer. Each has their own Today page, student list, schedule and messages. The existing Application officer role stays as it is.
- **Counsellors.** See only the students the admin has assigned to them (and any enquiry the admin assigns to them later). The "Send registration link" option is removed. Get an email when a new student is assigned, and when one of their students changes their study plans.
- **Students.** Register on the website, complete their profile to start their journey, then see their counsellor and, once assigned, their officers on the dashboard, each with their own chat.
- **Records.** Every assignment and change is kept in the student's history and the audit log.
- **Existing students.** Students who already have a counsellor keep them. Existing students with an incomplete profile see the profile prompt at their next login, but keep their counsellor and any booked sessions. Students who have already accepted an offer appear in "Waiting for a Financial Aid Officer"; those whose funding is already complete appear in "Waiting for a Visa Officer".
- **Existing registration links.** Links already sent by counsellors stop working and show a message asking the person to register on the website.

---

## Decisions

| Topic | Decision |
|---|---|
| Incomplete profile | The form opens at every registration and login; it can be closed, but the journey does not start and sessions cannot be booked until the profile is complete |
| Profile changes | The counsellor is notified when a student changes their study plans |
| Counsellor assignment | Only the admin assigns, based only on the student's profile, and only once the profile is complete |
| Initial consultation | No separate consultation before assignment; the first session is with the assigned counsellor |
| Registration | From the website only; counsellors no longer send registration links |
| Website enquiries | Handled by the admin; the admin can assign an enquiry to a counsellor later, but this does not decide the student's counsellor |
| Matching weights | Country 50%, subject 30%, spare capacity 20%; can be adjusted later |
| What students see about counsellors | No change for now (name, email, phone) |
| Financial Aid Officer | Looks after Scholarship & Financial Guidance; assigned by the admin when Application Assistance is complete (offer accepted) |
| Visa Officer | Looks after Visa Assistance, Pre-Departure Support and Post-Arrival Support; assigned by the admin when Scholarship & Financial Guidance is complete |
| Messages | Separate chats with each person |
| Officer sessions | Students can book with officers, and officers can book on their behalf |
| Officer assignment | Always chosen by the admin |
| Counsellor access after handover | Read-only for services 4–7; stays the student's main contact |
| Admin notifications | Email and a Today task when Application Assistance is complete, and again when Scholarship & Financial Guidance is complete |
| Existing Application officer role | Kept as it is (sees every student's record, no enquiries) |
