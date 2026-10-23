# AHatIn Student Portal — System Architecture

**Prepared for:** AHatIn management and the portal development team
**Date:** 21 October 2026
**Version:** 2.0

---

## 1. Purpose

This document shows how the portal is built: frontend, backend, database, hosting, login, outside services, and how the existing WordPress website connects to it. Each section starts with a short plain-language summary.

Flow charts use Mermaid. They display in GitHub, GitLab and VS Code (with a Mermaid extension).

---

## 2. The big picture

**In plain words:** The WordPress website stays as AHatIn's public website. Its enquiry form sends details straight to the portal. Students, parents and staff use the portal app. The portal's server keeps everything in a secure database in Mumbai and uses outside services for payments, messages and calendars.

```mermaid
flowchart TB
    subgraph L1["1 · People"]
        direction LR
        V["Website visitor"]
        S["Student / Parent"]
        ST["AHatIn staff"]
    end

    subgraph L2["2 · What people open"]
        direction LR
        WP["Existing WordPress website<br/>public pages · enquiry form · Student Login button"]
        FE["AHatIn Portal app<br/>React + Vite PWA · works on phone and computer"]
    end

    subgraph L3["3 · Portal server · AWS Mumbai"]
        direction LR
        API["Backend API · FastAPI<br/>rules, permissions, data"]
        WK["Background workers<br/>reminders, messages, file scans"]
    end

    subgraph L4["4 · Data · Mumbai, India"]
        direction LR
        DB[("MongoDB Atlas<br/>all portal records")]
        FS[("Encrypted file storage<br/>student documents")]
    end

    EXT["Outside services<br/>Razorpay · WhatsApp · Email · SMS · Google login & Calendar"]

    V --> WP
    S --> FE
    ST --> FE
    WP -- "enquiry form sends details" --> API
    WP -- "Student Login button opens" --> FE
    FE -- "secure API calls" --> API
    API --> WK
    API --> DB
    API --> FS
    WK --> DB
    API --> EXT
    WK --> EXT
```

---

## 3. Frontend

**In plain words:** One web app serves everyone and shows each person only their own screens. It can be installed on a phone.

```mermaid
flowchart TB
    PWA["AHatIn Portal app<br/>portal.ahatin-domain"]
    PWA --> LOGIN["Login"]
    PWA --> STU["Student & parent area<br/>tracker, documents, applications, fees, messages"]
    PWA --> STAFF["Staff area<br/>leads, students, tasks, applications, visas"]
    PWA --> ADM["Admin area<br/>users, settings, catalogue, agencies, reports"]
    WID["Website widgets"] --> ENQ["Enquiry form"]
    WID --> CRS["Course widget"]
```

| Concern | Choice |
| --- | --- |
| Framework | React with TypeScript, built with Vite |
| Screens | Ready-made component library in AHatIn's colours; mobile-first |
| Data and forms | TanStack Query; React Hook Form with Zod |
| Installable app | `vite-plugin-pwa` (Workbox): manifest, service worker, web push |
| Widgets | Separate small Vite builds with isolated styles (Shadow DOM) |
| Delivery | Static files on Amazon S3 behind Amazon CloudFront |

---

## 4. Backend

**In plain words:** The backend is the portal's brain. It checks who is asking and whether they are allowed, then reads or writes data. Slow jobs, such as sending messages, go to background workers so nobody waits.

```mermaid
flowchart TB
    REQ["Request from app or widget"] --> GW["API layer · FastAPI<br/>routing, validation, rate limits"]
    GW --> SEC["Security layer<br/>session, permissions, audit log"]
    SEC --> MODS

    subgraph MODS["Business modules"]
        direction LR
        M1["Leads & tasks"]
        M2["Students & counselling"]
        M3["Applications & agencies"]
        M4["Funding & visa"]
        M5["Documents & checklists"]
        M6["Journey & tracker"]
        M7["Fees & commission"]
        M8["Notifications & reports"]
    end

    MODS --> DATA["Data layer · Beanie → MongoDB Atlas"]
    MODS --> Q["Queue · Redis"]
    Q --> W["Celery workers<br/>messages, scans, PDFs, payment checks"]
    SCH["Celery Beat scheduler<br/>runs every minute"] --> Q
```

| Concern | Choice |
| --- | --- |
| Design | One well-organised application ("modular monolith"); easy to build and run, can be split later |
| Language | Python 3.12+, FastAPI, Pydantic |
| Database access | Beanie ODM on PyMongo's async driver |
| API | REST and JSON under `/api/v1`; public widget endpoints under `/api/public`; documentation generated automatically |
| Packaging | Docker images for the API, workers and scheduler |

---

## 5. Database and files

**In plain words:** All records live in one database. Documents are kept in separate encrypted storage and checked for viruses on upload.

```mermaid
flowchart LR
    API["Backend & workers"] -- "private connection" --> ATLAS[("MongoDB Atlas<br/>Mumbai · 3 copies kept in sync")]
    ATLAS --> BK["Continuous backup<br/>restore to any point in 30 days"]
    ATLAS --> SRCH["Atlas Search<br/>CRM and course search"]
    API -- "short-lived upload/download links" --> S3[("Amazon S3 · Mumbai<br/>encrypted, versioned")]
    S3 --> SCAN["Virus scan · ClamAV"]
```

| Concern | Choice |
| --- | --- |
| Database tier | Dedicated MongoDB Atlas cluster (not the free shared tier) |
| Structure | Schema validation, indexes and data migrations defined in code |
| Sensitive fields | Extra encryption with keys in AWS Key Management Service |

---

## 6. Hosting and releases

**In plain words:** Everything runs on Amazon Web Services in Mumbai. A firewall filters harmful traffic, the app's screens load fast from a content delivery network, and the server runs in containers that restart themselves if something fails.

```mermaid
flowchart TB
    U["Browsers"] --> CF["CloudFront CDN + AWS WAF firewall<br/>portal.ahatin-domain"]
    CF -- "app screens" --> S3W[("S3 · app and widget files")]
    CF -- "/api/*" --> ALB["Load balancer"]

    subgraph VPC["AWS Mumbai · private network"]
        ALB --> API["API containers · ECS Fargate · 2 or more"]
        API --> REDIS[("Redis · ElastiCache")]
        REDIS --> WK["Worker containers"]
        SCH["Scheduler container"] --> REDIS
        API & WK --> SM["Secrets Manager + KMS"]
    end

    API & WK --> ATLAS[("MongoDB Atlas")]
    API & WK --> S3D[("S3 · documents")]
    API & WK --> MON["CloudWatch + Sentry<br/>logs, metrics, errors"]
```

| Concern | Choice |
| --- | --- |
| Region | AWS Mumbai (ap-south-1) for all personal data, backups and logs |
| Address | `portal.<ahatin-domain>` serves both the app and the API, so login cookies stay simple and secure |
| Scaling | Containers scale automatically across two availability zones |
| Email | Amazon SES with SPF, DKIM and DMARC on AHatIn's domain |
| Monitoring | Alarms and uptime checks |
| Setup | Terraform, so every environment is built the same way |

```mermaid
flowchart LR
    DEV["Code pushed"] --> CI["GitHub Actions<br/>checks, tests, security scans"]
    CI -- "pass" --> STG["Staging<br/>practice payments & messages"]
    STG -- "Friday demo approved" --> PRD["Production<br/>release with no downtime"]
    CI -- "fail" --> FIX["Fix and push again"]
```

| Environment | Used for | Data |
| --- | --- | --- |
| Development | Building | Fake data |
| Staging | Testing and demos | Fake or anonymised data |
| Production | Live portal | Real data |

---

## 7. Login

**In plain words:** Students and parents log in with a one-time code, so there are no passwords to forget. Staff use their AHatIn Google account with 2-step verification. After login, the browser keeps a secure session that scripts can't read.

```mermaid
flowchart TD
    A["Student opens the portal<br/>or clicks Student Login"] --> B["Enters email or mobile"]
    B --> D["Portal sends a 6-digit code<br/>email / SMS / WhatsApp"]
    D --> E["Student enters code"]
    E --> F{"Code correct<br/>and still valid?"}
    F -- "No" --> E
    F -- "Yes" --> H["Secure session created"]
    H --> I["Student dashboard"]
```

```mermaid
flowchart TD
    A["Staff clicks 'Sign in with Google'"] --> B["Google login + 2-step verification"]
    B --> C{"AHatIn domain and<br/>active staff user?"}
    C -- "No" --> E["Access denied"]
    C -- "Yes" --> F["Secure session created"]
    F --> G["Staff or admin dashboard"]
```

Sessions are stored in MongoDB (with automatic expiry) and cached in Redis, so a session can be ended instantly.

---

## 8. Outside services

**In plain words:** The portal uses trusted services rather than building everything itself. If one is down, the portal keeps working and tries again later.

| Service | Used for |
| --- | --- |
| Razorpay | Third-party fee payments and refunds |
| WhatsApp Business API (approved provider) | Messages, reminders, login codes |
| Amazon SES | Email |
| SMS gateway (registered on India's DLT system) | Login codes and urgent alerts |
| Google | Staff login; Calendar and Meet links |
| Zoom (optional) | Video meetings |
| Web push | App notifications |
| Cloudflare Turnstile | Spam protection on the website form |
| Google Analytics 4 | Following visitors from website to portal |
| Sentry | Error tracking |

### 8.1 Paying a fee

```mermaid
flowchart TD
    A["Student opens a fee<br/>e.g. visa fee"] --> B["Confirms INR amount"]
    B --> C["Server creates Razorpay order"]
    C --> D["Razorpay Checkout<br/>UPI / card / net banking"]
    D --> E{"Result"}
    E -- "Failed or cancelled" --> F["Fee stays Due · try again"]
    E -- "Paid" --> G["Server verifies payment"]
    E -- "Browser closed" --> K["15-minute check with Razorpay"]
    G & K --> I["Fee and ledger updated · receipt sent"]
    I --> J["Officer pays the third party<br/>and records it"]
```

### 8.2 Sending messages and reminders

```mermaid
flowchart LR
    EV["Event<br/>e.g. offer received"] --> NS["Notification service"]
    SCH["Scheduler<br/>follow-up timers"] --> NS
    NS --> Q["Queue"] --> SEND["Worker sends"]
    SEND --> CH["In-app · Email · WhatsApp · SMS · Push"]
    SEND -- "fails 3 times" --> FB["Falls back to email"]
```

---

## 9. WordPress and the portal

**In plain words:** WordPress keeps its public pages, blogs and search ranking, and never stores student data. The small additions below connect it to the portal.

```mermaid
flowchart LR
    subgraph WP["WordPress website"]
        P["Any page"]
        F["Enquiry form widget"]
        C["Course widget · optional"]
        L["Student Login button"]
    end

    subgraph PT["Portal"]
        PUB["Public API"]
        CRM["CRM: new lead<br/>assigned to a counsellor"]
        APP["Portal login page"]
    end

    P --- F & C & L
    F -- "enquiry + consent + campaign source" --> PUB
    PUB --> CRM
    C -- "reads published courses" --> PUB
    L -- "link" --> APP
```

```mermaid
flowchart TD
    A["Visitor fills the form"] --> B["Ticks consent · spam check"]
    B --> D["Sent to the portal"]
    D --> E{"Valid and not spam?"}
    E -- "No" --> E1["Error shown on the form"]
    E -- "Yes" --> F{"Already known?"}
    F -- "Yes" --> G["Added to existing record"]
    F -- "No" --> H["New lead, assigned to a counsellor"]
    G & H --> I["Thank-you message + acknowledgement"]
```

**Changes on WordPress:**

| Change | How |
| --- | --- |
| Enquiry form (including Contact Us) | Paste one `<div>` and one `<script>` tag |
| Course widget (optional) | Script tag on course pages |
| Student Login button | Menu link to `portal.<ahatin-domain>/login` |
| Analytics | One Google Analytics 4 property across both sites |
| Old forms | Kept until the new form is confirmed working, then removed |

---

## 10. Glossary

| Term | Meaning |
| --- | --- |
| API | The addresses the app and widgets use to talk to the server |
| CDN | Servers worldwide that deliver the app's files quickly |
| PWA | A website that can be installed and used like a phone app |
| Widget | A small part of the portal placed inside a WordPress page |
| Worker | A background process for slow jobs |
| Webhook | A message an outside service sends when something happens |
| WAF | A firewall that filters harmful web traffic |
| Replica set | Three synced copies of the database, so one can fail safely |
| DLT | India's registration system for business SMS |
