# SahAI — Complete Codebase Map

> Last updated: May 6, 2026  
> Purpose: Authoritative reference for what is built, what is partial, and what is missing. Use this before starting any new work session.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Monorepo Structure](#3-monorepo-structure)
4. [Backend — FastAPI](#4-backend--fastapi)
5. [Dashboard — Next.js](#5-dashboard--nextjs)
6. [Mobile — Expo](#6-mobile--expo)
7. [Shared Types Package](#7-shared-types-package)
8. [Database Schema](#8-database-schema)
9. [Third-Party Integrations](#9-third-party-integrations)
10. [Auth & Security](#10-auth--security)
11. [Feature Completion Matrix](#11-feature-completion-matrix)
12. [Known Bugs & Broken Wiring](#12-known-bugs--broken-wiring)
13. [TODOs in Code](#13-todos-in-code)
14. [What Works End-to-End](#14-what-works-end-to-end)
15. [What Needs to Be Built Next](#15-what-needs-to-be-built-next)

---

## 1. Project Overview

**Sahai** ("companion" in Hindi) is a **consent-first, offline-friendly clinical decision-support system** for ASHA (Accredited Social Health Activist) field workers in India.

The core flow is:
1. ASHA obtains **informed consent** from patient in their local language (one of 22 supported).
2. ASHA **records** the visit conversation.
3. Audio is **transcribed** (Whisper), **extracted** (Claude), and **risk-scored** (deterministic rules).
4. A **referral note + follow-up plan** is generated (Claude) and read back to the ASHA in their language.
5. The visit **syncs** to a PostgreSQL database.
6. An **ANM Supervisor dashboard** (Next.js) shows aggregated district-level stats and heatmaps.

The current codebase is scoped as a **hackathon-ready demo** with the full backend pipeline and a working mobile UI prototype. Production hardening (persistence, real auth, mobile↔backend wiring, clinical governance) is the next phase.

---

## 2. Tech Stack

| Layer | Technology | Version / Notes |
|-------|-----------|----------------|
| **Mobile** | Expo | SDK 55 |
| **Mobile** | React Native | 0.83 |
| **Mobile** | React | 19 |
| **Mobile** | TypeScript | Yes |
| **Mobile** | `expo-speech` | TTS readback |
| **Dashboard** | Next.js | 14 (App Router) |
| **Dashboard** | React | 18 |
| **Dashboard** | Tailwind CSS | 3 |
| **Dashboard** | SWR | Data fetching |
| **Dashboard** | TypeScript | Yes |
| **Backend** | FastAPI | Python |
| **Backend** | SQLAlchemy | ORM |
| **Backend** | PostgreSQL | Primary DB (`psycopg2`) |
| **Backend** | Pydantic | Request/response validation |
| **Backend** | Anthropic SDK | Claude (extraction, referral) |
| **Backend** | OpenAI SDK (async) | Whisper ASR |
| **Backend** | python-dotenv | Env config |
| **Backend** | httpx | Async HTTP client |
| **Backend** | pytest | Test suite |
| **Shared** | TypeScript package | `@sahai/shared-types` (not yet consumed) |
| **Declared, unused** | scikit-learn, pandas, numpy | In `requirements.txt`, zero imports in codebase |
| **Declared, unused** | python-jose, passlib, alembic | In `requirements.txt`, no code implementation |

---

## 3. Monorepo Structure

```
/Volumes/Shreyas Projects/SahAI/
├── .git/
├── .venv/                          # Local Python virtualenv (not app code)
├── CODEBASE_MAP.md                 # ← This file
└── sahai/                          # ← ALL application code lives here
    ├── README.md                   # Setup and run instructions
    ├── IMPLEMENTATION_PLAN.md      # Original handoff checklist and roadmap
    ├── package.json                # Root workspace; postinstall patches Expo CLI
    ├── .npmrc                      # install-strategy=nested
    ├── .gitignore
    ├── scripts/
    │   └── patch-expo-cli-node-builtins.js   # Fixes Metro externals for Node 24
    ├── apps/
    │   ├── mobile/                 # Expo React Native app
    │   └── dashboard/              # Next.js supervisor dashboard
    ├── packages/
    │   └── shared-types/           # Domain TypeScript interfaces (not wired in)
    └── backend/                    # FastAPI application
```

### `sahai/apps/mobile/`
```
apps/mobile/
├── package.json
├── tsconfig.json
├── app.json                        # Expo config: name "Sahai", slug "sahai"
├── babel.config.js
├── index.js                        # Entry point → App.tsx
└── App.tsx                         # SINGLE FILE — entire mobile UI
```

### `sahai/apps/dashboard/`
```
apps/dashboard/
├── package.json
├── tsconfig.json
├── next.config.mjs
├── tailwind.config.ts
├── postcss.config.js
├── next-env.d.ts
└── app/
    ├── layout.tsx                  # Root layout, AuthProvider, sidebar
    ├── page.tsx                    # "/" — static marketing homepage
    ├── login/
    │   └── page.tsx                # Login form
    ├── dashboard/
    │   ├── page.tsx                # Main dashboard (live data via SWR)
    │   └── heatmap/
    │       └── page.tsx            # District heatmap
    ├── api/
    │   ├── auth/
    │   │   ├── login/route.ts      # POST — BFF login proxy
    │   │   └── logout/route.ts     # POST — clears cookie
    │   ├── dashboard/
    │   │   └── summary/route.ts    # GET — proxy to FastAPI
    │   └── dashboard/
    │       └── district-heatmap/route.ts  # GET — proxy to FastAPI
    └── components/
        ├── AuthContext.tsx          # Auth state (pre-seeded as logged-in!)
        ├── DashboardShell.tsx       # Sidebar + layout wrapper
        ├── Skeletons.tsx            # Loading state components
        └── (inline components in page files)
```

### `sahai/backend/`
```
backend/
├── requirements.txt
├── .env.example
├── main.py                         # FastAPI app, router registration
├── app/
│   ├── models.py                   # SQLAlchemy VisitORM
│   ├── database.py                 # DB engine + session factory
│   ├── routers/
│   │   ├── asr.py                  # POST /api/asr/transcribe
│   │   ├── consent.py              # POST /api/consent/record
│   │   ├── system.py               # GET /api/system/capabilities
│   │   ├── extract.py              # POST /api/extract
│   │   ├── risk.py                 # POST /api/risk/score
│   │   ├── referral.py             # POST /api/referral/generate
│   │   ├── sync.py                 # POST /api/sync/visit, GET /api/sync/status/{ashaId}
│   │   └── dashboard.py            # GET /api/dashboard/summary, /district-heatmap
│   └── services/
│       ├── asr_service.py          # Whisper transcription + offline stub
│       ├── consent_service.py      # Consent validation logic
│       ├── extraction_service.py   # Claude extraction prompt + parser
│       ├── risk_engine.py          # Deterministic rule-based risk scoring
│       └── referral_service.py     # Claude referral + fallback
├── tests/
│   └── test_full_pipeline.py       # Integration tests (mocked AI clients)
└── scripts/
    └── seed_demo_data.py           # Populates DB with demo ASHA/patient/visit data
```

### `sahai/packages/shared-types/`
```
packages/shared-types/
├── package.json                    # name: "@sahai/shared-types"
├── tsconfig.json
├── index.ts                        # Domain interfaces
└── src/
    └── index.ts                    # Re-exports ../index
```

---

## 4. Backend — FastAPI

### Environment Variables (`.env.example`)

| Variable | Required | Purpose |
|----------|----------|---------|
| `OPENAI_API_KEY` | Yes (for ASR) | Whisper transcription |
| `ANTHROPIC_API_KEY` | Yes (for extraction); optional for referral | Claude calls |
| `ANTHROPIC_MODEL` | No | Defaults to `claude-sonnet-4-6` |
| `DATABASE_URL` | Yes (for sync/dashboard) | PostgreSQL connection string |
| `JWT_SECRET_KEY` | Declared, **unused** | No auth router exists yet |

### API Endpoints

#### Health
| Method | Path | Status | Notes |
|--------|------|--------|-------|
| `GET` | `/health/` | ✅ Implemented | Returns version + liveness |

#### ASR
| Method | Path | Status | Notes |
|--------|------|--------|-------|
| `POST` | `/api/asr/transcribe` | ✅ Implemented | Multipart: `audio_file` + `language_code` + `consent_json` → Whisper |

**Consent gate:** Checks `consentGranted === true` before calling Whisper. Returns 403 if consent missing.  
**TODO in code:** `# TODO: add slowapi limiter in production`

#### Consent
| Method | Path | Status | Notes |
|--------|------|--------|-------|
| `POST` | `/api/consent/record` | ⚠️ Partial | Validates and returns receipt — **not persisted to DB** |
| `POST` | `/api/consent/withdraw` | ❌ Missing | Listed in `IMPLEMENTATION_PLAN.md`, not implemented |

#### System
| Method | Path | Status | Notes |
|--------|------|--------|-------|
| `GET` | `/api/system/capabilities` | ✅ Implemented | Returns 22 language codes, privacy posture, model info |

#### Extraction
| Method | Path | Status | Notes |
|--------|------|--------|-------|
| `POST` | `/api/extract` | ✅ Implemented | Claude prompt → vitals, symptoms, chief complaint |

Response schema: `{ vitals, symptoms, chiefComplaint, dataQuality }`. Note: **`riskScore`/`riskLevel` are NOT returned** even though Claude's prompt may produce them — they are stripped in the response model.

#### Risk
| Method | Path | Status | Notes |
|--------|------|--------|-------|
| `POST` | `/api/risk/score` | ✅ Implemented | Deterministic rules on extracted data + patient profile |

Risk levels: `LOW`, `MODERATE`, `HIGH`, `CRITICAL`. Rules cover BP, SpO2, heart rate, glucose, pregnancy flags, symptom severity.

#### Referral
| Method | Path | Status | Notes |
|--------|------|--------|-------|
| `POST` | `/api/referral/generate` | ✅ Implemented | Claude → referral text + follow-up plan; safe fallback if no key |

#### Sync
| Method | Path | Status | Notes |
|--------|------|--------|-------|
| `POST` | `/api/sync/visit` | ✅ Implemented | Upsert to `visits` table; logs "ANM alert" on HIGH/CRITICAL |
| `GET` | `/api/sync/status/{ashaId}` | ✅ Implemented | Pending count + last sync time |

#### Dashboard
| Method | Path | Status | Notes |
|--------|------|--------|-------|
| `GET` | `/api/dashboard/summary` | ✅ Implemented | 7-day aggregation from `visits`; scoped by `anmId` via `DEMO_SUPERVISION_MAP` |
| `GET` | `/api/dashboard/district-heatmap` | ✅ Implemented | District rollups from `extractedVitals._metadata.district` |

#### Auth — **MISSING**
| Method | Path | Status | Notes |
|--------|------|--------|-------|
| `POST` | `/api/auth/login` | ❌ Missing | Next.js calls this but **no FastAPI router exists** |

### Services

| Service | File | Status | Notes |
|---------|------|--------|-------|
| ASR | `asr_service.py` | ✅ + stub | `transcribe_audio()` uses Whisper; `transcribe_audio_offline_stub()` is a demo stub **not wired into any route** |
| Consent | `consent_service.py` | ✅ | Validates scope, language, timestamps |
| Extraction | `extraction_service.py` | ✅ | Claude prompt with anti-injection framing |
| Risk Engine | `risk_engine.py` | ✅ | Fully deterministic; documented rules |
| Referral | `referral_service.py` | ✅ | Claude + `_fallback_referral()` for graceful degradation |

### Tests

| File | Coverage | Status |
|------|----------|--------|
| `tests/test_full_pipeline.py` | Full ASR→extract→risk→referral pipeline | ✅ With mocked OpenAI/Anthropic clients |

---

## 5. Dashboard — Next.js

### Pages & Routes

| Route | Status | Data Source | Notes |
|-------|--------|-------------|-------|
| `/` | ⚠️ Static placeholder | Hardcoded | Fake KPIs and fake high-risk patient list; **not wired to API** |
| `/login` | ⚠️ Broken | `POST /api/auth/login` → FastAPI | **FastAPI auth login doesn't exist** → login will fail |
| `/dashboard` | ✅ Live (needs DB) | `GET /api/dashboard/summary` via SWR | Works when FastAPI running + DB seeded |
| `/dashboard/heatmap` | ✅ Implemented | `GET /api/dashboard/district-heatmap` | **Not linked from sidebar** (sidebar items are `#` anchors) |
| `/dashboard/patient/[id]` | ❌ Missing | — | Linked from dashboard table ("View Details") → **404** |

### Next.js BFF API Routes

| Route | Status | Notes |
|-------|--------|-------|
| `POST /api/auth/login` | ⚠️ Broken | Proxies to `FASTAPI_BASE_URL/api/auth/login` — backend endpoint doesn't exist; sets `sahai_dashboard_token` cookie |
| `POST /api/auth/logout` | ✅ | Clears `sahai_dashboard_token` cookie — no server-side session invalidation |
| `GET /api/dashboard/summary` | ✅ | Proxy to FastAPI |
| `GET /api/dashboard/district-heatmap` | ✅ | Proxy to FastAPI |

### Components

| Component | File | Status | Notes |
|-----------|------|--------|-------|
| `AuthContext` | `components/AuthContext.tsx` | ⚠️ | **Initializes `user` as non-null** (ANM Supervisor) → app appears logged-in without authentication |
| `DashboardShell` | `components/DashboardShell.tsx` | ⚠️ Partial | Sidebar exists; most nav items link to `#`; heatmap not in nav |
| `StatCardSkeleton` | `components/Skeletons.tsx` | ✅ | Loading state UI |
| `TableSkeleton` | `components/Skeletons.tsx` | ✅ | Loading state UI |
| `HeatmapTableSkeleton` | `components/Skeletons.tsx` | ✅ | Loading state UI |

### Navigation Gaps (Sidebar)

The sidebar in `DashboardShell.tsx` has most items pointing to `#`:
- Overview → `/dashboard` ✅
- Heatmap → `#` ❌ (page exists at `/dashboard/heatmap` but not linked)
- Patient Detail → no sidebar link (page doesn't exist)
- Any other nav items → `#`

---

## 6. Mobile — Expo

### Architecture

The **entire mobile app** is one file: `apps/mobile/App.tsx`.

### Tabs / Screens

| Tab | Status | Notes |
|-----|--------|-------|
| Consent | ✅ Demo | Toggle checkboxes, scope chips, language selector |
| Visit | ✅ Demo | Fake patient picker from hardcoded `PATIENTS[]`, editable transcript text |
| Results | ✅ Demo | **Fixed/mock** risk output from `PATIENTS[]` — not computed from transcript |
| Privacy | ✅ Demo | Static privacy policy display |

### Features

| Feature | Status | Notes |
|---------|--------|-------|
| Multilingual UI (22 languages) | ✅ | Language selector updates UI labels |
| TTS readback (`expo-speech`) | ✅ | Reads consent/results aloud in selected language |
| Transcript editing | ✅ | User can manually edit transcript text |
| Consent flow | ✅ | Toggles + scope chips |
| Real audio recording | ❌ Missing | No microphone capture / `expo-av` not used |
| Backend HTTP calls | ❌ Missing | No `fetch`/API client anywhere in `App.tsx` |
| Real ASR → extract → risk loop | ❌ Missing | All clinical output is mocked |
| `@sahai/shared-types` usage | ❌ Missing | Not in `package.json` dependencies |
| Offline sync queue | ❌ Missing | No queuing / retry logic |

---

## 7. Shared Types Package

**Package name:** `@sahai/shared-types`  
**Location:** `sahai/packages/shared-types/`

### Defined Interfaces

| Interface | Fields |
|-----------|--------|
| `ASHAWorker` | `id`, `name`, `languageCode`, `district`, `city`, `phone` |
| `Patient` | `id`, `name`, `ageYears`, `isPregnant`, `gestationalWeekIfPregnant`, `village`, `district`, `assignedASHAId`, `lastVisitDate` |
| `ExtractedVitals` | BP, heart rate, SpO2, glucose, temperature, weight, etc. |
| `ConsentSnapshot` | `consentGranted`, `scopeAgreed`, `languageCode`, `timestamp`, `witnessPresent` |
| `VisitRecord` | Full visit composite: patient, ASHA, consent, vitals, symptoms, risk, referral |
| `ReferralNote` | `referralText`, `urgency`, `facility`, `followUpPlan` |
| `SyncPayload` | `visit`, `consentReceipt`, `deviceId`, `appVersion` |

**Status: ❌ Not consumed by any app.** Neither `apps/mobile/package.json` nor `apps/dashboard/package.json` lists `@sahai/shared-types` as a dependency.

---

## 8. Database Schema

### Table: `visits` (used in production queries)

| Column | Type | Notes |
|--------|------|-------|
| `id` | String PK | |
| `patientId` | String | |
| `ashaId` | String | |
| `visitDate` | String | |
| `rawTranscriptText` | Text | |
| `extractedVitals` | JSONB | Includes `_metadata.district` used by heatmap |
| `symptoms` | JSONB | |
| `consent` | JSONB | |
| `languageCode` | String | |
| `riskScore` | Float | |
| `riskLevel` | String | `LOW`/`MODERATE`/`HIGH`/`CRITICAL` |
| `referralGenerated` | Boolean | |
| `followUpPlan` | Text | |
| `syncedToCloud` | Boolean | |
| `syncedAt` | DateTime (tz) | |
| `updatedAt` | DateTime (tz) | |

### Tables: `asha_workers`, `patients` (seed script only — **not used by any API route**)

| Table | Defined In | Status |
|-------|-----------|--------|
| `asha_workers` | `scripts/seed_demo_data.py` | Only for seeding; no router reads it |
| `patients` | `scripts/seed_demo_data.py` | Only for seeding; no router reads it |

### Missing Tables

| Table | Why Needed | Status |
|-------|-----------|--------|
| `consent_receipts` | Durable consent audit trail | ❌ Not created |
| `anm_supervisors` | Role-based access, supervision scoping | ❌ Not created |
| `auth_sessions` / JWT table | Real auth | ❌ Not created |

### Migrations

**Alembic is in `requirements.txt` but there is no `alembic.ini`, no `migrations/` folder, and no revision files.** Table creation is currently via `Base.metadata.create_all()` in the seed script.

---

## 9. Third-Party Integrations

| Service | Used For | Status | Fallback |
|---------|----------|--------|---------|
| **OpenAI Whisper** (`whisper-1`) | Audio → transcript | ✅ Wired in `asr_service.py` | No fallback (500 error if key missing) |
| **Anthropic Claude** | Extraction + referral | ✅ Wired in both services | Referral has `_fallback_referral()`; extraction has no fallback |
| **PostgreSQL** | Visit persistence, dashboard queries | ✅ Via SQLAlchemy | No fallback (sync/dashboard endpoints fail without DB) |

---

## 10. Auth & Security

### Current State (Demo)

| Concern | Status | Notes |
|---------|--------|-------|
| Dashboard login form | ⚠️ Broken | Submits to Next BFF → FastAPI endpoint that **doesn't exist** |
| `AuthContext` pre-seeding | ❌ Bug | User is always "logged in" — `user` initialized as `{ name: "ANM Supervisor", ... }` |
| Dashboard route protection | ❌ Missing | No Next.js middleware; `/dashboard` is publicly accessible |
| FastAPI auth router | ❌ Missing | `python-jose`, `passlib` in requirements but zero implementation |
| JWT issuance | ❌ Missing | `JWT_SECRET_KEY` in `.env.example` but never used |
| Cookie logout | ⚠️ Partial | Clears cookie client-side only; no server session store |
| Consent gate on API routes | ✅ Implemented | ASR and extract require valid consent JSON |
| Rate limiting | ❌ TODO | `# TODO: add slowapi limiter in production` in `asr.py` |
| Encryption at rest | ❌ Not started | Called out in `IMPLEMENTATION_PLAN.md` |
| Audit logs | ❌ Not started | Called out in `IMPLEMENTATION_PLAN.md` |
| Role-based access control | ❌ Not started | `DEMO_SUPERVISION_MAP` is hardcoded |

---

## 11. Feature Completion Matrix

| Feature | Mobile | Backend | Dashboard |
|---------|--------|---------|-----------|
| Consent capture (UI) | ✅ | ✅ (validate) | N/A |
| Consent persistence | ❌ | ❌ | N/A |
| Consent withdrawal | ❌ | ❌ | N/A |
| Audio recording | ❌ | N/A | N/A |
| ASR / transcription | ❌ (mock) | ✅ | N/A |
| Clinical extraction | ❌ (mock) | ✅ | N/A |
| Risk scoring | ❌ (hardcoded) | ✅ | ✅ (display) |
| Referral generation | ❌ (mock) | ✅ | N/A |
| TTS readback | ✅ | N/A | N/A |
| Visit sync to DB | ❌ | ✅ | N/A |
| Offline queue | ❌ | N/A | N/A |
| Authentication | ❌ | ❌ | ❌ (broken) |
| Dashboard summary | N/A | ✅ | ✅ |
| District heatmap | N/A | ✅ | ✅ (unlinked) |
| Patient detail view | N/A | ❌ | ❌ (404) |
| Supervisor scoping | N/A | ⚠️ hardcoded | ⚠️ hardcoded |
| 22-language support | ✅ (UI only) | ✅ (policy) | ❌ |
| Shared types used | ❌ | N/A | ❌ |
| DB migrations | N/A | ❌ | N/A |
| Rate limiting | N/A | ❌ (TODO) | N/A |

---

## 12. Known Bugs & Broken Wiring

| # | Location | Issue | Impact |
|---|----------|-------|--------|
| 1 | `dashboard/app/api/auth/login/route.ts` → FastAPI | `POST /api/auth/login` route **does not exist** on FastAPI | Login is completely broken |
| 2 | `dashboard/app/components/AuthContext.tsx` | `user` initialized as logged-in ANM Supervisor unconditionally | App never actually requires login |
| 3 | `dashboard/app/dashboard/page.tsx` (View Details link) | Links to `/dashboard/patient/[id]` — **page does not exist** | 404 on any patient row click |
| 4 | `dashboard/app/components/DashboardShell.tsx` | Heatmap nav item points to `#` not `/dashboard/heatmap` | Heatmap page unreachable via nav |
| 5 | `backend/app/routers/extract.py` response model | `riskScore`/`riskLevel` stripped from Claude response | Mobile/consumers can't get risk from extract endpoint |
| 6 | `mobile/App.tsx` Results tab | Risk output is from hardcoded `PATIENTS[]`, not computed | Clinical output is always fake |
| 7 | `backend/requirements.txt` | `scikit-learn`, `pandas`, `numpy` declared but zero imports | Unnecessary install weight |
| 8 | `backend/requirements.txt` | `alembic` declared but no migration files exist | `alembic upgrade head` will fail |
| 9 | `packages/shared-types` | Not listed in `apps/mobile` or `apps/dashboard` `package.json` | Type drift between layers |
| 10 | Consent receipt | `/api/consent/record` returns receipt but doesn't persist it | No audit trail for consent |

---

## 13. TODOs in Code

| File | Line | TODO |
|------|------|------|
| `backend/app/routers/asr.py` | Near Whisper call | `# TODO: add slowapi limiter in production` |
| `backend/app/services/asr_service.py` | `transcribe_audio_offline_stub()` | Stub function exists but is **not wired into any route** — intended for offline demo/test use |
| `backend/app/routers/sync.py` | Migration comment | Comment suggests `alembic revision --autogenerate` — never actioned |
| `IMPLEMENTATION_PLAN.md` | Throughout | Multiple checklist items marked as remaining work |

---

## 14. What Works End-to-End

### Backend pipeline (with API keys + DB)
```
Audio file → POST /api/asr/transcribe
         → POST /api/extract
         → POST /api/risk/score
         → POST /api/referral/generate
         → POST /api/sync/visit
         → GET  /api/dashboard/summary
```
All of this is **implemented and covered by mocked tests**. Works in practice if you have `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, and `DATABASE_URL` in your `.env`.

### Dashboard (with FastAPI running + DB seeded)
- `/dashboard` live data via SWR works when FastAPI is up and DB is populated via `seed_demo_data.py`
- `/dashboard/heatmap` works (just not navigable via sidebar)

### Mobile (standalone demo)
- Consent UI, language selection, TTS readback, transcript editing — all work offline with **mock** clinical data.

---

## 15. What Needs to Be Built Next

Ordered by priority / dependency:

### Priority 1 — Fix Critical Broken Items
- [ ] **FastAPI auth router** — implement `POST /api/auth/login` with JWT (uses `python-jose` + `passlib` already in requirements)
- [ ] **Fix `AuthContext`** — remove unconditional pre-seeded login; require real token
- [ ] **Add Next.js middleware** — protect `/dashboard` routes with cookie check
- [ ] **Fix sidebar navigation** — wire heatmap link to `/dashboard/heatmap`
- [ ] **Patient detail page** — create `/dashboard/patient/[id]` page

### Priority 2 — Mobile↔Backend Wiring
- [ ] **Audio recording** — add `expo-av` (or `expo-audio`), implement microphone capture
- [ ] **HTTP client in mobile** — wire `POST /api/asr/transcribe` → extract → risk → referral
- [ ] **Real risk display** — replace hardcoded `PATIENTS[]` results with API response
- [ ] **Offline sync queue** — queue visits when offline, sync on reconnect

### Priority 3 — Data Persistence & Integrity
- [ ] **Consent persistence** — save consent receipts to DB (`consent_receipts` table)
- [ ] **`POST /api/consent/withdraw`** — implement withdrawal endpoint + DB update
- [ ] **Alembic migrations** — run `alembic init`, create initial migration, replace `create_all` script
- [ ] **Wire `asha_workers` and `patients` tables** — currently only in seed script; dashboard should read from these

### Priority 4 — Shared Types Integration
- [ ] **Add `@sahai/shared-types`** to `apps/mobile/package.json` and `apps/dashboard/package.json`
- [ ] **Replace inline types** in both apps with shared interfaces
- [ ] **Sync Python Pydantic models** to match shared-types where applicable

### Priority 5 — Production Hardening
- [ ] **Rate limiting** — implement `slowapi` on ASR (and other) routes
- [ ] **Encryption at rest** — for `rawTranscriptText`, `extractedVitals`, consent fields
- [ ] **Audit logs** — table + middleware for all consent/clinical actions
- [ ] **Real RBAC** — replace `DEMO_SUPERVISION_MAP` with DB-backed supervisor → ASHA scoping
- [ ] **Remove unused deps** — `scikit-learn`, `pandas`, `numpy` from `requirements.txt`
- [ ] **Home page** (`/`) — wire to live API data or remove fake KPIs
- [ ] **Prompt injection tests** — add test cases for adversarial transcripts (per `IMPLEMENTATION_PLAN.md`)
- [ ] **Docker Compose** — containerize FastAPI + PostgreSQL for reproducible local dev

---

*This document reflects the state of the codebase as of May 6, 2026. Update the Feature Completion Matrix and Known Bugs sections as work progresses.*
