# AHatIn Student Portal — Project Proposal

**Prepared for:** AHatIn International Educational Consultancy (management and the portal development team)
**Date:** 21 October 2026
**Version:** 3.0

---

## 1. Summary

AHatIn will build its own online portal to manage every student from first enquiry until they are settled at university abroad. Students, parents and AHatIn staff will all use it. It works in any browser and can be installed on a phone like an app. It connects to AHatIn's existing WordPress website, so website enquiries go straight into the portal.

| Item | Plan |
| --- | --- |
| Built by | AHatIn's in-house development team |
| Development starts | **22 October 2026** |
| Development complete | **20 December 2026** |
| Live for staff | **28 December 2026** |
| Live for students and parents | **4 January 2027** |

---

## 2. The problem

Today, enquiries, documents, application updates and payments are spread across website forms, phone calls, WhatsApp, email and spreadsheets. As a result:

1. **Enquiries are missed or answered late**, and nobody can see which marketing brings in students.
2. **Families keep calling for updates** because they can't see progress themselves.
3. **Counsellors lose time to admin**, which limits each one to about 20–25 students a year.
4. **Commission from partner agencies isn't tracked**, so payments can be missed.
5. **Data-protection risk is growing.** India's data protection rules apply from 13 May 2027, and student documents in email and WhatsApp can't meet them.

Going live in January means the January intake and the whole September 2027 season run on the portal.

---

## 3. Objectives and expected results

| # | Objective | Target (12 months after go-live) |
| --- | --- | --- |
| O1 | Capture every enquiry | 100% recorded with their source |
| O2 | Respond faster and convert more | First reply within 15 minutes; 15–20% of enquiries become registered students |
| O3 | Show families their progress | 90% of students log in monthly; 40% fewer "any update?" calls |
| O4 | Free up counsellors | 35–40 students per counsellor a year |
| O5 | Never miss a deadline | Zero missed application, scholarship or visa deadlines |
| O6 | Give management live control | Dashboards replace manual reports; commission tracked |
| O7 | Protect student data | Data-protection requirements met on time |

---

## 4. Scope

### 4.1 What will be built

The portal supports all seven AHatIn services, from career counselling to post-arrival support.

| Module | What it gives AHatIn | Priority |
| --- | --- | --- |
| Logins and roles | Students and parents log in with a one-time code; staff use their AHatIn Google account | Must |
| Enquiries and CRM | Website enquiries land in the portal, are assigned to a counsellor and followed up on time | Must |
| Counselling | Career goals, course and country advice, recommended plan, free registration | Must |
| Documents | Checklists, uploads and verification in one secure place | Must |
| Applications and partner agencies | Every application tracked, with the partner agency handling it | Must |
| Scholarships and funding | Cost of study, funding plan and scholarship applications | Must |
| Visa | Visa checklist, funds check and decision | Must |
| Pre-departure and post-arrival | Checklists, travel details, arrival check and check-ins | Must (light version) |
| Service progress tracker | Students and parents see all seven services and what comes next | Must |
| Third-party fee payments | Students pay application and visa fees through AHatIn, or upload receipts | Must |
| Notifications | Email, WhatsApp, SMS and app alerts | Must |
| Dashboards | Funnel, workload and results | Must |
| Data migration | Current and previous-intake students moved in | Must |
| Course and country catalogue | Search and shortlist universities | Should |
| Booking and parent access | Online booking of sessions; parent logins | Should |
| Commission | What each partner agency owes AHatIn | Should |
| Reviews, referrals, automated nurture | Reviews, referral codes, automated follow-up messages | Could |

**WordPress website:** an enquiry form and a "Student Login" button are added (and optionally a course widget). Nothing else on the website changes.

### 4.2 Not included

- Charging students for AHatIn's advice (the service is free).
- Submitting applications automatically to agency, university or visa systems; staff do this on those systems and record the result.
- Redesigning the WordPress website.
- Native iPhone or Android apps (the portal installs on phones instead), AI features, and a login for partner agencies.

---

## 5. How it will be delivered

- **One-week sprints** with a demo to AHatIn every Friday.
- **Most important features first.** "Must" items are built before "Should" and "Could" items.
- **Ready-made building blocks** and AI-assisted coding, so the team builds quickly; every feature is tested before it counts as done.
- **Features that need outside approval** (online payments, WhatsApp) are built and tested in practice mode, then switched on when approved.

---

## 6. Timeline

| Sprint | Dates | Delivered |
| --- | --- | --- |
| 0 | 22–25 Oct | Set-up |
| 1 | 26 Oct – 1 Nov | Logins and roles |
| 2 | 2–8 Nov | Enquiries, CRM and the website enquiry form |
| 3 | 9–15 Nov | Counselling and registration |
| 4 | 16–22 Nov | Documents |
| 5 | 23–29 Nov | Applications, partner agencies, visa |
| 6 | 30 Nov – 6 Dec | Scholarships and funding, fee payments, notifications |
| 7 | 7–13 Dec | Tracker, pre-departure and post-arrival, booking, parents, catalogue |
| 8 | 14–20 Dec | Commission, referrals, dashboards — **development complete** |
| 9 | 21–27 Dec | Testing with counsellors and students, security checks, data migration |
| Go-live | **28 Dec** | Staff start using the portal |
| Onboarding | **from 4 Jan 2027** | Students and parents invited |
| After launch | Jan 2027 | Independent security test |
| Later in 2027 | Mar, Jun, Aug | Fuller scholarship, pre-departure and post-arrival features, before the September 2027 intake travels |

If time runs short, "Should" and "Could" items move to early January. **The go-live date does not move.**

---

## 7. Roles

| Role | Who | Responsibility |
| --- | --- | --- |
| Project sponsor | AHatIn Founder/Director | Approves scope and go-live |
| Business reviewer | AHatIn senior counsellor or operations lead | Answers questions within 24 hours; signs off each sprint |
| Development team | AHatIn in-house | Design, build, testing, release, documentation |
| Test users | 2 counsellors, 1 visa officer, 5 students | Test week (21–27 Dec) |

---

## 8. Main risks

| Risk | What we'll do |
| --- | --- |
| Payment or WhatsApp approval is slow | Students upload fee receipts and messages go by email until approved |
| Bugs from the tight schedule | Automated tests from day one; staff use it first, students a week later |
| Staff don't adopt it | Training before go-live; all new students handled on the portal |
| Handling students' money for fees | Collect exact amounts only; keep a ledger; confirm treatment with AHatIn's accountant |
| Poor data from spreadsheets | Trial import first; counsellors check the result |

---

## 9. What AHatIn needs to provide

- Accounts for the cloud provider, Razorpay, WhatsApp Business, an SMS provider and Google Workspace, **in the first week**.
- Document checklists, fee types, partner agency details and the university list, by the end of November.
- Access to the WordPress website to add the enquiry form and login button.

---

## 10. Approval

| Role | Name | Signature | Date |
| --- | --- | --- | --- |
| Project sponsor (AHatIn) | | | |
| Development lead | | | |
| Business reviewer (AHatIn) | | | |
