# AHatIn Student Portal — Software Requirements Specification (SRS)

**Prepared for:** The portal development team, testers and AHatIn's business reviewer
**Date:** 21 October 2026
**Version:** 2.0

---

## 1. Introduction

This SRS defines how the portal software must behave: features, validations, user permissions, security, performance and error handling. Every requirement is testable.

| Convention | Meaning |
| --- | --- |
| `FR-…` | Functional requirement |
| `NFR-…` | Non-functional requirement |
| `VAL-…` | Validation rule |
| Must / Should / Could / Later | Needed at launch / soon after / if time allows / during 2027 |
| Times | Stored in UTC, shown in IST unless stated |
| Money | Stored as whole minor units (paise, pence, cents) with a currency code |

| Term | Meaning |
| --- | --- |
| Lead | Someone who has enquired but not registered |
| Student | A registered client |
| Staff | Counsellor, officer or admin |
| Stage | One of the 13 steps a student moves through, New lead to Settled |
| Service | One of AHatIn's seven services (S1–S7) shown in the tracker |
| Follow-up rule | A trigger, required action, time limit and escalation (e.g. contact a new enquiry within 15 minutes) |
| Checklist template | An admin-defined list of items, used for documents, visa, pre-departure and post-arrival |

---

## 2. Users and access

| Role | Logs in with | Can see |
| --- | --- | --- |
| Student | One-time code (email, SMS or WhatsApp) | Own records |
| Parent | One-time code | Linked students' progress and fees |
| Counsellor | AHatIn Google account with 2-step verification | Assigned leads and students |
| Officer | AHatIn Google account with 2-step verification | Assigned students |
| Admin | AHatIn Google account with 2-step verification | Everything |

**Supported browsers:** latest two versions of Chrome, Edge, Safari and Firefox; Chrome on Android 10+; Safari on iOS 16.4+.

---

## 3. Functional requirements

### 3.1 Login and sessions

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-AUTH-01 | One-time codes are 6 digits, valid for 10 minutes, single-use, with at most 5 attempts | Must |
| FR-AUTH-02 | Codes can be resent after 60 seconds; max 5 per hour per user and 20 per hour per IP address | Must |
| FR-AUTH-03 | The login screen gives the same reply whether or not an account exists | Must |
| FR-AUTH-04 | Staff log in only with Google accounts from AHatIn's domain that are active staff users | Must |
| FR-AUTH-05 | Staff sessions end after 30 minutes idle or 12 hours; student and parent sessions after 7 days idle or 30 days | Must |
| FR-AUTH-06 | Users can log out of one device or all devices; deactivating a user ends their sessions within 1 minute | Must |
| FR-AUTH-07 | After login, users return to the page they were trying to open | Must |

### 3.2 Users

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-USR-01 | Admins create, edit and deactivate staff and assign one role | Must |
| FR-USR-02 | Students are created only by registration; parents only by linking to a student | Must |
| FR-USR-03 | Users are never deleted, only deactivated | Must |
| FR-USR-04 | Admins can set counsellor capacity and grant temporary access to another counsellor's students | Should |

### 3.3 Enquiries and CRM

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-LEAD-01 | The website form sends enquiries to a public endpoint with contact details, interests, consent, campaign tags and page address | Must |
| FR-LEAD-02 | Enquiries without consent, failing the spam check (Cloudflare Turnstile or hidden field) or over 5 a minute / 30 an hour per IP are rejected | Must |
| FR-LEAD-03 | Only AHatIn's website domain may call the public endpoint from a browser | Must |
| FR-LEAD-04 | Staff can add enquiries from other channels; the source is required | Must |
| FR-LEAD-05 | An enquiry matching an existing mobile number or email is added to that record, not duplicated; admins can merge records, keeping the earliest source | Must |
| FR-LEAD-06 | New enquiries are assigned by admin rules (country, level), then in turn among counsellors with capacity | Must |
| FR-LEAD-07 | An acknowledgement is sent within 1 minute | Must |
| FR-LEAD-08 | Source and campaign fields can't be changed after creation | Must |
| FR-LEAD-09 | Staff can search and filter by name, mobile, email, reference, stage, counsellor, source and intake | Must |
| FR-LEAD-10 | A 0–100 readiness score is calculated and kept up to date | Should |

### 3.4 Tasks and follow-ups

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-TSK-01 | Staff can create tasks with type, due time, assignee and linked person | Must |
| FR-TSK-02 | The system creates tasks from each follow-up rule, counting only working hours where the rule says so; admins can edit rules, working hours and holidays | Must |
| FR-TSK-03 | Overdue tasks are checked every minute; the assignee and a manager are alerted and the breach recorded | Must |
| FR-TSK-04 | Each staff member has a "Today" list: overdue, due today, upcoming | Must |
| FR-TSK-05 | Logging a contact attempt (channel, outcome, notes) completes or reschedules the task | Must |
| FR-TSK-06 | After 3 unanswered attempts, the system suggests moving the lead to Nurture | Must |
| FR-TSK-07 | Nurture and On hold need a future date (which creates a task); Lost needs a reason from a list | Must |
| FR-TSK-08 | Automated nurture message sequences | Could |

### 3.5 Students and parents

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-STU-01 | A counsellor sends a registration link, valid for 7 days | Must |
| FR-STU-02 | Registration needs a verified email or mobile and acceptance of the current terms, privacy notice and commission disclosure; the version, time and IP are stored | Must |
| FR-STU-03 | Under-18s complete registration only after a linked parent accepts too | Must |
| FR-STU-04 | Registration activates the login, sends a welcome message and moves the stage to Registered client | Must |
| FR-STU-05 | Name, date of birth and passport number lock once used in a submitted application; staff can change them with a reason | Must |
| FR-STU-06 | Each student has one counsellor, optionally one officer, and a reference like `AH-2026-00042` | Must |
| FR-STU-07 | Profile completeness is shown as a percentage with missing items | Should |
| FR-PAR-01 | Up to 3 parents per student; a parent can be linked to several students | Should |
| FR-PAR-02 | Parents have read-only access to the tracker, applications, visa and fees, and can pay fees | Should |
| FR-PAR-03 | Students aged 18+ can remove a parent link; the parent is notified | Should |

### 3.6 Counselling and shortlist

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-CNS-01 | Counsellors record sessions; notes are staff-only unless marked "share with student" | Must |
| FR-CNS-02 | Counsellors record the assessment, career goals and recommended course areas with reasons | Must |
| FR-CNS-03 | Publishing the plan to the student moves the stage to Assessed / plan shared | Must |
| FR-CNS-04 | Students book 30- or 60-minute slots; a calendar event with a video link is created, with reminders 24 hours and 1 hour before; a slot can't be booked twice | Should |
| FR-CNS-05 | Students and parents message their counsellor in one thread per student | Should |
| FR-UNI-01 | Each shortlist option needs a reason; the commission flag is shown automatically | Must |
| FR-UNI-02 | Approval locks the shortlist version; any change creates a new version needing approval | Must |
| FR-UNI-03 | Applications can only be created from an approved shortlist option | Must |
| FR-UNI-04 | Admins manage universities, courses, intakes, countries and which agencies cover each university | Should |
| FR-UNI-05 | Course search by country, level, subject, intake, fees and test requirements; compare up to 4 countries | Should |
| FR-UNI-06 | Public course feed for the website widget, refreshed every 15 minutes | Could |

### 3.7 Partner agencies

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-AGY-01 | Admins manage agencies: contacts, agreement dates, coverage, commission share, payment terms, status; agreements stored as admin-only files | Must |
| FR-AGY-02 | When creating an application, only active agencies with a valid agreement covering that university are offered | Must |
| FR-AGY-03 | Agency records never store passwords or credentials | Must |
| FR-AGY-04 | Admins are warned 30 days before an agreement expires; agency performance report | Should |

### 3.8 Applications

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-APP-01 | Each application records the route (partner agency or own application) and its references | Must |
| FR-APP-02 | Status changes follow Appendix A; invalid changes are rejected | Must |
| FR-APP-03 | "Submitted" needs a date, a reference and all required documents verified | Must |
| FR-APP-04 | Offers record conditions (pending, met, waived), scholarship, and expiry | Must |
| FR-APP-05 | Only one offer per intake can be accepted; staff are prompted to close the others | Must |
| FR-APP-06 | Deposits and CAS / admission letters are recorded with documents | Must |
| FR-APP-07 | SOP, LOR and CV drafts keep versions, comments and an "approved" flag | Must |
| FR-APP-08 | Every status change notifies the student and parents | Must |
| FR-APP-09 | Side-by-side offer comparison | Should |

### 3.9 Scholarships and funding

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-FIN-01 | Scholarship applications record provider, amount, deadline, status and amount awarded | Must |
| FR-FIN-02 | Cost estimates have line items in any currency, totalled in that currency and INR | Must |
| FR-FIN-03 | INR conversion uses an admin-set rate, shown with its date next to every total | Must |
| FR-FIN-04 | Funding plans list sources and show the gap automatically | Must |
| FR-FIN-05 | Proof-of-funds needs record amount, account holder and holding dates | Must |
| FR-FIN-06 | Every financial screen shows "Guidance only. This is not regulated financial advice." | Must |
| FR-FIN-07 | Scholarship catalogue with matching; loan referral tracking | Later (Mar 2027) |

### 3.10 Visa

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-VISA-01 | Accepting an offer creates a visa record and checklist for that country and visa type | Must |
| FR-VISA-02 | The funds check shows Pass or Shortfall against the proof-of-funds need | Must |
| FR-VISA-03 | "Filed" needs a funds Pass (or admin override with reason), a recorded form review and the visa fee paid | Must |
| FR-VISA-04 | A refusal needs a reason and next step, and sets the student to Visa refused | Must |
| FR-VISA-05 | Mock-interview feedback | Should |

### 3.11 Checklists and documents

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-CHK-01 | Admins manage checklist templates (documents, visa, pre-departure, post-arrival) by country, level and visa type | Must |
| FR-CHK-02 | Template changes don't alter checklists already given to students unless staff refresh them | Must |
| FR-DOC-01 | Files upload straight to secure storage through a link valid for 5 minutes, then are scanned for malware | Must |
| FR-DOC-02 | Nobody but the uploader can open a file until the scan passes; infected files are quarantined | Must |
| FR-DOC-03 | Staff set each document to Verified, Rejected (with reason) or Expired | Must |
| FR-DOC-04 | Downloads use links valid for 5 minutes; every view and download is logged | Must |
| FR-DOC-05 | Only verified documents can be attached to applications or visa records | Must |
| FR-DOC-06 | New uploads keep old versions; reminders 60 and 30 days before expiry | Should |

### 3.12 Pre-departure and post-arrival

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-PDA-01 | "Visa granted" creates the pre-departure checklist | Must |
| FR-PDA-02 | Students record departure, flight, arrival time (local), address and emergency contacts | Must |
| FR-PDA-03 | At the planned arrival time, the student is asked to confirm arrival; confirming moves the stage to Arrived and creates the post-arrival checklist and check-in tasks | Must |
| FR-PDA-04 | Students can mark a message "Support – Urgent", which alerts the counsellor and an admin immediately | Must |
| FR-PDA-05 | The stage moves to Settled when the 3-month check-in is done, enrolment is confirmed and no support thread is open | Must |
| FR-PDA-06 | Briefings, partner referrals, support categories and satisfaction ratings | Later (Jun–Aug 2027) |

### 3.13 Journey and tracker

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-JRN-01 | Each person has one current stage and at most one side state | Must |
| FR-JRN-02 | A stage can move forward only when its condition is met; otherwise the system lists what is missing | Must |
| FR-JRN-03 | The system moves stages automatically when it knows a condition is met | Must |
| FR-JRN-04 | Moving back, or overriding a service status, needs a reason and is logged | Must |
| FR-JRN-05 | Service statuses are recalculated on every relevant change, with start and completion dates stored | Must |

### 3.14 Third-party fees

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-FEE-01 | Staff create a fee due: type, payee, amount, currency, due date and route (direct or via AHatIn) | Must |
| FR-FEE-02 | Direct route: the student uploads a receipt and an officer verifies it | Must |
| FR-FEE-03 | Via AHatIn: the student pays in INR at the shown rate; the server sets the amount, never the browser | Must |
| FR-FEE-04 | A payment counts only after the server checks Razorpay's signature and receives the payment-captured webhook; webhooks are processed once only | Must |
| FR-FEE-05 | Every 15 minutes, payments still pending after 30 minutes are checked with Razorpay | Must |
| FR-FEE-06 | Each payment produces a PDF receipt (not a tax invoice) | Must |
| FR-FEE-07 | Officers record the payout to the third party with proof | Must |
| FR-FEE-08 | Each student has an add-only ledger, updated together with the fee | Must |
| FR-FEE-09 | Refunds need a reason and admin approval and go through Razorpay | Must |

### 3.15 Commission

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-COM-01 | Enrolment through a commission-earning agency creates an expected-commission record | Should |
| FR-COM-02 | Status: Expected → Claimed → Partly received / Received, or Clawed back | Should |
| FR-COM-03 | Agency statements (CSV) are matched to enrolments; gaps are flagged | Should |
| FR-COM-04 | Commission is visible to admins only | Must |

### 3.16 Notifications

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-NOT-01 | Each event (e.g. new enquiry, status change, deadline, arrival request) has set recipients and channels: in-app, email, WhatsApp, SMS, push | Must |
| FR-NOT-02 | WhatsApp uses approved templates outside the 24-hour reply window | Must |
| FR-NOT-03 | Failed sends retry 3 times (after 1, 5 and 15 minutes), then fall back to email | Must |
| FR-NOT-04 | Marketing messages respect opt-outs; messages about the student's own case always go in-app and by email | Must |
| FR-NOT-05 | No non-urgent WhatsApp, SMS or push messages to students and parents between 21:00 and 08:00 their time | Must |
| FR-NOT-06 | Every message is logged against the person | Must |
| FR-NOT-07 | Push notifications only after opt-in; on iPhone, only when the app is on the home screen | Should |

### 3.17 Reports

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-REP-01 | Admin dashboard: stage funnel, conversion, time per stage, by source, counsellor, country and intake | Must |
| FR-REP-02 | Counsellor dashboard: caseload, overdue tasks, missed follow-up times, response time | Must |
| FR-REP-03 | Admissions and fees figures by intake; commission figures (admins only) | Must |
| FR-REP-04 | Figures may be up to 15 minutes old and show their "as of" time | Must |
| FR-REP-05 | Exports to CSV, admins only, logged | Must |
| FR-REP-06 | Drop-off between services | Should |

### 3.18 Audit and data rights

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-AUD-01 | Every login, change, export, document view and download is logged with who, when, IP and before/after values; logs can't be edited | Must |
| FR-AUD-02 | Consents store the document version, time, IP and channel | Must |
| FR-AUD-03 | Students can request a copy, correction or deletion of their data; admins track requests; copies export as JSON and PDF | Must |
| FR-AUD-04 | Deletion anonymises personal data and removes documents but keeps accounting records | Must |
| FR-AUD-05 | Leads inactive for 24 months are anonymised; students are flagged 6 years after last activity (adjustable, to be confirmed with a legal adviser) | Must |

### 3.19 Website widgets and app

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-WEB-01 | The enquiry widget is under 100 KB, added with one `<div>` and one `<script>`, and doesn't clash with the website's styles | Must |
| FR-WEB-02 | The widget keeps campaign tags for 30 days and sends them with the enquiry | Must |
| FR-WEB-03 | Submit stays disabled until consent is ticked; a GA4 `generate_lead` event fires on success | Must |
| FR-WEB-04 | The installed app caches only its own screens and files, never personal data or documents | Must |
| FR-WEB-05 | Users see "A new version is available — Refresh" after a release | Must |

---

## 4. Validation rules

The server always validates; the browser validates too, for quick feedback.

| ID | Field | Rule |
| --- | --- | --- |
| VAL-01 | Name | 2–100 characters; letters, spaces, `.`, `'`, `-` |
| VAL-02 | Name as in passport | Uppercase A–Z, spaces and `-` |
| VAL-03 | Email | Valid format, max 254 characters, stored in lowercase; disposable addresses rejected on the website form |
| VAL-04 | Mobile | International format; Indian numbers `+91` and 10 digits starting 6–9 |
| VAL-05 | Date of birth | Age 14–60 |
| VAL-06 | Passport | Indian: 1 letter + 7 digits; others: 6–9 letters/digits; unique |
| VAL-07 | Passport expiry | In the future; warning if within 6 months of course start |
| VAL-08 | Test scores | IELTS 0–9 (0.5 steps); PTE 10–90; TOEFL 0–120; Duolingo 10–160; GRE 260–340; GMAT 205–805 (Focus) or 200–800 (older) |
| VAL-09 | Grades | Percentage 0–100, or CGPA up to its scale (4, 5 or 10) |
| VAL-10 | Intake | Month and year, this year to 3 years ahead |
| VAL-11 | Money | Positive whole minor units; currency from INR, GBP, USD, EUR, CAD, AUD, NZD |
| VAL-12 | Free text | Max 5,000 characters, shown as plain text |
| VAL-13 | Files | PDF, JPG, PNG or HEIC (converted to JPG); type checked from file content; max 10 MB; password-protected PDFs rejected; stored under generated names |
| VAL-14 | Consent | Must be ticked; the notice version is stored |

---

## 5. Permissions

| Action | Student | Parent | Counsellor | Officer | Admin |
| --- | --- | --- | --- | --- | --- |
| View own tracker, applications, visa, fees | ✔ | Linked student | — | — | — |
| Edit own profile; upload documents | ✔ | Upload only | ✔ | ✔ | ✔ |
| Approve shortlist, accept offer | ✔ | Under 18 | — | — | — |
| Pay fees | ✔ | ✔ | — | — | — |
| View and work leads | — | — | Assigned | — | All |
| View and edit students, staff-only notes | — | — | Assigned | Assigned | All |
| Verify documents; record applications, visas, funding | — | — | ✔ | ✔ | ✔ |
| Create fees / verify receipts and record payouts | — | — | Create | ✔ | ✔ |
| Approve refunds; merge records | — | — | — | — | ✔ |
| Move a stage back or override a service status (with reason) | — | — | ✔ | ✔ | ✔ |
| Manage settings, catalogue, checklists, agencies, users | — | — | — | — | ✔ |
| View commission, export data, view audit log | — | — | — | — | ✔ |
| Dashboards | — | — | Own | Own | All |

- Permissions are checked on the server for every request, by role and by link to the record.
- A record the user may not see returns "not found", so its existence isn't revealed.
- Students and parents never see commission amounts, only whether a university earns AHatIn commission.
- Automated tests cover every cell of this table.

---

## 6. Security

| ID | Requirement |
| --- | --- |
| NFR-SEC-01 | HTTPS only (TLS 1.2+), with HSTS |
| NFR-SEC-02 | All data encrypted at rest; passport numbers and dates of birth also encrypted field by field |
| NFR-SEC-03 | Login cookies are HttpOnly, Secure and SameSite=Lax; every data-changing request needs a CSRF token |
| NFR-SEC-04 | Protection against the OWASP Top 10, including rejecting database operators sent in user input, plus a Content Security Policy and security headers |
| NFR-SEC-05 | Rate limits on login, public forms and uploads, with "try again after" times |
| NFR-SEC-06 | Logs never contain codes, cookies, passport numbers, payment details or document contents |
| NFR-SEC-07 | Card details never reach AHatIn's servers |
| NFR-SEC-08 | Secrets are never in code or logs |
| NFR-SEC-09 | Dependency scans on every build; automated security scan before go-live; independent penetration test in January 2027; no open high or critical issues |
| NFR-SEC-10 | Admins are alerted to unusual activity (e.g. 100+ downloads by one user in an hour, repeated failed logins) |

---

## 7. Performance and reliability

| ID | Requirement |
| --- | --- |
| NFR-PERF-01 | 95% of reads under 0.5 s and writes under 1 s |
| NFR-PERF-02 | Pages load (largest content) in under 2.5 s on a mid-range Android phone on 4G |
| NFR-PERF-03 | Website widget loads in under 1 s and submits in under 2 s |
| NFR-PERF-04 | Search returns in under 1 s across 50,000 records |
| NFR-PERF-05 | Year 1 capacity: 50 staff and 300 students/parents at once; 2,000 students; 50,000 leads; 100,000 documents; bursts of 20 enquiries a second |
| NFR-REL-01 | 99.5% uptime per month; maintenance only outside 08:00–21:00 IST |
| NFR-REL-02 | At most 15 minutes of data lost and service restored within 4 hours after a disaster; restore tested quarterly |
| NFR-REL-03 | Scheduled jobs are safe to re-run and catch up after a missed run |
| NFR-REL-04 | Releases cause no downtime |

---

## 8. Error handling

**Error format:** every error returns JSON with a status, a code, a plain message, field errors where relevant, and a trace ID shown to the user.

| Status | When | What the user sees |
| --- | --- | --- |
| 401 | Session expired | Unsaved form text is kept; login, then back to the same page |
| 403 | Action not allowed | "You don't have permission to do this." |
| 404 | Not found or not visible | "We couldn't find that." |
| 409 | Someone else changed it, or slot taken | Latest version shown; user re-applies the change |
| 413 / 415 | File too large or wrong type | What size and types are allowed |
| 422 | Invalid data or a stage condition not met | Message next to each field, or the list of missing conditions |
| 429 | Too many attempts | How long to wait |
| 500–504 | Server or outside service problem | "Something went wrong. Please try again." with trace ID; safe requests retried automatically up to 3 times |

| ID | Rule |
| --- | --- |
| NFR-ERR-01 | Messages are plain, say how to fix the problem, and never show technical details |
| NFR-ERR-02 | Create requests carry a unique key, so repeats never create duplicates |
| NFR-ERR-03 | Linked changes (fee and ledger, stage and tracker, merges) save completely or not at all |
| NFR-ERR-04 | An outside service failing never loses the user's action; it is retried later |
| NFR-ERR-05 | If the browser closes after paying, the payment is completed by the webhook or the 15-minute check; the student sees "Payment processing", never a false failure |
| NFR-ERR-06 | A failed or cancelled payment leaves the fee "Due" and can be retried |
| NFR-ERR-07 | When offline, the app shows a banner, disables server actions and keeps unsent text |
| NFR-ERR-08 | Failed background jobs retry 3 times, then go to a review queue and alert the team |
| NFR-ERR-09 | Form errors are listed at the top and focus moves to the first one |

---

## 9. Usability and maintainability

- Student screens are mobile-first; uploading a document, checking status or paying a fee takes at most 3 taps from the home screen.
- Accessibility to WCAG 2.1 AA basics: keyboard use, visible focus, labelled fields, 4.5:1 contrast.
- English at launch; all text stored so Hindi can be added.
- Dates shown as `21 Oct 2026`; rupees with Indian grouping (₹1,25,000).
- Follow-up rules, working hours, templates, fee types, exchange rates and retention periods are changed by admins without new code.
- Payments, WhatsApp, SMS and push can be switched on or off per environment.
- Every Must requirement has automated tests that run on every change.

---

## 10. Testing

| Method | Covers |
| --- | --- |
| Automated API and unit tests | All functional requirements, validations and permissions |
| End-to-end tests | Enquiry → registration → application → visa → arrival → Settled; sandbox payment |
| Load tests | Performance and capacity |
| Lighthouse and accessibility checks | Page speed, installable app, accessibility |
| Security scans and penetration test | Security requirements |
| Restore drill | Recovery |
| User testing with counsellors, an officer and students | Main journeys, before go-live |

---

## Appendix A — Application status changes

| From | Can move to |
| --- | --- |
| Draft | Submitted, Withdrawn |
| Submitted | Under review, More information requested, Interview, Conditional offer, Unconditional offer, Rejected, Withdrawn |
| Under review | More information requested, Interview, Conditional offer, Unconditional offer, Rejected, Withdrawn |
| More information requested | Under review, Withdrawn |
| Interview | Under review, Conditional offer, Unconditional offer, Rejected, Withdrawn |
| Conditional offer | Unconditional offer, Accepted, Declined, Rejected, Withdrawn |
| Unconditional offer | Accepted, Declined, Withdrawn |
| Accepted | Withdrawn |
| Rejected, Declined, Withdrawn | Final (an admin can reopen, with a reason) |
