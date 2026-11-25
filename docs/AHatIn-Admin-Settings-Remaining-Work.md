# AHat Admin Portal: Settings, Remaining Work in Phases

**Status as of:** 25 November 2026
**Area:** Admin portal → Settings (and the student and staff portal behaviour it controls)
**Constraint:** no new features for now. Every solution reuses what the portals already have (follow-ups, staff alerts, emails, the audit log and the Settings page), with no new screens, roles or data collections.

---

## 1. Where Settings stands today

The Settings page has four panels. Admins can now edit three of them; staff see the same values read-only.

| Panel | Editable by admins | What the system does with it |
| --- | --- | --- |
| **Working hours** (days, opening and closing time, IST) | Yes | "Working day" deadlines skip days off and count only working time. New-enquiry due times use it. |
| **Quiet hours** (start and end, may run past midnight) | Yes | Non-urgent emails to students are held until quiet hours end. Login codes and other urgent emails are sent straight away. |
| **Follow-up rules** (time limits only) | Yes, for seven limits | First reply to a new enquiry (minutes); out-of-hours reply time on the next working day; "contacted, no session booked" (hours); "plan shared, not registered" (hours, added in Task 2.1); document check (working days); check-in after a student confirms arrival (days, added in Task 2.2); deadline reminder days (e.g. 14, 7, 2). |
| **Staff security** | No, by design | 2-step verification is always required. Idle sign-out (30 minutes) and maximum session (12 hours) stay in the server configuration. |

How the editable settings work:
- **Storage:** saved as one record in the database. Anything never saved uses the original values (Monday–Saturday 10:00–19:00, quiet hours 21:00–08:00, 15 minutes, 11:00, 48 hours, 1 working day, 14/7/2 days).
- **Audit:** every change is logged with the before and after values and who made it.
- **Effect:** new follow-ups use the new values. Follow-ups already in staff lists keep their due times.
- **Reach:** every server and the background worker pick up a change within about 30 seconds.
- **Staff are told:** when an admin changes a time limit or working hours, the staff it affects get a notification and an email saying what changed, e.g. "Plan shared, not registered: follow up within 24 hours (was 48 hours)". Lead rules go to counsellors (and the other admins); student rules and working hours go to all counsellors, officers and the other admins. Quiet hours changes aren't announced, as they only affect emails to students.
- **ⓘ info icons for staff:** on the Leads page, an ⓘ beside the stage filters lists what to do at each stage and by when, and an ⓘ beside a lead's stage shows that stage's rule. In the Today task list, each task has an ⓘ showing the rule it was created under and its exact due time. They open on hover or keyboard focus, and on tap on phones, and always show the current values from Settings.
- **Validation:** bad values are refused with a message. Examples: a working day shorter than an hour; quiet hours that start and end at the same time; an out-of-hours reply time outside working hours.

**Release status:** built and tested (all 63 backend tests pass; checked in a browser against the test database). It is **not live yet**; that's part of Phase 1.

### What is still unfinished

The follow-up rules table lists some rules the system doesn't carry out, and a few smaller issues remain. They're grouped into four phases below.

| Phase | Goal | Tasks | Size |
| --- | --- | --- | --- |
| **1** | Safety and release | 1.1 Demo data reset safeguard · 1.2 Put editable settings live | Small |
| **2** | Make the Settings page accurate | 2.1 Plan follow-up rule · 2.2 Arrival rule · 2.3 Overdue alerts in IST | Small |
| **3** | Complete the follow-up rules | 3.1 Second lead follow-up and cold-lead alert · 3.2 Deadline reminders to everyone · 3.3 Reply deadline for student messages | Small to medium |
| **4** | Public hours and more editable limits | 4.1 Office hours from Settings · 4.2 More editable limits | Small |

Each phase can be released on its own, in this order.

---

## 2. How every phase is built and checked

These apply to all four phases:
- **Tests:** each task adds backend tests. All existing tests must still pass.
- **Safe testing:** browser checks run against the **test database (ahat_e2e)**, never the live database.
- **Existing work isn't disturbed:** new rules apply to **new** follow-ups only; follow-ups already in staff lists keep their due times.
- **Release:** a phase that changes the backend needs a **Render redeploy**; one that changes the website or portals needs a **Hostinger zip** upload. Each phase below says which.
- **After every release:** a short check on the live site, listed in each phase.

---

## 3. Phase 1: Safety and release

**Goal:** remove the risk of wiping live data, and put the editable settings live.

### Task 1.1: Demo data reset safeguard

**Today:**
- The Settings page shows **Reset demo data** whenever the backend runs in development mode.
- The reset replaces leads, students, sessions, availability, time off and temporary access with demo data.
- A developer's local backend runs in development mode but is connected to the **live** database. So the button is visible locally, and one click would wipe live data.
- The live site on Render runs in production mode, so the button is hidden and blocked there.

**Solution:**
- **Backend:** allow the reset only when the database is a local or test one, for example a local MongoDB or a database name ending in `_test` or `_e2e`, **in addition to** development mode. Otherwise return "not found", as production does today.
- **Settings page:** only show the button when the backend reports that the reset is allowed.

**Effect on the portals:** none for students or staff. It removes the risk of wiping live data.

**Tests:** the reset is refused when the database is the live one, even in development mode, and still works on the test database.

### Task 1.2: Put the editable settings live

1. **Backend:** redeploy on Render. Until then, the live Settings page stays read-only, with the original values.
2. **Frontend:** build the Hostinger zip and upload it.

**Release:** Render redeploy and Hostinger zip.

**Check after release:**
- an admin can edit each of the three panels, and a counsellor sees no Edit buttons;
- change a value, check the rules table updates, then set it back;
- the audit log shows the change;
- **Reset demo data** doesn't appear on a locally run portal connected to the live database.

**Phase 1 is done when:** the editable settings are live, and the reset can't run against the live database.

---

## 4. Phase 2: Make the Settings page accurate

**Goal:** every row in the follow-up rules table describes what the system really does. Mostly wording, plus one time zone fix.

### Task 2.1: "Assessment done: share the plan within 24 hours"

**Status:** built on 25 November 2026, not released yet. The row now reads "Plan shared, not registered → Follow up → 48 hours → Manager alerted", and the hours are editable on the Settings page. The lead stage "Assessed / plan shared" is unchanged.

**Today:**
- There's no separate "assessment done" moment for a lead. The stage after **Assessment booked** is **Assessed / plan shared**, so marking it means the plan is already shared.
- On that stage change, the system creates "Follow up on shared plan", due in **48 hours**.

**Solution:** make the rule describe what the system does, rather than add a new step.
- Change the row to: **"Plan shared, not registered" → "Follow up" → 48 hours → Manager alerted**.
- Add the 48 hours to the **editable** follow-up limits, saved the same way as the others.

**Effect on the portals:** none in behaviour. The page becomes accurate, and admins can change the 48 hours.

**Tests:** marking a lead "Assessed / plan shared" creates the follow-up with the saved number of hours.

### Task 2.2: "Planned arrival: confirm safe arrival within 24 hours"

**Status:** built on 25 November 2026, not released yet. The row now reads "Student confirms safe arrival → Check in with the student → 7 days → Manager alerted", and the days are editable on the Settings page. The staff task now reads "Check in after arrival (7 days)".

**Today:**
- The **Pre-departure** stage has a checklist of six tick-boxes: accommodation, flight, insurance, money, briefing and documents. **No travel or arrival date** is recorded.
- In **Post-arrival**, the student taps **"I've arrived safely"**. The Visa Officer (or the counsellor covering) is then emailed, and gets a follow-up for a **1-week check-in**.
- The officer later records a final check-in, which closes it.
- The "planned arrival, 24 hours" rule needs a planned date, which doesn't exist.

**Solution:** make the rule describe what the system does.
- Change the row to: **"Student confirms safe arrival" → "1-week check-in" → 7 days → Manager alerted**.
- Make the 7 days editable.

**Effect on the portals:** none in behaviour; the page becomes accurate.

**Tests:** the arrival follow-up uses the saved number of days.

### Task 2.3: Overdue alerts show UTC instead of IST

**Status:** built on 26 November 2026, not released yet. Overdue alerts to managers now read, for example, "was due 25 Nov 2026, 15:00 IST".

**Today:** the email to managers about an overdue follow-up shows the due time in **UTC**. A task due at 15:00 IST reads "09:30", which is confusing.

**Solution:** show the due time in business time, as "25 Nov 15:00 IST", using the existing business time zone setting.

**Effect on the portals:** managers' emails show the correct local time.

**Tests:** the email text shows the IST time.

**Release:** Render redeploy and Hostinger zip (the edit form gains two limits).

**Check after release:** the rules table shows the two reworded rows. An overdue follow-up email (on the test database) shows IST.

**Phase 2 is done when:** no row in the rules table promises something the system doesn't do, apart from the three rows Phase 3 completes.

---

## 5. Phase 3: Complete the follow-up rules

**Goal:** carry out the remaining rules fully, using the existing follow-ups, staff alerts and emails.

### Task 3.1: "Contacted, no session booked": 48 hours, then 7 days, cold-lead alert

**Status:** built on 26 November 2026, not released yet. The row now reads "48 hours, then 7 days → Manager alerted after 3 unanswered tries", and both times are editable. "Not interested" ends the follow-ups, and reaching the lead again starts them over.

**Today:**
- When staff log the first **Reached** contact with a new lead, the lead moves to **Contacted**, and a follow-up "Book an assessment session" is created, due in 48 hours (editable).
- That follow-up closes when the lead reaches **Assessment booked**.
- Nothing happens after it. There's no 7-day follow-up and no counting of failed attempts.
- There's no Nurture stage; lead stages are New lead, Contacted, Assessment booked and Assessed.

**Solution:**
1. **Second follow-up:** when staff log a contact on a **Contacted** lead and the lead still has no session booked, close the current "Book an assessment session" follow-up. Then create the next one, due **7 days** later.
2. **Counting failed tries:** each logged contact is already stored in the lead's activity with its outcome. Count the contacts with **No answer**, **Call back later** or **Wrong number** since the lead was contacted.
3. **After 3 failed tries:** no further follow-ups are created. The managers (admins) get an alert and email: "*Name*: 3 unanswered contact attempts. Consider reassigning or closing." This uses the existing admin email and staff alerts.
4. **Rules table:** make the row read "*48 hours, then 7 days*" with "If missed: **Manager alerted after 3 unanswered tries**". Make the 7 days editable, like the 48 hours.

**Effect on the portals:**
- **Staff:** a counsellor's **Today** list shows the 7-day follow-up after the 48-hour one.
- **Managers:** alerted when a lead goes cold.
- **Students:** none, since leads aren't students yet.

**Tests:** 48-hour then 7-day follow-ups; the third failed attempt stops follow-ups and alerts admins; booking an assessment closes everything.

### Task 3.2: Deadline reminders: "remind student and staff", "manager alerted"

**Status:** built on 26 November 2026, not released yet. Students are now emailed about application deadlines, and managers are alerted about scholarship deadlines on the last reminder day.

**Today:**
- A background job runs every hour and checks each reminder day (14, 7 and 2 days before, editable).
- **Applications** still in draft: the staff owner gets a follow-up, and **managers are emailed on the last reminder day**, but the **student isn't emailed**.
- **Scholarships** still "to apply": the Financial Aid Officer (or the counsellor covering) gets a follow-up and the **student is emailed**, but **managers aren't alerted** on the last reminder day.

**Solution, using the existing email helpers:**
- **Applications:** also email the student on each reminder day: "*University* application deadline in *N* days." This uses the existing student email, so quiet hours apply. Each reminder is sent once.
- **Scholarships:** on the last reminder day, also email the managers, as applications already do.

**Effect on the portals:**
- **Students:** they get application deadline emails, and their dashboard already shows the deadlines.
- **Managers:** alerted for both kinds of deadline.

**Tests:** for both kinds, the student is emailed on each reminder day and admins on the last one, with no duplicates when the job runs again.

### Task 3.3: Reply deadline for student messages (replaces "Urgent support message: 2 hours")

**Status:** built on 26 November 2026, not released yet. The row now reads "Student message → Reply → 1 working day → Manager alerted", and the working days (1–5) are editable. With Tasks 3.1 and 3.2, Phase 3 is complete.

**Today:**
- Students message their counsellor, Financial Aid Officer or Visa Officer in separate chats.
- Each student message gives the staff member an in-portal alert and an email (at most one email per chat per hour).
- There's **no urgency flag** and **no reply deadline**, so nothing reaches managers if a message goes unanswered.

**Solution, using existing follow-ups:**
- **Each new student message** (when there isn't already one waiting) creates a follow-up for that chat's staff member: **"Reply to *Name*'s message"**, due in **1 working day** (editable).
- **Replying closes it.** When the staff member replies in that chat, the follow-up closes automatically.
- **If it isn't answered in time,** the existing overdue process alerts the managers.
- **Rules table:** the row becomes **"Student message" → "Reply" → 1 working day → Manager alerted**.

**Effect on the portals:**
- **Staff:** unanswered messages appear in their **Today** list with a deadline.
- **Students:** they get faster, tracked replies, with no change to their screens.

**Tests:** a student message creates one follow-up per chat; a staff reply closes it; an overdue one alerts admins.

**Release:** Render redeploy and Hostinger zip (the edit form gains two limits).

**Check after release (on the test database first):**
- a contacted lead gets the 48-hour then 7-day follow-ups, and 3 failed tries alert the admins;
- deadline reminders reach students and admins;
- a student message appears in the staff member's Today list, and a reply clears it.

**Phase 3 is done when:** every row in the rules table is carried out by the system.

---

## 6. Phase 4: Public hours and more editable limits

**Goal:** working hours changed on the Settings page show everywhere, and the remaining fixed deadlines become editable.

### Task 4.1: Office hours shown to the public follow Settings

**Status:** built on 26 November 2026, not released yet. The website footer, Enquiry section, both call-back confirmations (the enquiry form and the chatbot's form) and the chatbot's answers now use the working hours from Settings, e.g. "Mon–Sat, 10:00–19:00 IST".

**Today:** "Mon–Sat, 10:00–19:00 IST" is fixed text in:
- the website footer and Enquiry section;
- the enquiry confirmation message ("We'll call you within working hours");
- the website chatbot's knowledge.

If an admin changes working hours, these stay as they are.

**Solution:**
- **Website:** add a small public, read-only address to the backend that returns the working days and hours, and show them in those places. Keep the fixed text as a fallback if the backend can't be reached.
- **Chatbot:** build its "Hours" line from the saved working hours when it answers.

**Effect on the portals:** the website and chatbot always show the hours set on the Settings page.

**Tests:** after changing working hours, the public hours and the chatbot's hours line show the new values.

### Task 4.2: More follow-up limits editable

**Status:** built on 26 November 2026, not released yet. Both are editable and shown as rows in the rules table: "Student ready for a counsellor or officer → Assign one (admin) → 1 working day" and "Session booked → Email the student a reminder → 24 hours before". With this, all four phases are built.

These deadlines are used by the system but still fixed:

| Deadline | Fixed value |
| --- | --- |
| Assign a counsellor or officer after a stage is complete | 1 working day |
| Session reminder to students | the day before (24 hours) |

**Solution:** add each to the same saved settings and the follow-up edit form, with sensible limits (for example 1–10 working days, 1–72 hours). They work exactly like the limits already editable.

**Release:** Render redeploy and Hostinger zip.

**Check after release:** change working hours on the test database and check the website footer, Enquiry section, confirmation message and chatbot. Edit the two new limits and check new follow-ups and reminders use them.

**Phase 4 is done when:** all business deadlines and office hours come from the Settings page.

---

## 7. Not included (would be new features)

These came up in the review but need new screens or data, so they're left for later:
- A **Nurture** stage for leads, with an automatic move after 3 failed tries and a way to reopen (Phase 3, Task 3.1 alerts managers instead).
- A **planned arrival date** on the travel checklist, with a "confirm safe arrival" follow-up 24 hours after it (Phase 2, Task 2.2 rewords the rule instead).
- An **"Urgent"** option on student messages, with a 2-hour any-day deadline and an immediate manager alert (Phase 3, Task 3.3 adds a working-day reply deadline instead).
- **Lead management:**
  - a **Closed / lost** lead stage with a reason;
  - **unassigning** a lead back to the admin;
  - **automatic emails to leads**: a registration link, and assessment details with a meeting link. Staff currently send these themselves.
- **Editable security settings** (idle sign-out, maximum session). These are kept in the server configuration on purpose.
