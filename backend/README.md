# AHat portal API

FastAPI + MongoDB backend for the AHat student portal in `../frontend`. Every screen in the frontend reads and
changes its data through this API: student records, journey events, documents (real file uploads), applications,
sessions and availability, chat, leads, follow-ups, staff accounts, temporary access, agencies and the admin overview.

## Run it locally

Needs Python 3.12 and MongoDB (a local `mongod` on port 27017 is enough; no replica set needed).

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt -r requirements-dev.txt
Copy-Item .env.example .env
.\.venv\Scripts\python.exe -m app.seed                 # demo data (same people and records as the demo app)
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

Then in `../frontend`: `npm run dev` and open http://localhost:5173 (the dev server proxies `/api` to port 8000).

Demo sign-ins (development only):

| Who | Sign in |
| --- | --- |
| Student (journey under way) | demo.student@ahatin.example, code shown on screen |
| Student (nothing started) | new.student@ahatin.example, code shown on screen |
| Counsellor | demo.counsellor@ahatin.example / Staff@1234, then the on-screen authenticator code |
| Admin | demo.admin@ahatin.example / Admin@1234, then the on-screen authenticator code |
| Other staff | rohan.k@, neha.j@ (counsellors), sameer.k@ (officer) @ahatin.example / Staff@1234 |

In development the API returns one-time codes, authenticator secrets and invitation links so the UI can show them,
and writes emails to the log. None of this happens when `APP_ENV=production`.

API docs (development): http://localhost:8000/api/docs

## Tests

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

The tests run against a separate database (`ahat_test`) on the same MongoDB.

## How it is built

- `app/routers/`: `auth` (student one-time codes; staff password + authenticator; staff invitations), `students`
  (records and every journey event), `schedule` (sessions, availability, time off), `messages`, `staff` (leads,
  follow-ups, scope, agencies, settings), `admin`, `public` (website enquiries), `files` (development file storage).
- `app/services/`: assignment and follow-ups, slot rules, email outbox, calendar invitations, file storage and virus scanning.
- `app/worker.py`: background jobs (sending emails, alerting managers about overdue follow-ups, session and deadline
  reminders, clean-up). They run inside the API when `RUN_BACKGROUND_JOBS=true`, or separately with `python -m app.worker`.
- Security: HttpOnly session cookie with idle and absolute timeouts, CSRF double-submit token, Argon2 passwords,
  authenticator codes that can't be reused, rate limits, role and record-level access checks on every request
  (records outside someone's scope answer "not found"), encrypted passport numbers and authenticator secrets,
  an audit log of sensitive actions, and uploads checked for size, real file type and viruses.

## Production checklist

1. `APP_ENV=production`, `COOKIE_SECURE=true`, long random `SESSION_SECRET` and `OTP_PEPPER`, a `FIELD_ENCRYPTION_KEY`.
2. MongoDB with authentication and backups (e.g. MongoDB Atlas).
3. `STORAGE_BACKEND=s3` with a private bucket, and a ClamAV daemon (`CLAMAV_HOST`).
4. Email: `RESEND_API_KEY` (a "sending access" key) and `MAIL_FROM` on a domain verified in Resend (or SMTP settings instead).
5. Serve the frontend and `/api` from the same domain (reverse proxy), and build the frontend with `VITE_SHOW_DEMO_HINTS=false`.
6. Create the first administrator: `python -m app.seed --bootstrap-admin you@example.com "Your Name"` (prints a one-time set-up link).
   Never run the demo seed in production (it refuses to).
