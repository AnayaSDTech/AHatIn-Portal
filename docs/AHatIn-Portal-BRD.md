# AHatIn Student Portal — Business Requirements Document (BRD)

**Organisation:** AHatIn International Educational Consultancy
**Prepared for:** AHatIn management, counsellors, operations staff and the portal development team
**Date:** 21 October 2026
**Version:** 3.0

---

## 1. Purpose

This document explains how AHatIn works with students and what the portal must do to support that work: **student management, counselling, admissions and follow-ups**.

**Priority key:** **Must** = needed at launch · **Should** = soon after launch · **Could** = if time allows · **Later** = during 2027, by the date shown.

---

## 2. How AHatIn operates

### 2.1 Service model

| Aspect | How AHatIn works |
| --- | --- |
| Students | Mainly postgraduate aspirants; also undergraduates (with parents) and working professionals |
| Destinations | UK, USA and Europe (mainly Germany, Ireland, France) |
| Price | **Free** to students |
| Universities | Reached through **partner agencies** (aggregators and master agents); no direct university contracts at launch |
| Income | A share of university commission, paid by the partner agency after enrolment; referral income from loan, forex and accommodation partners |
| Third-party fees | Students pay application fees, visa fees and deposits; AHatIn may pay some on their behalf |
| Principles | Honest advice, a named counsellor for each student, verified documents only, open disclosure of which universities earn AHatIn commission |

### 2.2 The seven services

```
Career Counselling → University & → Application → Scholarship &     → Visa       → Pre-Departure → Post-Arrival
& Course Selection   Country        Assistance    Financial Guidance  Assistance   Support         Support
                     Selection
```

| # | Service | What AHatIn does |
| --- | --- | --- |
| S1 | Career Counselling & Course Selection | Understands goals and strengths; recommends course areas and the careers they lead to |
| S2 | University & Country Selection | Compares countries; builds a shortlist the student approves |
| S3 | Application Assistance | Prepares SOP, LOR and CV; applies through partner agencies; tracks offers |
| S4 | Scholarship & Financial Guidance | Finds scholarships, estimates total cost, plans funding and proof of funds |
| S5 | Visa Assistance | Checklist, funds check, form review, mock interviews |
| S6 | Pre-Departure Support | Accommodation, travel, forex, insurance and arrival preparation |
| S7 | Post-Arrival Support | Arrival check, local registration help, check-ins for the first three months |

### 2.3 How the work is done today

| Activity | Current practice |
| --- | --- |
| Enquiries | Website forms, phone, WhatsApp, email, walk-ins and events, with no single list |
| Follow-ups | Counsellors' memory, notes and spreadsheets |
| Counselling | One-to-one sessions; notes kept by each counsellor |
| Documents | Collected by email and WhatsApp |
| Shortlists and applications | Built from experience; applications submitted on agency portals and tracked in spreadsheets |
| Funding, visa, departure and arrival | Advice given by call and WhatsApp; little record kept |

---

## 3. What the portal must accomplish

1. Capture every enquiry and make sure it is followed up on time.
2. Keep one complete record for each student, from enquiry to alumni.
3. Record counselling advice, recommendations and the reasons behind them.
4. Track every application, scholarship, visa and deadline.
5. Show students and parents their progress through all seven services.
6. Prompt staff automatically when action is due, and alert managers when it is late.
7. Keep student data and documents secure and accessible only to the right people.

### 3.1 Who uses it

| User | Uses the portal to |
| --- | --- |
| Website visitor | Send an enquiry |
| Student | Follow progress, keep their profile, upload documents, approve choices, complete checklists, message their counsellor |
| Parent / guardian | Follow their child's progress |
| Counsellor | Work leads, counsel, shortlist, follow up |
| Application and visa officer | Verify documents; record applications and visas |
| Administrator | Oversee students, staff and results |

Partner agencies, universities and referral partners have **no** portal access.

---

## 4. Student journey

Every student moves through 13 stages. The portal records each move and who made it; moving a stage back needs a reason.

| # | Stage | Service | Moves on when |
| --- | --- | --- | --- |
| 1 | New lead | S1 | Enquiry received |
| 2 | Contacted | S1 | First conversation logged |
| 3 | Assessment booked | S1 | Counselling session scheduled |
| 4 | Assessed / plan shared | S1, S2, S4 | Career goals recorded; course areas, countries and an initial cost estimate shared |
| 5 | Registered client | S2 | Registration completed |
| 6 | Documents and shortlist | S2, S3, S4 | Documents verified, funding plan recorded, shortlist approved |
| 7 | Applications submitted | S3, S4 | At least one application submitted |
| 8 | Offer accepted | S3, S4 | Offer accepted; deposit paid if required |
| 9 | Visa filed | S5, S4 | Proof of funds checked and visa application filed |
| 10 | Visa granted | S5, S6 | Visa approved |
| 11 | Arrived | S6, S7 | Safe arrival confirmed |
| 12 | Enrolled | S7 | University registration confirmed |
| 13 | Settled | S7 | 3-month check-in done, no open issues |

A student can also be put in **Nurture** (not ready yet, with a re-contact date), **On hold** (with a review date), **Deferred** (to a later intake), **Visa refused** (with the reason) or **Lost** (with the reason).

---

## 5. Service progress tracker

Students, parents and staff see progress as the seven services:

```
✅ Career Counselling & Course Selection      Completed 12 Nov
✅ University & Country Selection             Shortlist approved 20 Nov
🔵 Application Assistance                     3 of 4 applications submitted · 1 offer
🔵 Scholarship & Financial Guidance           Funding plan ready · 1 scholarship applied
⚪ Visa Assistance                            Starts after you accept an offer
⚪ Pre-Departure Support
⚪ Post-Arrival Support
```

| ID | Requirement | Priority |
| --- | --- | --- |
| BR-TRK-01 | Show each service as Not started, In progress, Completed or Not needed, from launch | Must |
| BR-TRK-02 | Update statuses automatically using the rules below; staff may override with a reason | Must |
| BR-TRK-03 | Allow several services to be in progress at once | Must |
| BR-TRK-04 | Show for each service a summary, outstanding items, next deadline and next action | Must |
| BR-TRK-05 | Let staff filter students by service and status | Must |

| Service | In progress when | Completed when |
| --- | --- | --- |
| S1 | Assessment booked | Plan shared |
| S2 | Student registered | Shortlist approved |
| S3 | First application started | Offer accepted |
| S4 | Cost estimate created | Funding gap closed and proof of funds confirmed |
| S5 | Offer accepted | Visa granted |
| S6 | Visa granted | Pre-departure checklist complete |
| S7 | Arrived | Settled |

---

## 6. Student management

| ID | Requirement | Priority |
| --- | --- | --- |
| BR-STU-01 | Register a lead as a client free of charge once they accept the terms, privacy notice and commission disclosure | Must |
| BR-STU-02 | For students under 18, a parent must also accept registration, approve the shortlist and accept offers | Must |
| BR-STU-03 | Keep one record per student for life, including alumni | Must |
| BR-STU-04 | Hold the student profile: personal, passport, education, tests, work experience, finances, preferences | Must |
| BR-STU-05 | Assign a named counsellor (and optionally an officer); keep reassignment history | Must |
| BR-STU-06 | Give each staff member a list of their students with stage, next action and overdue items | Must |
| BR-STU-07 | Show profile completeness and what is missing | Should |
| BR-STU-08 | Let students link parents, each with their own login | Should |
| BR-DOC-01 | Create a document checklist per student by country, level and course | Must |
| BR-DOC-02 | Let students upload documents from phone or computer | Must |
| BR-DOC-03 | Let staff mark documents verified, rejected (with reason) or expired | Must |
| BR-DOC-04 | Use only verified documents in applications and visa files; report suspected fraud to management | Must |
| BR-DOC-05 | Limit document access to the student, their parents and assigned staff | Must |
| BR-DOC-06 | Keep previous versions; warn before key documents expire | Should |

---

## 7. Counselling

| ID | Requirement | Priority |
| --- | --- | --- |
| BR-CNS-01 | Record each session: notes, advice and next steps | Must |
| BR-CNS-02 | Record the assessment: academics, tests, experience, budget, preferences, profile score | Must |
| BR-CNS-03 | Record career goals, interests and strengths, and recommended course areas with reasons | Must |
| BR-CNS-04 | Share a recommended plan: course areas, countries, intake, tests and timeline | Must |
| BR-CNS-05 | Let students book sessions online, with calendar invitations and reminders | Should |
| BR-CNS-06 | Let students and parents message their counsellor | Should |
| BR-CNS-07 | Record test plans (test, target score, date) | Should |
| BR-CNS-08 | Offer a short career questionnaire | Could |
| BR-UNI-01 | Build a shortlist with a reason for each option | Must |
| BR-UNI-02 | Show the student which shortlisted universities earn AHatIn commission | Must |
| BR-UNI-03 | Require the student's approval of the shortlist before applying | Must |
| BR-UNI-04 | Record recommended countries with reasons | Must |
| BR-UNI-05 | Keep a searchable catalogue of universities, courses and the agencies that cover them | Should |
| BR-UNI-06 | Compare countries on cost, post-study work and visa rules | Should |
| BR-FIN-01 | Estimate the total cost of study per option, in local currency and INR | Must |
| BR-FIN-02 | Record a funding plan (family, sponsor, scholarship, loan) and the gap | Must |
| BR-FIN-03 | Track scholarship applications, deadlines and awards | Must |
| BR-FIN-04 | Record the proof of funds the visa will need | Must |
| BR-FIN-05 | Label all financial information as guidance, not financial advice | Must |
| BR-FIN-06 | Scholarship list with automatic matching; loan referral tracking | Later (Mar 2027) |

---

## 8. Admissions

| ID | Requirement | Priority |
| --- | --- | --- |
| BR-APP-01 | Record each application with its partner agency (or "own application") and references | Must |
| BR-APP-02 | Track application status from draft to offer, rejection or withdrawal | Must |
| BR-APP-03 | Track deadlines and offer conditions | Must |
| BR-APP-04 | Track SOP, LOR and CV drafts, feedback and final approval | Must |
| BR-APP-05 | Record deposits and CAS / I-20 / admission letters | Must |
| BR-APP-06 | Tell the student whenever an application status changes | Must |
| BR-APP-07 | Let students compare offers side by side | Should |
| BR-VISA-01 | Create a visa checklist by country and visa type | Must |
| BR-VISA-02 | Check funds against the proof-of-funds requirement before filing | Must |
| BR-VISA-03 | Record a review of the visa form before submission | Must |
| BR-VISA-04 | Record visa dates, references and decision; record refusal reasons | Must |
| BR-VISA-05 | Record mock-interview feedback | Should |
| BR-ENR-01 | Record university enrolment and keep alumni records | Must |

---

## 9. Follow-ups

### 9.1 Requirements

| ID | Requirement | Priority |
| --- | --- | --- |
| BR-LEAD-01 | Capture website enquiries directly; let staff add enquiries from other channels | Must |
| BR-LEAD-02 | Record each enquiry's source and campaign; never overwrite it | Must |
| BR-LEAD-03 | Merge duplicate enquiries into one record | Must |
| BR-LEAD-04 | Assign each enquiry to a counsellor automatically and acknowledge it within 1 minute | Must |
| BR-LEAD-05 | Score enquiries by readiness | Should |
| BR-FUP-01 | Create follow-up tasks automatically using the rules below, plus manual tasks | Must |
| BR-FUP-02 | Give staff a daily list of due and overdue follow-ups | Must |
| BR-FUP-03 | Log every contact attempt and its outcome | Must |
| BR-FUP-05 | Send automated nurture messages | Could |
| BR-PDS-01 | Pre-departure checklist by country, with travel details and emergency contacts | Must |
| BR-ARR-01 | Ask the student to confirm safe arrival; alert staff if it doesn't come | Must |
| BR-ARR-02 | Post-arrival checklist by country (registration, residence permit, bank, SIM) | Must |
| BR-ARR-03 | Regular check-ins after arrival; students can send urgent support messages | Must |
| BR-PDS-02 | Briefings and partner referral tracking | Later (Jun 2027) |
| BR-ARR-04 | Full support requests by category, and satisfaction ratings | Later (Aug 2027) |

### 9.2 Follow-up rules

Working hours default to Monday–Saturday, 10:00–19:00 IST. Administrators can change every value.

| When this happens | Staff must | Within | If missed |
| --- | --- | --- | --- |
| New enquiry (working hours) | Make first contact | 15 minutes | Manager alerted |
| New enquiry (out of hours) | Make first contact | 11:00 next working day | Manager alerted |
| Contacted, no session booked | Follow up | 48 hours, then 7 days | Nurture after 3 failed tries |
| Assessment done | Share the plan | 24 hours | Manager alerted |
| Plan shared, not registered | Follow up | 48 hours and 7 days | Nurture |
| Student registered | Agree cost estimate and funding plan | 7 days | Counsellor task |
| Document uploaded | Verify or reject | 1 working day | Manager alerted |
| Document missing | Remind student | Every 3 days | Counsellor task after 2 reminders |
| Application or scholarship deadline | Remind student and staff | 14, 7 and 2 days before | Manager alerted at 2 days |
| Offer received | Discuss with student | 2 working days | Manager alerted |
| Deposit or visa fee due | Remind student and parent | 7 and 2 days before | Counsellor task |
| Visa decision | Contact student | 2 working days | Manager alerted |
| Departure approaching | Checklist reminder | 21 and 7 days before | Counsellor task |
| Planned arrival | Confirm safe arrival | 24 hours | Counsellor and manager alerted |
| After arrival | Check in | 1 week, 1 month, 3 months | Task overdue after 2 days |
| Urgent support message | Respond | 2 hours, any day | Manager alerted immediately |
| Other messages | Reply | 1 working day | Manager alerted |
| Nurture re-contact date | Contact the lead | On the date | Overdue after 2 days |

---

## 10. Compliance

| Requirement | What AHatIn must do | How the portal helps |
| --- | --- | --- |
| India's data protection law (DPDP Act 2023 and Rules 2025) | Give notice, take consent, honour data requests, protect data, report breaches; main duties apply from 13 May 2027 | Consent records, privacy notice, data requests, retention rules, audit log, data kept in India |
| UK Agent Quality Framework | Advise ethically and openly; counsellors trained by the British Council | Commission disclosure, recorded advice and shortlist reasons, verified documents |
| Partner agency agreements | Follow each agency's terms and the university rules they pass on | Agency terms recorded; agency and reference on every application |
| Money held for third-party fees | Collect exact amounts, issue receipts, pay out promptly | Fee ledger, receipts, payout proof, refunds |
| Tax | Record fees collected for students as AHatIn's chartered accountant advises | Exports of payments, payouts and receipts |

---

## 11. Glossary

| Term | Meaning |
| --- | --- |
| Commission share | The part of the university's commission that the partner agency pays AHatIn |
| CAS | Confirmation of Acceptance for Studies: from a UK university, needed for a UK student visa |
| I-20 | Form from a US university, needed for an F-1 student visa |
| IHS | Immigration Health Surcharge, paid with a UK visa application |
| SEVIS fee | US fee paid before an F-1 visa interview |
| APS | Academic Evaluation Centre certificate, needed by many Indian students applying to Germany |
| Census date | The date a university confirms a student is enrolled; commission usually depends on it |
| Clawback | Commission taken back if a student withdraws |
| Proof of funds | Money a visa applicant must show, often held for a set period before applying |
| eVisa / BRP | The UK's digital immigration status (eVisa), which replaced the Biometric Residence Permit card |
| Anmeldung | Registration of a home address in Germany, needed soon after arrival |
| IRP | Irish Residence Permit, needed by non-EU students in Ireland |
| DPDP | India's Digital Personal Data Protection Act 2023 and Rules 2025 |

---

## 12. Sign-off

| Role | Name | Signature | Date |
| --- | --- | --- | --- |
| Project sponsor (AHatIn) | | | |
| Business reviewer (AHatIn) | | | |
| Counselling lead | | | |
| Development lead | | | |
