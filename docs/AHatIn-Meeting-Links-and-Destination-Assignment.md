# AHatIn Portal — Meeting Links and Destination-Based Assignment

Implementation plan · October 2026

This document explains how to add two features, first to the demo app and then to the real portal:

1. **Counsellor meeting links:** each counsellor saves one Google Meet link in their profile, admins can set or correct it, and every **Join** button uses it.
2. **Assignment by destination:** new students and website enquiries go automatically to a counsellor who covers the destination they chose, instead of only to the counsellor with the lightest workload.

Both features share one new idea: a **counsellor profile** holding the counsellor's meeting link, the destinations they cover and how many students they can take on.

---

## 1. Counsellor profile (shared by both features)

| Field | Type | Who can change it | Purpose |
| --- | --- | --- | --- |
| Meeting link | Text (Google Meet address) | Counsellor (own) and admin | Used by every Join button and in booking emails |
| Phone | Text | Counsellor (own) and admin | Shown to the counsellor's students |
| Destinations covered | List: `uk`, `europe` | Admin only | Used to assign new students and enquiries |
| Taking new students | Yes / No | Admin only | Set to No during long leave or when fully booked |
| Maximum active students | Number (e.g. 40) | Admin only | Stops one counsellor being overloaded |
| Last updated | Date and person | System | Audit trail |

Destinations and capacity are business decisions, so only admins change them. Counsellors can see them on their profile but not edit them.

---

## 2. Feature 1: Counsellor meeting links

### 2.1 What people see

| Who | Where | What changes |
| --- | --- | --- |
| Counsellor | New **My profile** page in the staff menu | Paste or change their Google Meet link and phone. Shows their destinations and capacity (read-only). A **Test link** button opens the link in a new tab. |
| Admin | **Staff users** page | An **Edit** action on each counsellor to set the meeting link, phone, destinations, "taking new students" and capacity. |
| Student | Dashboard → My sessions | **Join** opens their counsellor's link in a new tab. |
| Counsellor | Today and Schedule pages | **Join** on an online session opens their own link. |
| Student and counsellor | Booking, reschedule and reminder emails | The link appears in the email and in the calendar invite (`.ics`). |

### 2.2 Rules

1. **Valid link only:** the link must look like `https://meet.google.com/abc-defg-hij` (letters in a 3-4-3 pattern). Anything else shows: "Paste the Google Meet link from your Google Calendar event, like https://meet.google.com/abc-defg-hij."
2. **When Join appears:** only for **online** sessions with status *Booked*, from **10 minutes before the start until the scheduled end**. Before that, the button shows the time ("Opens at 15:50"). Office sessions show the office address instead.
3. **Missing link:**
   - The counsellor sees a warning on Today and My profile: "Add your meeting link so students can join online sessions."
   - Students see "Your counsellor will share the meeting link before the session" instead of Join.
   - Admins see a "No meeting link" label next to that counsellor in Staff users.
4. **Changing the link:** applies at once to every future session. Past sessions keep the link they used, for the record.
5. **Audit:** every change is logged with who made it, when, and the old and new link.
6. **Privacy:** the link is shown only to the counsellor, their own students (for booked online sessions), anyone covering for them, and admins. It's never shown on public pages.

### 2.3 Demo implementation

The demo currently keeps counsellors in a fixed list in `src/data/staff.ts`, so nothing can be edited. The changes:

| Step | File(s) | Change |
| --- | --- | --- |
| 1 | `src/data/staff.ts` | Turn the fixed `counsellors` list into seed data with the new profile fields (`meetingLink`, `phone`, `destinations`, `acceptingNew`, `maxActiveStudents`, `updatedAt`, `updatedBy`). |
| 2 | `src/hooks/useStaffData.ts` | Add `useCounsellors()`, backed by the shared demo store (collection `counsellors`), so a change made by the counsellor or admin shows everywhere immediately. |
| 3 | Pages and components that read `counsellors` or `counsellorName` (Leads, Students, Student record, Schedule, Staff users, Admin overview, Dashboard, session components, enquiry logic) | Read from `useCounsellors()` instead of the fixed list. Outside React (e.g. `src/lib/enquiry.ts`), use `readShared('counsellors', …)`. |
| 4 | `src/lib/validation.ts` | Add a `meetLinkSchema` with the rule in 2.2. |
| 5 | New `src/pages/staff/ProfilePage.tsx`; route `/staff/profile` in `src/App.tsx`; "My profile" in both menus in `StaffLayout.tsx` | Profile form (meeting link and phone), read-only destinations and capacity, Test link button, success message. |
| 6 | `src/pages/admin/StaffUsersPage.tsx` | Edit modal for counsellors with all profile fields; "No meeting link" label. |
| 7 | New helper `joinState(session, now)` in `src/lib/scheduling.ts` | Returns `hidden`, `opens_at` (with the time) or `open`, following rule 2. |
| 8 | `src/components/dashboard/SessionsCard.tsx` and `src/components/scheduling/SessionManage.tsx` | Join uses `joinState` and opens the counsellor's saved link with `window.open(link, '_blank', 'noopener')`. Seed links are placeholders, so for those the demo keeps showing a message instead of opening a broken page. |
| 9 | Settings → Reset demo data | Already clears shared collections, so it also restores the seed counsellor profiles. |

### 2.4 Real portal (FastAPI + MongoDB)

**Data:** add a `counsellor_profile` sub-document to each counsellor's `staff_users` record:

```json
{
  "meeting_link": "https://meet.google.com/abc-defg-hij",
  "phone": "+91 98000 11111",
  "destinations": ["uk", "europe"],
  "accepting_new": true,
  "max_active_students": 40,
  "updated_at": "2026-12-01T10:15:00Z",
  "updated_by": "<staff user id>"
}
```

**API:**

| Method and path | Who | Purpose |
| --- | --- | --- |
| `GET /api/v1/staff/me/profile` | Counsellor | Read own profile |
| `PATCH /api/v1/staff/me/profile` | Counsellor | Change own `meeting_link` and `phone` only; other fields are rejected |
| `PATCH /api/v1/admin/staff/{id}/profile` | Admin | Change any profile field |
| `GET /api/v1/students/me/sessions` | Student | Each online session includes `join_url` only while `joinState` is `open`; otherwise `join_opens_at` |

**Backend rules:**
- Validate the link with the same pattern on the server (Pydantic); never trust the browser alone.
- Write an `audit_log` entry for each change, with old and new values.
- When building booking, reschedule and reminder emails, read the counsellor's **current** link. Store the link used on the session record when the session is completed, for history.
- The `.ics` calendar invite puts the link in both `LOCATION` and `DESCRIPTION`, so it shows in every calendar app.

### 2.5 Checks before release

- An invalid link is rejected with the friendly message, on screen and through the API.
- A counsellor can't change their destinations or capacity, and can't edit another counsellor's profile.
- Join is hidden until 10 minutes before the start, opens the right link during the session, and disappears after the end.
- Office sessions never show Join.
- A changed link appears straight away on the student's dashboard and in the next email.
- Students only ever see their own counsellor's link.

---

## 3. Feature 2: Assignment by destination

### 3.1 How a counsellor is chosen

The same rules are used for **new student registrations** and **new website enquiries** (leads).

1. **Find eligible counsellors:** active accounts that are *taking new students*, have **not reached their maximum**, and are **not on full-day time off today**.
2. **Match the destination:**
   - Student chose **UK** → counsellors covering `uk`.
   - Student chose **Europe** → counsellors covering `europe`.
   - Student chose **Not sure yet** → all eligible counsellors.
3. **Pick by workload:** the counsellor with the **fewest open records** (active students for registrations, open leads for enquiries).
4. **Break ties fairly:** if loads are equal, the one who was **assigned least recently** gets it (round robin).
5. **No match:** if nobody fits (e.g. the only Europe counsellor is full or on leave), the record goes to **Unassigned**, and every admin gets a follow-up: "Assign a counsellor to [name] within 2 working hours."
6. **Record why:** every automatic assignment saves a reason, shown in the assignment history, e.g. "Automatic: covers UK, lowest workload (12 open leads)."

**What does not change automatically:**
- A lead who registers keeps the same counsellor.
- A repeat enquiry with a different destination doesn't move the person. The counsellor gets a note ("Now also interested in Europe") and an admin can reassign if needed.
- Changing a counsellor's destinations later doesn't move their existing students. Admins reassign by hand, with a reason, as they do today.

### 3.2 What people see

| Who | Where | What changes |
| --- | --- | --- |
| Admin | Staff users → Edit counsellor | Destinations covered (UK, Europe), taking new students, maximum active students |
| Admin | Leads and Students | New **Unassigned** filter with a count; an **Assign** button on each unassigned record |
| Admin | Overview | "Unassigned" count, and counsellor workload shown against each counsellor's maximum |
| Counsellor | My profile | Their destinations and capacity (read-only) |
| Counsellor / admin | Student record and lead details | The assignment reason in the history |
| Visitor / student | Enquiry thank-you message and dashboard | Unchanged when a counsellor is found. When unassigned: "Our team will call you within working hours." |

### 3.3 Demo implementation

| Step | File(s) | Change |
| --- | --- | --- |
| 1 | `src/data/staff.ts` | Give each seed counsellor destinations and capacity, e.g. Priya: UK; Rohan: Europe; Neha: UK and Europe; all taking new students, maximum 40. |
| 2 | New `src/lib/assignment.ts` | One function, `chooseCounsellor({ destination, kind, counsellors, students, leads, timeOff, now })`, returning `{ counsellorId, reason }` or `{ counsellorId: null, reason }`. It follows 3.1 exactly and is the only place the rules live. |
| 3 | `newStudentRecord()` in `src/data/staff.ts` | Use `chooseCounsellor` with `kind: 'student'` instead of "fewest students". |
| 4 | `submitEnquiry()` in `src/lib/enquiry.ts` | Use `chooseCounsellor` with `kind: 'lead'`. If no one is found, create the lead as unassigned and add admin follow-ups. |
| 5 | Types in `src/data/staff.ts` | Allow `counsellorId` to be empty (`''`) for unassigned records; add `lastAssignedAt` to counsellor profiles for the round robin. |
| 6 | `useStaffScope()` in `src/hooks/useStaffData.ts` | Counsellors never see unassigned records; admins do. |
| 7 | `LeadsPage.tsx`, `StudentsPage.tsx`, `AdminOverviewPage.tsx` | Unassigned filter, count and Assign action (reusing the existing reassign dialog, with the reason required). |
| 8 | `DashboardPage.tsx`, `ProfileCard`, `SessionsCard`, `BookSessionModal` | Handle a student with no counsellor yet: show "We're assigning your counsellor" and disable booking until one is assigned. |

### 3.4 Real portal (FastAPI + MongoDB)

- **One assignment service** on the backend (`services/assignment.py`), called by the registration and enquiry endpoints. The frontend never chooses the counsellor.
- **Avoid two records grabbing the last free place at once:** run the choice and the write in a MongoDB transaction, or keep an `open_count` per counsellor and update it with a conditional `find_one_and_update` (only if `open_count < max_active_students`).
- **Indexes:** `students (counsellor_id, stage)` and `leads (counsellor_id, stage)` for fast workload counts.
- **Settings collection:** keep the destination list (`uk`, `europe`) and the unassigned follow-up time limit in admin settings, so they can change without new code.
- **Audit:** store `assignment_history` entries (`at`, `by: "system" | staff id`, `from`, `to`, `reason`) on the student or lead, as the demo already does for manual reassignment.
- **Later extension:** destinations can become individual countries (`uk`, `de`, `ie`, `fr`) without changing the rules, only the list.

### 3.5 Checks before release

- A UK enquiry goes to a UK counsellor, and a Europe enquiry to a Europe counsellor, even when another counsellor has fewer leads.
- "Not sure yet" goes to the lightest-loaded eligible counsellor.
- A full, on-leave or "not taking new students" counsellor is skipped.
- With equal loads, consecutive records alternate between counsellors.
- No eligible counsellor → the record is unassigned, admins get a follow-up, and counsellors can't see it.
- The admin's Assign action needs a reason and is recorded in the history.
- Every automatic assignment shows its reason.
- An unassigned student sees a clear message and can't book a session yet.

---

## 4. Suggested order of work

1. **Counsellor profile data and the shared `useCounsellors()` hook** (section 1 and steps 1–3 of 2.3). Both features depend on it.
2. **Meeting links:** My profile page, admin edit, then the Join buttons.
3. **Assignment:** `chooseCounsellor`, then registrations and enquiries, then the Unassigned views.
4. **Tests:** the checks in 2.5 and 3.5, plus a re-run of the existing demo tests (login, roles, scheduling, enquiry), since many pages switch to the new counsellor data.

## 5. Decisions to confirm

| Question | Suggested answer |
| --- | --- |
| Can counsellors change their own meeting link? | Yes; admins can also change it |
| Who sets destinations and capacity? | Admins only |
| Default maximum active students per counsellor | 40, adjustable per counsellor |
| How early does Join open? | 10 minutes before the start |
| Where do "Not sure yet" students go? | Any eligible counsellor, by workload |
| How fast must admins assign unassigned records? | Within 2 working hours |
