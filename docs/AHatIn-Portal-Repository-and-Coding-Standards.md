# AHatIn Student Portal — Repository Set-up and Coding Standards

**Prepared for:** The portal development team
**Date:** 21 October 2026
**Version:** 1.0

---

## 1. Purpose

This document sets out how the code repository is organised, how to run the portal locally, how code moves from a branch to production, and the coding standards everyone follows.

---

## 2. Repository

One repository (a "monorepo") holds the frontend, backend, infrastructure and documentation, so a single change can update all of them together.

- **Host:** GitHub, private repository owned by AHatIn's GitHub organisation.
- **Name:** `ahatin-portal`.
- **Access:** two-factor authentication required for every member; no direct pushes to `main`.

### 2.1 Folder structure

```
ahatin-portal/
├── frontend/                  # React + Vite PWA and website widgets
│   ├── src/
│   │   ├── app/               # App shell, routing, providers
│   │   ├── features/          # One folder per feature (leads, students, documents, …)
│   │   │   └── documents/
│   │   │       ├── api.ts     # API calls and TanStack Query hooks
│   │   │       ├── components/
│   │   │       ├── pages/
│   │   │       ├── schemas.ts # Zod schemas
│   │   │       └── *.test.tsx
│   │   ├── components/        # Shared UI components
│   │   ├── lib/               # Utilities (dates, money, formatting)
│   │   ├── api-client/        # Generated from the backend's OpenAPI file — do not edit
│   │   └── i18n/              # Text strings (English now, Hindi later)
│   ├── widgets/
│   │   ├── enquiry/           # Website enquiry form bundle
│   │   └── courses/           # Website course widget bundle
│   ├── e2e/                   # Playwright end-to-end tests
│   └── package.json
├── backend/                   # FastAPI application and workers
│   ├── app/
│   │   ├── main.py            # FastAPI app factory
│   │   ├── core/              # Settings, security, logging, errors, permissions
│   │   ├── db/                # MongoDB connection, Beanie init, transactions
│   │   ├── modules/           # One folder per business module
│   │   │   └── applications/
│   │   │       ├── router.py  # API endpoints only
│   │   │       ├── schemas.py # Request and response models
│   │   │       ├── models.py  # Beanie documents
│   │   │       ├── service.py # Business rules
│   │   │       ├── repository.py # Database queries
│   │   │       └── tasks.py   # Background jobs
│   │   ├── integrations/      # Razorpay, WhatsApp, SES, SMS, Google, storage, ClamAV
│   │   └── workers/           # Celery app and scheduled jobs
│   ├── migrations/            # Versioned index, schema and data migrations
│   ├── seeds/                 # Seed data for development and staging
│   ├── tests/                 # unit/, api/, integration/
│   └── pyproject.toml
├── infra/                     # Terraform (one folder per environment) and Dockerfiles
├── docs/                      # Project documents and architecture decision records (docs/adr/)
├── .github/
│   ├── workflows/             # CI/CD pipelines
│   ├── CODEOWNERS
│   └── pull_request_template.md
├── docker-compose.yml         # Local development services
├── .editorconfig
├── .pre-commit-config.yaml
└── README.md                  # How to run everything locally
```

### 2.2 Tools and versions

Versions are pinned in the repository so everyone, and CI, uses the same ones.

| Area | Tools |
| --- | --- |
| Node | Node.js 22 LTS (`.nvmrc`), **pnpm** for packages |
| Python | Python 3.12, **uv** for packages and virtual environments (`uv.lock` committed) |
| Frontend quality | ESLint, Prettier, TypeScript in strict mode, Vitest, Testing Library, Playwright |
| Backend quality | Ruff (lint and format), mypy (strict), pytest, pytest-asyncio, httpx test client |
| Shared | pre-commit hooks, EditorConfig, Docker, Docker Compose |
| Security | Dependabot, `pip-audit`, `pnpm audit`, gitleaks (secret scanning), OWASP ZAP (staging) |

---

## 3. Local development

### 3.1 Services started by Docker Compose

| Service | Purpose |
| --- | --- |
| MongoDB (single-node replica set) | Database; a replica set is needed for transactions |
| Redis | Queue and cache |
| MinIO | Local stand-in for Amazon S3 |
| Mailpit | Catches all emails so none go to real people |
| ClamAV | Virus scanning |

Razorpay, WhatsApp and SMS run in **test mode or a fake adapter** locally. Real messages are never sent from a laptop.

### 3.2 Getting started

```bash
git clone git@github.com:<ahatin-org>/ahatin-portal.git
cd ahatin-portal
cp backend/.env.example backend/.env       # fill in local values only
cp frontend/.env.example frontend/.env
docker compose up -d                       # MongoDB, Redis, MinIO, Mailpit, ClamAV
cd backend && uv sync && uv run python -m migrations up && uv run python -m seeds dev
uv run fastapi dev app/main.py             # API on http://localhost:8000
uv run celery -A app.workers worker -B     # workers + scheduler (second terminal)
cd ../frontend && pnpm install && pnpm dev # app on http://localhost:5173
pre-commit install                         # once, from the repository root
```

The Vite dev server forwards `/api` to the backend, matching production, where the app and API share one address.

### 3.3 Configuration and secrets

- All settings come from environment variables, read in one place (`backend/app/core/settings.py`, a Pydantic Settings class; `frontend/src/lib/env.ts` for the frontend).
- `.env.example` files list every variable with a safe example value. Real `.env` files are never committed (`.gitignore`, and gitleaks blocks them).
- Staging and production secrets live only in AWS Secrets Manager.
- Frontend variables are public by nature: never put a secret in a `VITE_` variable.
- Feature flags (payments live, WhatsApp, SMS, push) are settings, defaulting to **off**.

---

## 4. Branches, commits and pull requests

### 4.1 Branching

- `main` is always releasable. It is protected: changes only through pull requests, with passing checks and one approval.
- Work happens on short-lived branches (ideally merged within 2 days), named `type/short-description`, e.g. `feat/lead-assignment`, `fix/otp-resend-timer`, `chore/update-deps`.
- Pull requests are **squash-merged**, so each one becomes a single commit on `main`.
- Unfinished features can be merged behind a feature flag rather than kept on long branches.

### 4.2 Commit messages

Conventional Commits format: `type(scope): summary`, in the imperative, under 72 characters.

| Type | Use |
| --- | --- |
| `feat` | New behaviour |
| `fix` | Bug fix |
| `refactor` | Code change with no behaviour change |
| `test` | Tests only |
| `docs` | Documentation |
| `chore` / `ci` / `build` | Tooling, pipeline, dependencies |

Example: `feat(applications): block submission until documents are verified`

### 4.3 Pull requests

- Small: aim for under 400 changed lines.
- The template asks for: what changed and why, the requirement IDs it covers (e.g. `FR-APP-03`), screenshots for UI changes, how it was tested, and any migration.
- At least one reviewer approves. `CODEOWNERS` requires a second reviewer for `core/`, `integrations/payments/`, `migrations/` and `infra/`.
- The author resolves every comment before merging.

### 4.4 Review checklist

- [ ] Meets the requirement and its acceptance criteria
- [ ] Permissions checked on the server (role and record)
- [ ] Input validated; errors use the standard error format
- [ ] Tests added or updated, and passing
- [ ] No secrets, personal data or debug output in code or logs
- [ ] Database queries use an index; new indexes added in a migration
- [ ] Text shown to users is in plain English and comes from the i18n files
- [ ] Works on a phone-sized screen and with the keyboard

---

## 5. Continuous integration and releases

| Stage | Runs on | Steps |
| --- | --- | --- |
| Pull request checks | Every push to a pull request | Lint, format check, type check, unit and API tests, frontend build, dependency audit, secret scan, coverage report |
| Merge to `main` | Every merge | All checks again; build Docker images and frontend files; deploy to **staging**; run migrations; run end-to-end tests |
| Release to production | Manual approval after the Friday demo | Deploy the **same** images that passed staging; run migrations; rolling restart; smoke tests |
| Nightly | Schedule | OWASP ZAP scan of staging; full end-to-end suite |

- **Rollback:** redeploy the previous image tag. Migrations must therefore work with both the old and new code.
- **Versions:** each production release is tagged `vYYYY.MM.DD-N` (e.g. `v2026.12.28-1`), with release notes generated from the commit messages.

---

## 6. Coding standards — general

1. **Readable first.** Clear names beat comments. Comments explain *why*, not *what*.
2. **Small functions** with one job. Anything longer than about 40 lines is a hint to split.
3. **No dead code** or commented-out code; Git remembers it.
4. **No magic numbers.** Time limits, sizes and rates come from settings or named constants.
5. **Fail clearly.** Raise a specific error; never swallow exceptions silently.
6. **Same words everywhere.** Use the business terms consistently: lead, student, stage, service, partner agency, follow-up rule, checklist, fee.
7. **Dates and money:** store UTC; show IST. Money always as whole minor units with a currency, never floats.
8. **Personal data:** only collect what is needed; never log it; never send it to analytics or error tracking.

---

## 7. Backend standards (Python / FastAPI)

### 7.1 Style and structure

- Formatting and linting by Ruff (line length 100); type hints everywhere; mypy in strict mode.
- Names: `snake_case` for functions and variables, `PascalCase` for classes, `UPPER_CASE` for constants.
- Each module follows the same layers: **router → service → repository**.

| Layer | Does | Must not |
| --- | --- | --- |
| `router.py` | Declare endpoints, parse input, call the service, return responses | Contain business rules or database queries |
| `service.py` | Business rules, permission decisions, transactions, events | Know about HTTP requests or responses |
| `repository.py` | Database reads and writes | Contain business rules |
| `tasks.py` | Background jobs that call services | Hold long-running logic directly |

- Modules talk to each other through each other's **service** functions, never by querying each other's collections directly.

### 7.2 API design

- Base path `/api/v1`; public website endpoints under `/api/public`.
- Plural nouns for resources: `GET /api/v1/students/{id}/applications`.
- Actions that are not simple updates use a sub-path verb: `POST /api/v1/applications/{id}/submit`.
- JSON in `snake_case`.
- Lists are paginated with `page` and `page_size` (25, 50 or 100) and return `{ items, total, page, page_size }`.
- Create requests accept an `Idempotency-Key` header.
- Updates send the record's `version`; a mismatch returns 409.
- Every endpoint has request and response models, a summary, and its possible errors, so the generated API documentation and frontend client are complete.

### 7.3 Errors

- Raise domain errors (e.g. `NotFound`, `PermissionDenied`, `RuleViolation`, `Conflict`) from services. One exception handler turns them into the standard JSON error with a trace ID.
- Never return stack traces or internal messages to the client.
- Return 404, not 403, for records the user may not see.

### 7.4 Database

- Use Beanie models and the repository layer; no raw queries built from user input.
- Reject user input containing MongoDB operators (keys starting with `$` or containing `.`).
- Every query used by a list, search, scheduler or dashboard must match an index; check with `explain()` in tests for new queries.
- Multi-collection changes use the transaction helper in `app/db/transactions.py`.
- Encrypted fields are only read and written through the helpers in `app/core/crypto.py`.

### 7.5 Background jobs

- Jobs must be **idempotent** (safe to run twice) and accept IDs, not whole objects.
- Set a retry policy (3 attempts with backoff) and a timeout on every job.
- Scheduled jobs record their last successful run, so a missed run catches up.

### 7.6 Logging

- Structured JSON logs with `trace_id`, `user_id` (ID only), `module` and `event`.
- Levels: `debug` locally only; `info` for business events; `warning` for handled problems; `error` for failures needing attention.
- Never log OTP codes, cookies, tokens, passport numbers, dates of birth, payment details, document contents, or full email addresses and phone numbers (mask them).

### 7.7 Outside services

- Every outside service sits behind an adapter in `app/integrations/`, with a fake version for local use and tests.
- Calls have timeouts (5 seconds by default) and retries only where safe.
- Webhooks verify their signatures first and record the event ID to avoid processing it twice.

---

## 8. Frontend standards (React / TypeScript)

### 8.1 Style and structure

- TypeScript `strict`; no `any` (use `unknown` and narrow it).
- ESLint and Prettier decide formatting; don't argue about it in reviews.
- Function components and hooks only.
- Names: `PascalCase` for components and their files (`StudentTracker.tsx`), `camelCase` for functions and variables, `useSomething` for hooks.
- Feature code lives in `src/features/<feature>/`. Shared pieces move to `src/components/` or `src/lib/` only when a second feature needs them.

### 8.2 Data and state

- Server data only through TanStack Query hooks in each feature's `api.ts`, using the generated API client; never call `fetch` directly in components.
- Local UI state with `useState` or `useReducer`. Add a global store only if it's clearly needed.
- Forms with React Hook Form and Zod schemas. The server still validates everything.
- Never store personal data or tokens in `localStorage`, `sessionStorage` or IndexedDB. The service worker caches only the app's own files.

### 8.3 User experience

- Mobile-first layouts, tested at 360 px wide.
- Every page handles four states: loading, empty, error (with a retry), and success.
- Show field errors next to the field and a summary at the top, and move focus to the first error.
- Use the shared formatting helpers for dates (`21 Oct 2026`) and money (`₹1,25,000`).
- All visible text comes from the `i18n` files, not hard-coded strings.

### 8.4 Accessibility

- Semantic HTML first (`button`, `label`, `nav`, headings in order).
- Everything works with the keyboard and has a visible focus outline.
- Images have `alt` text; icons used as buttons have an accessible name.
- Colour contrast at least 4.5:1; colour is never the only signal (e.g. the tracker also uses text and icons).

### 8.5 Widgets

- Widgets are separate Vite library builds, kept under 100 KB gzipped, with styles isolated in Shadow DOM.
- They must not depend on the main app's code beyond shared utilities, and must not set cookies other than the campaign-tracking cookie.

---

## 9. Testing standards

| Level | Tool | What to test | Target |
| --- | --- | --- | --- |
| Unit | pytest, Vitest | Business rules, calculations (money, dates, follow-up timings, service status), validators | 80%+ line coverage for `service.py` files and `lib/` |
| API | pytest + httpx | Every endpoint: success, validation errors, **permission checks for each role** | Every endpoint |
| Integration | pytest with Docker services | Transactions, migrations, queue jobs, adapters (using fakes) | Key flows |
| End-to-end | Playwright | Main journeys on desktop and mobile viewports | Enquiry → registration → application → visa → arrival → Settled; fee payment (test mode) |
| Accessibility and speed | Lighthouse CI, axe | Main pages | Lighthouse 90+ for performance, accessibility and best practices |

- Tests use factories and seed data, never real personal data.
- A bug fix includes a test that would have caught the bug.
- Flaky tests are fixed or removed within a day, not ignored.

---

## 10. Definition of done

A piece of work is done when:

- [ ] It meets the requirement and its acceptance criteria
- [ ] Code is reviewed, approved and merged to `main`
- [ ] Unit and API tests (including permissions) are written and passing; end-to-end tests updated where a journey changed
- [ ] Lint, type checks, security scans and coverage pass in CI
- [ ] Migrations and seed data are added if the data changed
- [ ] It is deployed to staging and checked there, on desktop and phone
- [ ] Audit logging is in place for changes to student data
- [ ] User-facing text is plain, in the i18n files, and reviewed
- [ ] The README or an architecture decision record is updated if set-up or design changed
- [ ] It has been shown at the Friday demo

---

## 11. Documentation

- `README.md` at the root: how to run, test and deploy, kept up to date.
- **Architecture decision records** in `docs/adr/`, one short file per significant decision (`0001-use-mongodb-atlas.md`): context, decision, consequences.
- API documentation is generated by FastAPI and published on staging at `/api/docs` (staff login required); it is turned off in production.
- Code comments explain non-obvious business rules, with the requirement ID (e.g. `# FR-VISA-03: filing needs funds pass, form review and fee paid`).

---

## 12. Dependencies

- Add a new library only when it saves real effort and is actively maintained; mention it in the pull request.
- Lock files (`pnpm-lock.yaml`, `uv.lock`) are always committed.
- Dependabot opens weekly update pull requests; security updates are merged within 7 days (critical ones within 2).
- No library may send data to outside services unless it is one of the approved integrations.
