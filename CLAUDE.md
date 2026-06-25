# CLAUDE.md — Career Ops project memory (auto-loaded by Claude Code)

Auto-loaded every session. Quick-reference only — see `CAREER_OPS_KNOWLEDGE_BASE.md` for full detail.

## What this is
AI job-discovery agent. Upload resume → Gemini parses → query pre-scraped jobs from Supabase DB
→ 4-stage filter → TOPSIS rank → dashboard. Creator: Ansh Madaan (final-yr CS, Thapar).
Goal: ship a real multi-user product. **LIVE** on Render (backend) + Vercel (frontend).

## Stack
- **Backend:** FastAPI (Python) on **Render** via Docker. Live: `https://career-ops-vo9j.onrender.com`
- **Frontend:** Next.js 16 + Tailwind + shadcn + Three.js on **Vercel**. Live: `https://career-ops-frontend.vercel.app`
- **DB + Auth:** Supabase (PostgreSQL, ref `ojbbvbtzpvzejnutbbcm`)
- **LLM:** Google **`gemini-2.5-flash-lite`** (1000 req/day free tier). EXACTLY ONE call per upload (resume parse only).

## Folder layout (MONOREPO — single git repo)
```
D:\CODING\career-ops\          ← git repo: Anshm1234/Career_ops, branch: dev (production)
├── backend\                   ← FastAPI backend (Render root dir)
│   ├── api.py                 ← All endpoints + pipeline + DB helpers
│   ├── config.py              ← Env var loader (_require pattern)
│   ├── run.py                 ← Reads PORT from os.environ for Render
│   ├── scrape_all.py          ← Daily scraper (all ATS sources)
│   ├── test_scrapers.py       ← Smoke test for Greenhouse/Lever/Ashby
│   ├── Dockerfile             ← python:3.11-slim + Playwright chromium
│   ├── requirements.txt
│   ├── data\companies.py      ← Verified ATS slugs (production list)
│   ├── companies.py           ← Broader unverified list (reference only)
│   └── tools\                 ← ashby, greenhouse, lever, internshala,
│                                 job_filter, resume_parser, salary, topsis, workday
├── frontend\                  ← Next.js frontend (Vercel root dir)
│   ├── middleware.ts           ← Root middleware: auth gate + onboarding redirect
│   ├── app\
│   │   ├── onboarding\page.tsx ← 3-step wizard (name/phone → roles → locations)
│   │   ├── dashboard\jobs\    ← Job matches page
│   │   ├── dashboard\profile\ ← Profile page (reads real Supabase + backend data)
│   │   ├── dashboard\tracker\ ← Application tracker (state-only, not persisted)
│   │   └── auth\callback\     ← Supabase OAuth callback
│   ├── components\dashboard\  ← top-nav, upload-resume-dialog, job-card-full, etc.
│   ├── lib\
│   │   ├── api.ts             ← Fetches with JWT; uploads go direct, JSON via proxy
│   │   ├── supabase.ts        ← Browser Supabase client
│   │   └── onboarding-options.ts ← Predefined roles + locations for onboarding
│   └── utils\supabase\        ← server.ts + middleware.ts (auth + onboarding check)
└── CLAUDE.md                  ← this file
```

Old separate repos (`career-ops-backend`, `career-ops-frontend`) are **retired** — deploy from monorepo only.

## Run commands (NEW paths)
- **Backend:** `cd D:\CODING\career-ops\backend && venv\Scripts\activate && uvicorn api:app --reload` (:8000)
- **Frontend:** `cd D:\CODING\career-ops\frontend && npm run dev` (:3000)
- **Daily scrape:** `cd backend && python scrape_all.py`
- **Smoke test:** `cd backend && python test_scrapers.py`
- Both terminals must run together for local dev.

## Git / deploy workflow
- Single repo: `D:\CODING\career-ops` → GitHub `Anshm1234/Career_ops`
- **`dev` branch** = production (Render + Vercel both auto-deploy from `dev`)
- **`main` branch** = stable baseline (merge `dev` → `main` when a milestone is solid)
- All work goes on `dev`. Never force-push `main`.

## Deployment config
- **Render:** Repo = `Career_ops`, Branch = `dev`, Root Dir = `backend`, Runtime = **Docker**
- **Vercel:** Repo = `Career_ops`, Branch = `dev`, Root Dir = `frontend`, Framework = Next.js

## Connection architecture
- JSON requests: browser → `/api/*` → Vercel rewrite (`next.config.mjs` using `BACKEND_URL`) → Render
- File uploads: browser → **DIRECT** to `NEXT_PUBLIC_BACKEND_URL` (bypass proxy — Vercel edge mangles multipart)
- Auth: Supabase JWT (ES256 via JWKS) in `Authorization: Bearer` header (`lib/api.ts`)
- Onboarding gate: `middleware.ts` → `utils/supabase/middleware.ts` checks `profiles.profile_data.onboarding_complete`

## Onboarding flow (NEW)
New users after sign-in → `/onboarding` (3-step wizard):
1. Name + phone (pre-filled from OAuth metadata)
2. Preferred job roles (multi-select from `lib/onboarding-options.ts`)
3. Preferred locations (multi-select from `lib/onboarding-options.ts`)
Saves to Supabase `profiles` table as `profile_data` JSONB.
Middleware blocks `/dashboard/**` until `profile_data.onboarding_complete === true`.

## Supabase profiles table schema
```sql
profiles: id (uuid PK), user_id (FK auth.users, UNIQUE), profile_data (jsonb), updated_at
```
`profile_data` holds: `{ name, phone, preferred_roles[], preferred_locations[], onboarding_complete, resumes[] }`
**NOT separate columns** — everything in the JSONB blob. Query with `.eq("user_id", user.id)`.

## Upload dialog behaviour
Roles + location fields pre-filled from `profiles.profile_data` when dialog opens.
After successful upload: appends `{name, uploaded_at}` to `profile_data.resumes[]`.

## Current state (June 2026)
**DONE:** monorepo restructure, Render + Vercel deployment, onboarding wizard, real profile page,
upload dialog pre-fill, Indian company slugs (+9), DB match helpers, filter fixes (city aliases,
remote prefix, role slash-split), Internshala disabled on Render (OOM), Gemini key rotated.

**IN PROGRESS (Step 2):** Top-nav still shows hardcoded "AL" — needs real Supabase user name.
Profile page edit saves to Supabase but doesn't call backend re-rank endpoint yet.

**PENDING:** Step 3 (rate limiting + remove demo bypass), tracker→applications persistence,
resume tailoring, auto-apply, Internshala via Apify (planned), tests.

## Hard rules (do NOT reverse)
- TOPSIS for ranking, NOT per-job LLM scoring.
- DB-backed jobs, NOT per-user live scraping (Internshala is disabled on Render — OOM).
- EXACTLY ONE Gemini call per upload.
- NEVER remove globe / RotatingWords / FadeUpWords animations.
- Dark monochrome theme, NO blue.
- NEVER fabricate resume/DB experience.
- Proxy pattern for JSON; direct-to-backend for uploads.
- Dockerfile NOT Nixpacks. `run.py` for PORT (not shell expansion).

## Key gotchas
- Gemini 1.0/1.5 RETIRED (404). Use `gemini-2.5-flash-lite`. 2.5-flash caps ~20-250/day.
- Supabase caps REST at 1000 rows — paginate with `.range()` in `_fetch_jobs_from_db`.
- No PostgREST embedded join for matches — FK not in schema cache, 500s. Two-query merge in Python.
- Salary parser: reject 1099/401k/years, require explicit `$` for USD, floor ₹1.5L.
- `NEXT_PUBLIC_*` vars bake at BUILD time — redeploy with cache-clear after changing.
- `BACKEND_URL` (server-side rewrite) also bakes at build time — same rule.
- Empty Vercel build log = cached build = old URL still in rewrites. Push a commit to force rebuild.
- Internshala Playwright crashes Render free/hobby (512MB OOM) — disabled, planned via Apify.
- Vercel edge mangles multipart → uploads bypass proxy via `NEXT_PUBLIC_BACKEND_URL` + CORS.
- `libasound2-dev` not `libasound2` in Dockerfile (Debian Bookworm renamed it).
- Never commit real API keys to `.env.example` — Gemini key was leaked this way and auto-revoked.
- Job filter: "Bangalore" ↔ "Bengaluru" aliased; "Remote (India)" matches remote jobs; "/" in roles split.

## Env vars
**Backend** (Render + local `backend/.env`):
```
GEMINI_API_KEY=<new key from aistudio.google.com>
GEMINI_MODEL=gemini-2.5-flash-lite
SUPABASE_URL=https://ojbbvbtzpvzejnutbbcm.supabase.co
SUPABASE_SERVICE_KEY=<service role key>
SUPABASE_JWT_SECRET=<jwt secret>
DEMO_USER_ID=2a6a975a-081c-44fe-8db1-dab4dcc32a5a  (optional)
```
**Frontend** (Vercel + local `frontend/.env.local`):
```
NEXT_PUBLIC_SUPABASE_URL=https://ojbbvbtzpvzejnutbbcm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
BACKEND_URL=https://career-ops-vo9j.onrender.com
NEXT_PUBLIC_BACKEND_URL=https://career-ops-vo9j.onrender.com
NEXT_PUBLIC_DEMO_MODE=false
NEXT_PUBLIC_DEMO_USER_ID=2a6a975a-081c-44fe-8db1-dab4dcc32a5a  (optional)
```

## Scrapers (data/companies.py — verified June 2026)
- **Greenhouse (22):** anthropic, stripe, discord, figma, vercel, airtable, databricks, brex, scaleai,
  mixpanel, amplitude, twilio, cloudflare, xai, deepmind, postman, imbue, phonepe, groww,
  razorpaysoftwareprivatelimited, alphasense, hackerrank
- **Lever (14):** spotify, zoox, matchgroup, woven-by-toyota, fullscript, theathletic, remofirst,
  xsolla, palantir, applike, cred, meesho, hevodata, fampay
- **Ashby (18):** linear, cursor, perplexity, replit, ramp, cohere, runway, supabase, modal, neon,
  watershed, sarvam, e2b, lancedb, weaviate, pinecone, airwallex, flagright.com
- **Total:** ~6100 jobs in DB as of June 2026
- Internshala: has scraper (`tools/internshala.py`) but **disabled in pipeline** (OOM on Render)

## Coding standards
Python: type hints, docstrings, scrapers return `{success, jobs, count, error}`.
React/TS: functional components, Tailwind, shadcn. Explain each new/edited file's purpose.
Prefer minimal targeted fixes over rewrites.
