# AHat — Website & Student Portal (frontend)

The AHat International Educational Consultancy website and student portal, built with **React, TypeScript, Vite and PWA** support. All data comes from the FastAPI backend in `../backend`; the UI is the same as the original demo (`../ahat-in-demo`).

> The demo data loaded by the backend (`python -m app.seed`) uses fictional people, figures and agencies, labelled "Demo" in the app. Website content (stories, figures, contact details) is still demo content. Build with `VITE_SHOW_DEMO_HINTS=false` to hide the demo labels and sign-in hints.

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
| **Student dashboard** (login required) | Greeting and overall progress ring; 7-service application progress tracker; applications with status, deadlines and expandable details; document checklist with filters and uploads (file type and size checked in the browser, then real file type and virus scan on the server); profile and counsellor card. Everything is saved on the server |
| **Notifications** | Short one-line box (with a count on the bell) at the top of the right column, first on phones. Lists only what's waiting on the student: re-uploads, offers to reply to, shortlist to review, documents to upload (grouped), funding plan, travel checklist, arrival, the next session within a week, missing profile details. Urgent items are marked red; each item jumps to its section; items disappear when done |
| **Profile and account menu** | The profile card shows name, email and counsellor; clicking it opens the full profile details. The avatar in the top bar opens a menu with My dashboard, **My profile** (opens the details) and Log out |
| **Edit profile** | Dialog with validation (date of birth, test scores checked against each test's range, required fields). Name and email can't be edited; passport number locks once an application is submitted |
| **Sessions** | Book a session with your assigned counsellor: dates and time slots come from that counsellor's availability and time off (taken slots disabled), online or office where the slot allows it, notes. Up to 3 upcoming sessions; cancel with confirmation |
| **Application progress (linked)** | Each of the 7 services moves automatically from real events in one shared student record, the same on the student dashboard and the staff record: first session booked / career plan shared (when completing a Career counselling session or from the Journey panel) → shortlist shared and **approved by the student** (choose, remove with reason, ask questions; approval creates draft applications) → application submitted / **offer accepted** → funding plan, scholarships and **proof of funds verified** → visa stages recorded by staff up to granted or refused → student ticks the **pre-departure checklist**, counsellor confirms → student taps **"I've arrived"**, counsellor records the final check-in. Progress never moves back by itself; counsellors can override a service with a reason (e.g. **Not needed**, which is left out of the percentage). Documents (with proof-of-funds and visa categories) and applications are shared too, and every event is logged in the student's history |
| **Messages** | Chat between each student and their counsellor (or whoever is covering). Students use the Messages box on the dashboard; staff use the Messages section of the student record and see an **Unread messages** list on Today. Enter sends, Shift+Enter adds a line; messages show “Read” once seen (only when the chat is on screen); unread replies appear in the student's Notifications. Counsellors only see their own (or covered) students' messages |
| **Shared data** | Leads, students (with their documents, applications and journey), sessions, availability, time off and cover access live on the server, so a student's booking appears in the counsellor's schedule straight away, on any device. Screens refresh after every change, when the tab comes back into view, and every 15–60 seconds for messages and work lists. In development, **Admin → Settings → Reset demo data** restores the original data |
| **Applications** | Read-only for students (staff submit applications and update status). Students can view offer conditions and **accept or decline** an offer (one acceptance per intake); accepting updates the progress tracker |
| **PWA** | Installable app, offline app shell, cached fonts and images, "new version available" prompt |
| **Quality** | Responsive from 360 px, keyboard accessible, skip link, reduced-motion support, scroll-reveal animations, image fallbacks when offline |

## Demo accounts

| Role | Where to log in | Email | Password | Second step |
| --- | --- | --- | --- | --- |
| Student (journey under way) | **Student Login** (`/login`) | `demo.student@ahatin.example` | none | 6-digit code shown on screen |
| Student (nothing started; counsellor Priya) | **Student Login** (`/login`) | `new.student@ahatin.example` | none | 6-digit code shown on screen |
| Counsellor | **Staff sign in** (`/staff/login`) | `demo.counsellor@ahatin.example` | `Staff@1234` | Code from the on-screen demo authenticator |
| Admin | **Staff sign in** (`/staff/login`) | `demo.admin@ahatin.example` | `Admin@1234` | Code from the on-screen demo authenticator |

These accounts come from the backend's demo data. In development the backend returns the one-time code and the authenticator secret, so they are shown on screen with a "Fill it in" button, and emails are written to the backend log. New staff added by an admin get a set-up link (`/staff/setup/…`) to choose a password and connect an authenticator app.

---

## Requirements

- **Node.js 20 or later** (tested with Node 22)
- npm 10+

## Setup

Start the backend first (see `../backend/README.md`), then:

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173 (proxies /api to http://localhost:8000)
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Type-check and build for production into `dist/` (includes the service worker) |
| `npm run preview` | Serve the production build at http://localhost:4173 (also proxies /api) |
| `npm run typecheck` | TypeScript check only |
| `npm run icons` | Regenerate the PWA PNG icons in `public/` (no extra packages needed) |

To test the installable app and offline mode, use `npm run build` and `npm run preview`. The service worker is disabled in development.

---

## Deploying to Vercel

The project is ready for Vercel: `vercel.json` sets the build (`npm ci`, `npm run build`, output `dist`), sends every page address to the app so links like `/staff/schedule` work when opened directly or refreshed, sets caching for the service worker, and adds basic security headers. The API must be reachable on the same domain under `/api` (for example a rewrite of `/api/:path*` to the backend), so the session cookie stays first-party.

**Option A: Vercel CLI (no GitHub needed)**

```bash
npx vercel login
npx vercel          # first time: answer the set-up questions; creates a preview link
npx vercel --prod   # publishes the production link to share
```

**Option B: GitHub.** Push this folder to a GitHub repository, then in Vercel choose **Add New → Project**, import the repository and click **Deploy**. Vercel reads the settings from `vercel.json`. If the repository contains more than this folder, set **Root Directory** to `frontend`.

**Before sharing with the client**

- The demo is kept out of search engines (`robots.txt`, a `noindex` header and meta tag), but anyone with the link can open it. To require a password, use Vercel's Deployment Protection settings, which depend on your Vercel plan.
- All visitors share the same server data. **Admin → Settings → Reset demo data** (development only) restores the original data.
- After a new deployment, open visitors see a "new version available" prompt.

---

## Project structure

```
frontend/
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
│   │   ├── api/            # API client (cookies + CSRF), data cache, auth service, shared types
│   │   ├── validation.ts   # Zod schemas for forms
│   │   └── utils.ts
│   ├── hooks/              # useReveal, useStaffData (API data hooks), useJourney (journey events)
│   ├── data/               # Site content, shared types and labels
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

## How the frontend talks to the backend

- `src/lib/api/client.ts` sends every request to `/api/v1` with the session cookie and the CSRF token, and turns the
  backend's errors (`{ detail, errors: [{ field, message }], trace_id }`) into messages under the right fields.
- `src/lib/api/store.ts` is a small shared cache: every screen showing the same data reads the same entry, and after any
  change the data on screen is fetched again. Failed changes show a short message at the bottom of the screen.
- `src/hooks/useStaffData.ts` and `src/hooks/useJourney.ts` hold every read and every action; the server applies the
  rules (who may do what, allowed status changes, slot checks) and writes the history notes.
- Settings (`.env`): `VITE_API_BASE_URL` (empty = same origin) and `VITE_SHOW_DEMO_HINTS` (false in production).

> The service worker never caches personal data: only the app shell, fonts and public images (API calls are excluded).

---

## Images

Photos are loaded from [Unsplash](https://unsplash.com) and used under the Unsplash License. If a photo can't load (for example offline), a navy gradient is shown instead.
