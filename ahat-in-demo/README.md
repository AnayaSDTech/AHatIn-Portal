# AHatIn — Demo Website & Student Portal

A demo of the AHatIn International Educational Consultancy website and student portal, built with **React, TypeScript, Vite and PWA** support.

> **Demo only.** Student names, stories, figures, contact details, partner agencies and dashboard data are fictional and labelled "Demo" in the app. The university list is illustrative and is not a claim of partnership. Login is mocked in the browser and is **not secure**. Never enter real personal data.

---

## What's included

| Area | Features |
| --- | --- |
| **Homepage** | Hero with progress preview and stats, study destinations (UK, Europe), the seven services, about section, featured universities, student success stories (auto-rotating carousel), FAQs (accessible accordion), call to action, footer |
| **Enquiry form** (`/#enquire`) | Visitors request a call back without an account: name, mobile, email, destination, intake, and optional course, call time and question. Each enquiry becomes a **Website lead** for the counsellor with the fewest open leads, with a 15-minute first-contact follow-up. A repeat enquiry (same email or mobile) is added to the existing lead; one from a registered student goes to their record. Hidden spam trap and a limit of 3 enquiries per 10 minutes. The hero, destination cards ("Get guidance" pre-selects the destination), FAQ and navbar link to it |
| **Navigation** | Sticky navbar that turns solid on scroll, smooth scrolling to sections, responsive full-screen mobile menu (closes on Escape or navigation) |
| **Student registration** | Validated form (name, email, Indian mobile, destination, intake, consent), then the email is confirmed with a 6-digit code. No password. Duplicate emails are rejected |
| **Student login** | Email, then a 6-digit one-time code (expires in 10 minutes, 5 attempts, resend after 30 s). The same message is shown whether or not an account exists. A link leads to Staff sign in |
| **Staff sign in** (`/staff/login`) | Work email and password, then a 6-digit authenticator code that changes every 30 seconds. Staff accounts are created only by an admin; there is no public staff registration |
| **Role-based access** | The role comes from the account, never from a choice at login. Students land on `/dashboard`, counsellors on `/staff`, admins on `/admin`. Opening another role's page shows "Page not found". Staff are signed out after 30 minutes idle (12 hours maximum); students after 7 days idle (30 days maximum) |
| **Counsellor area** | **Today:** overdue and due follow-ups with their time-limit rule, stats, mark done. **Leads:** search, stage filter, readiness score; lead details with contact logging (reaching a new lead moves it to Contacted), stage changes (moving back needs a reason), send registration link. **Students:** search, journey filter, 7-service progress bars. **Student record:** verify or reject documents (with reason), change application status using only allowed transitions (offers are accepted or declined by the student), staff-only notes |
| **Schedule** (`/staff/schedule`) | **Sessions:** list (booked, past, cancelled) or week calendar; book for a student; join, reschedule or cancel (with a reason) before the start; after the start, mark completed (notes required, added to the student record) or no-show. **Availability:** weekly hours with up to two blocks a day, online/office/both, slot length, buffer, minimum notice and booking window, with a preview of free slots. **Time off:** full or part days, with a warning about clashing sessions. Admins can pick any counsellor |
| **Counsellor assignment** | Each lead and student belongs to one counsellor. Counsellors see only their own records (other records show "Page not found"); admins see everything and can filter by counsellor. New students are assigned automatically to the counsellor with the fewest students. Admins reassign a student or lead with a reason, kept in the assignment history |
| **Temporary access (cover)** | In **Staff users**, an admin can let one counsellor cover another's students and leads for up to 30 days, with a reason; access ends on the date set or when revoked |
| **Admin area** | **Overview:** enquiries, conversion, visa success, overdue follow-ups, student funnel, enquiries by source, counsellor workload, agency agreement expiry warning. **Staff users:** add (with validation), deactivate or reactivate (not yourself). **Partner agencies:** commission share, agreement dates, status. **Settings:** working hours, quiet hours, staff security, follow-up rules (read-only). Admins can also use the counsellor pages |
| **Student dashboard** (login required) | Greeting and overall progress ring; 7-service application progress tracker; applications with status, deadlines and expandable details; document checklist with filters and (simulated) uploads with file type and size checks; profile and counsellor card. All changes are saved in the browser |
| **Needs your attention** | Automatic card at the top of the dashboard listing only what's waiting on the student: documents to upload or re-upload, offers to reply to, the next session within a week, and missing profile details. Urgent items come first; each item jumps to its section; items disappear when done. No manual or staff tasks |
| **Edit profile** | Dialog with validation (date of birth, test scores checked against each test's range, required fields). Name and email can't be edited; passport number locks once an application is submitted |
| **Sessions** | Book a session with your assigned counsellor: dates and time slots come from that counsellor's availability and time off (taken slots disabled), online or office where the slot allows it, notes. Up to 3 upcoming sessions; cancel with confirmation |
| **Shared demo data** | Leads, students, sessions, availability, time off and cover access are shared by all demo logins in the same browser, so a student's booking appears in the counsellor's schedule straight away. **Admin → Settings → Reset demo data** restores the original data |
| **Applications** | Read-only for students (staff submit applications and update status). Students can view offer conditions and **accept or decline** an offer (one acceptance per intake); accepting updates the progress tracker |
| **PWA** | Installable app, offline app shell, cached fonts and images, "new version available" prompt |
| **Quality** | Responsive from 360 px, keyboard accessible, skip link, reduced-motion support, scroll-reveal animations, image fallbacks when offline |

## Demo accounts

| Role | Where to log in | Email | Password | Second step |
| --- | --- | --- | --- | --- |
| Student | **Student Login** (`/login`) | `demo.student@ahatin.example` | none | 6-digit code shown on screen |
| Counsellor | **Staff sign in** (`/staff/login`) | `demo.counsellor@ahatin.example` | `Staff@1234` | Code from the on-screen demo authenticator |
| Admin | **Staff sign in** (`/staff/login`) | `demo.admin@ahatin.example` | `Admin@1234` | Code from the on-screen demo authenticator |

Nothing is really emailed: in the demo, the one-time code and the authenticator code are shown on screen, with a "Fill it in" button. You can also register a new student account; it's stored only in your browser.

---

## Requirements

- **Node.js 20 or later** (tested with Node 22)
- npm 10+

## Setup

```bash
cd ahat-in-demo
npm install
npm run dev        # http://localhost:5173
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Type-check and build for production into `dist/` (includes the service worker) |
| `npm run preview` | Serve the production build at http://localhost:4173 |
| `npm run typecheck` | TypeScript check only |
| `npm run icons` | Regenerate the PWA PNG icons in `public/` (no extra packages needed) |

To test the installable app and offline mode, use `npm run build` and `npm run preview`. The service worker is disabled in development.

---

## Deploying to Vercel

The project is ready for Vercel: `vercel.json` sets the build (`npm ci`, `npm run build`, output `dist`), sends every page address to the app so links like `/staff/schedule` work when opened directly or refreshed, sets caching for the service worker, and adds basic security headers. No environment variables are needed: the demo runs in mock mode by default.

**Option A: Vercel CLI (no GitHub needed)**

```bash
npx vercel login
npx vercel          # first time: answer the set-up questions; creates a preview link
npx vercel --prod   # publishes the production link to share
```

**Option B: GitHub.** Push this folder to a GitHub repository, then in Vercel choose **Add New → Project**, import the repository and click **Deploy**. Vercel reads the settings from `vercel.json`. If the repository contains more than this folder, set **Root Directory** to `ahat-in-demo`.

**Before sharing with the client**

- The demo is kept out of search engines (`robots.txt`, a `noindex` header and meta tag), but anyone with the link can open it. To require a password, use Vercel's Deployment Protection settings, which depend on your Vercel plan.
- Each visitor's demo data stays in their own browser. What the client does on their device doesn't affect anyone else, and **Admin → Settings → Reset demo data** restores the original data.
- After a new deployment, open visitors see a "new version available" prompt.

---

## Project structure

```
ahat-in-demo/
├── public/                 # Favicon, PWA icons, robots.txt
├── scripts/
│   └── generate-icons.mjs  # Builds PWA PNG icons with Node's zlib
├── src/
│   ├── App.tsx             # Routes (React Router)
│   ├── main.tsx
│   ├── index.css           # Tailwind layers, reveal animation, reduced motion
│   ├── config/env.ts       # VITE_ settings
│   ├── context/            # AuthContext (current user, login, register, logout)
│   ├── lib/
│   │   ├── api/            # API client, auth service, mock auth, shared types
│   │   ├── validation.ts   # Zod schemas for forms
│   │   └── utils.ts
│   ├── hooks/              # useReveal (scroll animation), useLocalState
│   ├── data/               # Site content, demo student data, demo staff and admin data
│   ├── components/
│   │   ├── ui/             # Button, Container, FormField, Accordion, SmartImage, Logo, …
│   │   ├── layout/         # Navbar, Footer, Layout
│   │   ├── home/           # Homepage sections
│   │   ├── auth/           # AuthShell, one-time code input, route guards (role-based)
│   │   ├── dashboard/      # Student dashboard cards (tracker, attention, applications, documents, sessions, profile)
│   │   ├── staff/          # Staff layout and shared staff UI
│   │   └── pwa/            # Update prompt
│   └── pages/              # Home, Login, Register, Dashboard, Not found
│       ├── staff/          # Staff sign in, Today, Leads, Students, Student record
│       └── admin/          # Overview, Staff users, Partner agencies, Settings
├── tailwind.config.js      # Navy / gold / ivory palette, fonts, animations
└── vite.config.ts          # React + PWA plugin, /api proxy for FastAPI
```

## Tech stack

React 18 · TypeScript (strict) · Vite 5 · vite-plugin-pwa (Workbox) · React Router 6 · React Hook Form + Zod · Tailwind CSS 3 · lucide-react icons · Google Fonts (Playfair Display, Inter)

---

## Connecting the FastAPI backend later

The UI talks to an **auth service** (`src/lib/api/auth.ts`) that switches between mock and real API with one setting, so pages don't need to change.

1. Copy `.env.example` to `.env` and set:
   ```
   VITE_AUTH_MODE=api
   VITE_API_BASE_URL=          # empty = same origin; dev server proxies /api to http://localhost:8000
   ```
2. Implement these endpoints in FastAPI:

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| POST | `/api/v1/auth/register` | `{ name, email, mobile, destination, intake, consent }` | `{ expiresIn, resendIn }` (a code is emailed) |
| POST | `/api/v1/auth/otp/request` | `{ email }` | `{ expiresIn, resendIn }` (same reply whether or not the account exists) |
| POST | `/api/v1/auth/otp/verify` | `{ email, code }` | `{ user }` and a session cookie |
| POST | `/api/v1/auth/staff/login` | `{ email, password }` | `{ challengeId }` |
| POST | `/api/v1/auth/staff/verify` | `{ challenge_id, code }` | `{ user }` and a session cookie |
| GET | `/api/v1/auth/me` | — | `user`, or 401 |
| POST | `/api/v1/auth/logout` | — | 204 |

- `user` = `{ id, role, name, email, mobile, studentReference }` (see `src/lib/api/types.ts`).
- Sessions should use **HttpOnly, Secure cookies**; the client sends `credentials: 'include'` and never stores tokens.
- Errors should return JSON `{ detail, errors: [{ field, message }], trace_id }`; the client shows `detail` and puts field messages under the matching inputs.
- The demo-only fields `demoCode`, `demoNote` and `demoSecret` must never be returned by the real API.
- Dashboard data currently comes from `src/data/dashboard.ts` (student) and `src/data/staff.ts` (counsellor and admin); replace it with API calls (e.g. `GET /api/v1/students/me/dashboard`) using the same `apiRequest` helper.

> The real portal must not cache personal data in the service worker. This demo caches only the app shell, fonts and public images.

---

## Images

Photos are loaded from [Unsplash](https://unsplash.com) and used under the Unsplash License. If a photo can't load (for example offline), a navy gradient is shown instead.
