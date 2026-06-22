"""
api.py — FastAPI web entry point for Career Ops.

Endpoints:
    POST /resume/upload          Parse resume, kick off background scrape
    GET  /jobs/status/{user_id}  Poll scrape progress
    GET  /jobs/search/{user_id}  Return matched jobs (once status=ready)
    GET  /profile/{user_id}      Fetch the stored profile

Run:
    uvicorn api:app --reload
"""

import uuid
import json
import shutil
import logging
from pathlib import Path
from datetime import datetime

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks, Depends
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import os
import httpx
from jose import jwt, JWTError

from config import UPLOADS_DIR, DATA_DIR, profile_path
from tools.resume_parser import parse_resume
from tools.job_filter import filter_jobs
from tools.topsis import rank_jobs, DEFAULT_WEIGHTS

log = logging.getLogger(__name__)
app = FastAPI(title="Career Ops API")

# CORS — allow the frontend (Vercel) to call this backend directly.
# File uploads bypass the Next.js proxy and hit here cross-origin.
from fastapi.middleware.cors import CORSMiddleware

_allowed_origins = [
    "http://localhost:3000",
    os.getenv("FRONTEND_URL", ""),
]
# Allow all *.vercel.app preview/prod domains + localhost
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https://.*\.vercel\.app|http://localhost:3000",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}

# ── Supabase JWT verification ─────────────────────────────────────────────────
# Purpose: every protected endpoint calls get_current_user() which reads the
# Authorization: Bearer <token> header, verifies it's a valid Supabase JWT,
# and returns the real Supabase user ID. This prevents anyone from reading
# another user's jobs by guessing their user_id.

_bearer = HTTPBearer(auto_error=False)
_SUPABASE_URL = os.getenv("SUPABASE_URL", "")
_SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
_SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")
_jwks_cache: dict = {}

async def _fetch_jwks() -> list:
    """Fetch Supabase public JWKS keys for ES256 verification."""
    global _jwks_cache
    if _jwks_cache:
        return _jwks_cache.get("keys", [])
    url = f"{_SUPABASE_URL}/auth/v1/.well-known/jwks.json"
    async with httpx.AsyncClient() as client:
        r = await client.get(url, headers={"apikey": _SUPABASE_SERVICE_KEY}, timeout=10)
        r.raise_for_status()
        _jwks_cache = r.json()
        return _jwks_cache.get("keys", [])

async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> str:
    """
    Verify Supabase JWT (ES256 or HS256) and return the user's UUID.
    - ES256: fetches public JWKS from Supabase and verifies signature
    - HS256: uses SUPABASE_JWT_SECRET from .env
    - Neither configured: local dev mode (no auth)
    - Demo mode: if no token and DEMO_USER_ID is set, allow it through
    """
    if not _SUPABASE_URL and not _SUPABASE_JWT_SECRET:
        log.warning("No Supabase config — running in unauthenticated mode")
        return "local-dev-user"

    if not credentials:
        # Demo mode: allow unauthenticated access AS the demo user only.
        demo_user = os.getenv("DEMO_USER_ID", "")
        if demo_user:
            return demo_user
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    token = credentials.credentials
    try:
        header = jwt.get_unverified_header(token)
        alg = header.get("alg", "HS256")

        if alg == "ES256":
            # Fetch JWKS and find matching key
            keys = await _fetch_jwks()
            kid = header.get("kid")
            key = next((k for k in keys if k.get("kid") == kid), None)
            if not key and keys:
                key = keys[0]  # fallback to first key
            if not key:
                raise HTTPException(status_code=401, detail="No matching JWKS key found")
            payload = jwt.decode(token, key, algorithms=["ES256"], audience="authenticated")
        else:
            # HS256 fallback
            if not _SUPABASE_JWT_SECRET:
                raise HTTPException(status_code=401, detail="SUPABASE_JWT_SECRET not configured")
            payload = jwt.decode(token, _SUPABASE_JWT_SECRET, algorithms=["HS256"], audience="authenticated")

        user_id: str = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        return user_id

    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc", ".txt"}


# ── Per-user path helpers ─────────────────────────────────────────────────────

def _user_dir(user_id: str) -> Path:
    p = Path(DATA_DIR) / "users" / user_id
    p.mkdir(parents=True, exist_ok=True)
    return p

def _status_path(user_id: str) -> Path:
    return _user_dir(user_id) / "status.json"

def _matched_jobs_path(user_id: str) -> Path:
    return _user_dir(user_id) / "matched_jobs.json"


# ── Status helpers ────────────────────────────────────────────────────────────

def _write_status(user_id: str, status: str, detail: str = ""):
    _status_path(user_id).write_text(
        json.dumps({"status": status, "detail": detail, "updated_at": datetime.utcnow().isoformat()}),
        encoding="utf-8",
    )

def _read_status(user_id: str) -> dict:
    p = _status_path(user_id)
    if not p.exists():
        return {"status": "not_found"}
    return json.loads(p.read_text(encoding="utf-8"))


# ── Background task ───────────────────────────────────────────────────────────

def _get_supabase():
    """Get Supabase client using service role key."""
    from supabase import create_client
    url = os.getenv("SUPABASE_URL", "")
    key = os.getenv("SUPABASE_SERVICE_KEY", "")
    if not url or not key:
        return None
    return create_client(url, key)


def _fetch_jobs_from_db(supabase, limit: int = 10000) -> list[dict]:
    """
    Fetch all active jobs from Supabase jobs table.

    Supabase caps each REST response at 1000 rows regardless of .limit(),
    so we paginate with .range() until we've pulled everything (or hit `limit`).
    """
    all_rows = []
    page_size = 1000
    start = 0
    try:
        while start < limit:
            end = start + page_size - 1
            res = supabase.table("jobs") \
                .select("*") \
                .eq("is_active", True) \
                .range(start, end) \
                .execute()
            rows = res.data or []
            all_rows.extend(rows)
            if len(rows) < page_size:
                break          # last page
            start += page_size
        return all_rows
    except Exception as e:
        log.error("Failed to fetch jobs from DB: %s", e)
        return all_rows


def _upsert_jobs_to_db(supabase, jobs: list[dict]):
    """
    Upsert a batch of jobs (e.g. per-user Internshala results) into the jobs
    table so they have a stable id that user_matches can reference.
    Uses on_conflict=id so re-scraping the same job updates rather than dupes.
    """
    if not jobs:
        return
    from datetime import timezone
    now = datetime.now(timezone.utc).isoformat()
    records, seen = [], set()
    for job in jobs:
        jid = job.get("id", "")
        if not jid or jid in seen:
            continue
        seen.add(jid)
        records.append({
            "id":          jid,
            "title":       job.get("title", ""),
            "company":     job.get("company", ""),
            "url":         job.get("url", ""),
            "location":    job.get("location", ""),
            "description": (job.get("description", "") or "")[:10000],
            "source":      job.get("source", "internshala"),
            "posted_at":   job.get("posted_at", ""),
            "scraped_at":  now,
            "is_active":   True,
        })
    try:
        for i in range(0, len(records), 100):
            supabase.table("jobs").upsert(records[i:i+100], on_conflict="id").execute()
    except Exception as e:
        log.error("Failed to upsert internshala jobs: %s", e)


def _save_matches_to_db(supabase, user_id: str, ranked: list[dict]):
    """
    Replace this user's matches in user_matches with the freshly ranked set.
    Stores job_id refs + scores; full job data is JOINed back from jobs table on read.
    """
    try:
        # Clear old matches for this user (fresh upload = fresh matches)
        supabase.table("user_matches").delete().eq("user_id", user_id).execute()

        rows = []
        for job in ranked:
            jid = job.get("id", "")
            if not jid:
                continue
            rows.append({
                "user_id":          user_id,
                "job_id":           jid,
                "topsis_score":     float(job.get("topsis_score", 0)),
                "topsis_rank":      int(job.get("topsis_rank", 0)),
                "dimension_scores": job.get("dimension_scores", {}),
                "matched_keywords": job.get("matched_keywords", []),
                "salary_inr_low":   job.get("salary_inr_low"),
                "salary_inr_high":  job.get("salary_inr_high"),
                "salary_note":      job.get("salary_note", ""),
                "location_note":    job.get("location_note", ""),
                "role_note":        job.get("role_note", ""),
            })
        for i in range(0, len(rows), 100):
            supabase.table("user_matches").upsert(
                rows[i:i+100], on_conflict="user_id,job_id"
            ).execute()
    except Exception as e:
        log.error("Failed to save matches to DB for user=%s: %s", user_id, e)


def _read_matches_from_db(supabase, user_id: str) -> list[dict]:
    """
    Read a user's matches from user_matches and merge with full job data.

    Avoids the PostgREST embedded-join syntax (which needs a recognized FK and
    fails silently otherwise). Instead: fetch match rows, fetch the referenced
    jobs by id, merge in Python.
    """
    try:
        matches = supabase.table("user_matches") \
            .select("*") \
            .eq("user_id", user_id) \
            .order("topsis_rank") \
            .execute().data or []
        if not matches:
            return []

        job_ids = [m["job_id"] for m in matches if m.get("job_id")]
        # Fetch jobs in batches (PostgREST 'in' filter can take many ids)
        jobs_by_id = {}
        for i in range(0, len(job_ids), 200):
            batch = job_ids[i:i+200]
            rows = supabase.table("jobs").select("*").in_("id", batch).execute().data or []
            for j in rows:
                jobs_by_id[j["id"]] = j

        out = []
        for m in matches:
            job = jobs_by_id.get(m.get("job_id"))
            if not job:
                continue          # job no longer exists / was deactivated
            out.append({
                **job,
                "topsis_score":     m.get("topsis_score", 0),
                "topsis_rank":      m.get("topsis_rank", 0),
                "dimension_scores": m.get("dimension_scores", {}),
                "matched_keywords": m.get("matched_keywords", []),
                "salary_inr_low":   m.get("salary_inr_low"),
                "salary_inr_high":  m.get("salary_inr_high"),
                "salary_note":      m.get("salary_note", ""),
                "location_note":    m.get("location_note", ""),
                "role_note":        m.get("role_note", ""),
            })
        return out
    except Exception as e:
        log.error("Failed to read matches from DB for user=%s: %s", user_id, e)
        return []


def _scrape_and_filter(user_id: str, profile: dict):
    """
    Runs in the background after resume upload.

    New approach (DB-backed):
    1. Fetch all jobs from Supabase jobs table (fast, ~1 sec)
    2. Per-user Internshala scrape with profile keywords (~60 sec)
    3. filter_jobs() + rank_jobs() against profile
    4. Save matched results

    Greenhouse/Lever/Ashby jobs come from the daily scrape_all.py cron job.
    Internshala is still per-user because it needs personalised keyword search.
    """
    try:
        _write_status(user_id, "scraping", "Loading jobs from database...")

        all_jobs = []
        seen_urls = set()

        def _collect(jobs: list, source: str):
            added = 0
            for job in jobs:
                url = job.get("url", "")
                if url and url not in seen_urls:
                    seen_urls.add(url)
                    all_jobs.append(job)
                    added += 1
            log.info("%s: added %d jobs", source, added)

        # ── Step 1: Load from Supabase DB ─────────────────────────────────────
        supabase = _get_supabase()
        if supabase:
            db_jobs = _fetch_jobs_from_db(supabase)
            _collect(db_jobs, "database")
            log.info("Loaded %d jobs from Supabase", len(db_jobs))
        else:
            log.warning("Supabase not configured — falling back to direct scraping")
            from data.companies import COMPANIES
            from tools.greenhouse import scrape_greenhouse
            from tools.lever import scrape_lever
            from tools.ashby import scrape_ashby

            for slug in COMPANIES.get("greenhouse", []):
                r = scrape_greenhouse(slug)
                if r["success"]: _collect(r["jobs"], f"greenhouse/{slug}")
            for slug in COMPANIES.get("lever", []):
                r = scrape_lever(slug)
                if r["success"]: _collect(r["jobs"], f"lever/{slug}")
            for slug in COMPANIES.get("ashby", []):
                r = scrape_ashby(slug)
                if r["success"]: _collect(r["jobs"], f"ashby/{slug}")

        # ── Step 2: Filter + rank DB jobs, show immediately ───────────────────
        _write_status(user_id, "filtering", f"Filtering {len(all_jobs)} jobs...")
        matched = filter_jobs(all_jobs, profile, min_matches=2)
        weights = profile.get("topsis_weights")
        ranked  = rank_jobs(matched, profile, weights=weights)

        # Persist: local JSON (fallback) + DB (source of truth)
        _matched_jobs_path(user_id).write_text(
            json.dumps(ranked, indent=2, ensure_ascii=False), encoding="utf-8",
        )
        if supabase:
            _save_matches_to_db(supabase, user_id, ranked)

        # Mark ready — Internshala disabled on Render (Chromium OOM on free/hobby tier)
        _write_status(user_id, "ready", f"{len(ranked)} jobs matched")
        log.info("user=%s pipeline done: %d matched from DB", user_id, len(ranked))

    except Exception as e:
        log.exception("Pipeline failed for user=%s", user_id)
        # If we already wrote ready in phase 1, don't overwrite with failed
        status = _read_status(user_id)
        if status.get("status") != "ready":
            _write_status(user_id, "failed", str(e))


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.post("/resume/upload")
async def upload_resume(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    salary_min: int | None = Form(default=None),
    salary_max: int | None = Form(default=None),
    location_preferences: str | None = Form(default=None),
    preferred_roles: str | None = Form(default=None),
    weight_skill:     float = Form(default=DEFAULT_WEIGHTS["skill"]),
    weight_salary:    float = Form(default=DEFAULT_WEIGHTS["salary"]),
    weight_role:      float = Form(default=DEFAULT_WEIGHTS["role"]),
    weight_location:  float = Form(default=DEFAULT_WEIGHTS["location"]),
    weight_seniority: float = Form(default=DEFAULT_WEIGHTS["seniority"]),
    current_user: str = Depends(get_current_user),
):
    """
    Upload a resume. Parses it immediately, then kicks off a background scrape.
    User-provided preferences (salary, location, roles, weights) override resume-extracted values.

    Weights don't need to sum to 1 — they are normalised automatically.
    Returns { user_id, profile, status } right away.
    Poll GET /jobs/status/{user_id} to know when results are ready.
    """
    suffix = Path(file.filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{suffix}'. Use PDF, DOCX, or TXT."
        )

    user_id = current_user  # Real Supabase user ID from JWT
    save_path = Path(UPLOADS_DIR) / f"{user_id}{suffix}"

    with open(save_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        profile = parse_resume(str(save_path), user_id=user_id)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    finally:
        save_path.unlink(missing_ok=True)

    # Override with explicit user preferences if provided
    if salary_min is not None:
        profile["salary_min"] = salary_min
    if salary_max is not None:
        profile["salary_max"] = salary_max
    if location_preferences:
        profile["location_preferences"] = [l.strip() for l in location_preferences.split(",") if l.strip()]
    if preferred_roles:
        profile["preferred_roles"] = [r.strip() for r in preferred_roles.split(",") if r.strip()]

    # Store TOPSIS weights in profile (normalised at ranking time)
    profile["topsis_weights"] = {
        "skill":     weight_skill,
        "salary":    weight_salary,
        "role":      weight_role,
        "location":  weight_location,
        "seniority": weight_seniority,
    }

    # Save updated profile back to disk
    with open(profile_path(user_id), "w", encoding="utf-8") as f:
        json.dump(profile, f, indent=2, ensure_ascii=False)

    _write_status(user_id, "scraping", "Starting job scrape...")
    background_tasks.add_task(_scrape_and_filter, user_id, profile)

    return JSONResponse({
        "user_id": user_id,
        "profile": profile,
        "status":  "scraping",
        "message": "Resume parsed. Scraping jobs in background — poll /jobs/status/{user_id}",
    })


@app.get("/jobs/status/{user_id}")
async def job_status(user_id: str, current_user: str = Depends(get_current_user)):
    if current_user != "local-dev-user" and current_user != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return JSONResponse(_read_status(user_id))


@app.get("/jobs/search/{user_id}")
async def search_jobs(user_id: str, current_user: str = Depends(get_current_user)):
    if current_user != "local-dev-user" and current_user != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    status = _read_status(user_id)
    if status["status"] == "not_found":
        raise HTTPException(status_code=404, detail="User not found. Upload a resume first.")
    if status["status"] in ("scraping", "filtering"):
        raise HTTPException(status_code=202, detail=f"Still processing: {status['detail']}")
    if status["status"] == "failed":
        raise HTTPException(status_code=500, detail=f"Scrape failed: {status['detail']}")

    # Preferred source: DB (already ranked, survives restarts, multi-instance safe)
    supabase = _get_supabase()
    if supabase:
        try:
            ranked = _read_matches_from_db(supabase, user_id)
            if ranked:
                return JSONResponse({
                    "user_id": user_id,
                    "total":   len(ranked),
                    "jobs":    ranked,
                })
        except Exception as e:
            log.error("DB read failed, falling back to local JSON: %s", e)

    # Fallback: local JSON (already ranked by the pipeline)
    p = _matched_jobs_path(user_id)
    if not p.exists():
        raise HTTPException(status_code=404, detail="No matched jobs found.")

    ranked = json.loads(p.read_text(encoding="utf-8"))
    return JSONResponse({
        "user_id": user_id,
        "total":   len(ranked),
        "jobs":    ranked,
    })


@app.get("/profile/{user_id}")
async def get_profile(user_id: str, current_user: str = Depends(get_current_user)):
    """Fetch the stored profile for a user."""
    if current_user != "local-dev-user" and current_user != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    path = profile_path(user_id)
    if not Path(path).exists():
        raise HTTPException(status_code=404, detail="Profile not found.")
    profile = json.loads(Path(path).read_text(encoding="utf-8"))
    return JSONResponse({"user_id": user_id, "profile": profile})