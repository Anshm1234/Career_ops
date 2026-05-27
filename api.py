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

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse

from config import UPLOADS_DIR, DATA_DIR, profile_path
from tools.resume_parser import parse_resume
from tools.job_filter import filter_jobs
from tools.topsis import rank_jobs, DEFAULT_WEIGHTS

log = logging.getLogger(__name__)
app = FastAPI(title="Career Ops API")

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

def _scrape_and_filter(user_id: str, profile: dict):
    """
    Runs in the background after resume upload.
    Scrapes all companies, filters against profile, saves matched_jobs.json.
    Orchestrator is called directly (bypassing Gemini agent loop) to avoid
    module-level state conflicts between concurrent users.

    Workday uses sync_playwright which cannot run inside an existing event loop.
    It is executed in a separate thread via concurrent.futures to get its own loop.
    """
    try:
        _write_status(user_id, "scraping", "Fetching jobs from all companies...")

        from data.companies import COMPANIES
        from tools.greenhouse import scrape_greenhouse
        from tools.lever import scrape_lever
        from tools.ashby import scrape_ashby
        from tools.workday import scrape_workday

        all_jobs = []
        seen_urls = set()

        def _collect(jobs: list):
            for job in jobs:
                url = job.get("url", "")
                if url and url not in seen_urls:
                    seen_urls.add(url)
                    all_jobs.append(job)

        for slug in COMPANIES.get("greenhouse", []):
            result = scrape_greenhouse(slug)
            if result["success"]:
                _collect(result["jobs"])

        for slug in COMPANIES.get("lever", []):
            result = scrape_lever(slug)
            if result["success"]:
                _collect(result["jobs"])

        for slug in COMPANIES.get("ashby", []):
            result = scrape_ashby(slug)
            if result["success"]:
                _collect(result["jobs"])

        # Workday uses sync_playwright which conflicts with FastAPI's event loop on Windows.
        # Fix: spawn a completely separate Python process per company via subprocess.
        import subprocess, sys, tempfile

        for entry in COMPANIES.get("workday", []):
            script = (
                "import json, sys\n"
                "sys.path.insert(0, r'" + str(Path(__file__).parent) + "')\n"
                "from tools.workday import scrape_workday\n"
                "result = scrape_workday(" + repr(entry["name"]) + ", " + repr(entry["url"]) + ")\n"
                "print(json.dumps(result))\n"
            )
            try:
                proc = subprocess.run(
                    [sys.executable, "-c", script],
                    capture_output=True, text=True, timeout=90,
                )
                if proc.stdout.strip():
                    result = json.loads(proc.stdout.strip())
                    if result.get("success"):
                        _collect(result["jobs"])
                elif proc.stderr:
                    log.warning("Workday %s stderr: %s", entry["name"], proc.stderr[-300:])
            except subprocess.TimeoutExpired:
                log.warning("Workday %s timed out", entry["name"])
            except Exception as e:
                log.warning("Workday %s failed: %s", entry["name"], e)

        _write_status(user_id, "filtering", f"Scraped {len(all_jobs)} jobs, filtering...")

        matched = filter_jobs(all_jobs, profile, min_matches=2)

        _matched_jobs_path(user_id).write_text(
            json.dumps(matched, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

        _write_status(user_id, "ready", f"{len(matched)} jobs matched out of {len(all_jobs)} scraped")
        log.info("user=%s scrape done: %d/%d jobs matched", user_id, len(matched), len(all_jobs))

    except Exception as e:
        log.exception("Scrape failed for user=%s", user_id)
        _write_status(user_id, "failed", str(e))


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.post("/resume/upload")
async def upload_resume(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    salary_min: int | None = Form(default=None, description="Minimum expected annual salary (INR e.g. 800000 for ₹8L)"),
    salary_max: int | None = Form(default=None, description="Maximum expected annual salary (INR e.g. 2000000 for ₹20L)"),
    location_preferences: str | None = Form(default=None, description="Comma-separated locations e.g. 'remote,Bangalore,Delhi'"),
    preferred_roles: str | None = Form(default=None, description="Comma-separated roles e.g. 'ML Engineer,Data Scientist'"),
    weight_skill:     float = Form(default=DEFAULT_WEIGHTS["skill"],     description="TOPSIS weight for skill match (0–1)"),
    weight_salary:    float = Form(default=DEFAULT_WEIGHTS["salary"],    description="TOPSIS weight for salary fit (0–1)"),
    weight_role:      float = Form(default=DEFAULT_WEIGHTS["role"],      description="TOPSIS weight for role match (0–1)"),
    weight_location:  float = Form(default=DEFAULT_WEIGHTS["location"],  description="TOPSIS weight for location fit (0–1)"),
    weight_seniority: float = Form(default=DEFAULT_WEIGHTS["seniority"], description="TOPSIS weight for seniority fit (0–1)"),
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

    user_id = str(uuid.uuid4())
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
async def job_status(user_id: str):
    """
    Poll scrape progress.

    Returns { status, detail, updated_at }
    status is one of: scraping | filtering | ready | failed | not_found
    """
    return JSONResponse(_read_status(user_id))


@app.get("/jobs/search/{user_id}")
async def search_jobs(user_id: str):
    """
    Return TOPSIS-ranked jobs for a user. Only available once status=ready.

    Returns { user_id, total, weights_used, jobs } sorted best-fit first.
    Each job includes topsis_score, topsis_rank, and dimension_scores.
    """
    status = _read_status(user_id)
    if status["status"] == "not_found":
        raise HTTPException(status_code=404, detail="User not found. Upload a resume first.")
    if status["status"] in ("scraping", "filtering"):
        raise HTTPException(status_code=202, detail=f"Still processing: {status['detail']}")
    if status["status"] == "failed":
        raise HTTPException(status_code=500, detail=f"Scrape failed: {status['detail']}")

    p = _matched_jobs_path(user_id)
    if not p.exists():
        raise HTTPException(status_code=404, detail="No matched jobs found.")

    matched = json.loads(p.read_text(encoding="utf-8"))
    profile = json.loads(Path(profile_path(user_id)).read_text(encoding="utf-8"))

    weights = profile.get("topsis_weights", None)
    ranked  = rank_jobs(matched, profile, weights=weights)

    return JSONResponse({
        "user_id":      user_id,
        "total":        len(ranked),
        "weights_used": profile.get("topsis_weights", DEFAULT_WEIGHTS),
        "jobs":         ranked,
    })


@app.get("/profile/{user_id}")
async def get_profile(user_id: str):
    """Fetch the stored profile for a user."""
    path = profile_path(user_id)
    if not Path(path).exists():
        raise HTTPException(status_code=404, detail="Profile not found.")
    profile = json.loads(Path(path).read_text(encoding="utf-8"))
    return JSONResponse({"user_id": user_id, "profile": profile})
