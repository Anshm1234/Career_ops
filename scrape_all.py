"""
scrape_all.py — Daily job scraper for Career Ops.

Scrapes all companies from Greenhouse, Lever, and Ashby,
then upserts results into Supabase jobs table.

Run manually:   python scrape_all.py
Railway cron:   runs daily at 2am IST (20:30 UTC)

Environment variables needed:
    SUPABASE_URL
    SUPABASE_SERVICE_KEY
"""

import os
import json
import logging
import time
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
log = logging.getLogger(__name__)


def get_supabase_client():
    """Create a Supabase client using the service role key."""
    from supabase import create_client
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")
    return create_client(url, key)


def upsert_jobs(supabase, jobs: list[dict], batch_size: int = 100) -> int:
    """
    Upsert jobs into Supabase in batches.
    Uses job URL as unique key — updates existing, inserts new.
    Returns number of jobs upserted.
    """
    if not jobs:
        return 0

    now = datetime.now(timezone.utc).isoformat()
    records = []
    seen_ids = set()

    for job in jobs:
        job_id = job.get("id", "")
        url    = job.get("url", "")
        if not job_id or not url or job_id in seen_ids:
            continue
        seen_ids.add(job_id)
        records.append({
            "id":          job_id,
            "title":       job.get("title", ""),
            "company":     job.get("company", ""),
            "url":         url,
            "location":    job.get("location", ""),
            "description": job.get("description", "")[:10000],
            "source":      job.get("source", ""),
            "posted_at":   job.get("posted_at", ""),
            "scraped_at":  now,
            "is_active":   True,
        })

    total = 0
    for i in range(0, len(records), batch_size):
        batch = records[i:i + batch_size]
        try:
            supabase.table("jobs").upsert(batch, on_conflict="id").execute()
            total += len(batch)
        except Exception as e:
            log.error("Batch upsert failed: %s", e)

    return total


def mark_inactive(supabase, active_ids: set[str], source: str):
    """Mark jobs from a source as inactive if they weren't in latest scrape."""
    try:
        # Get all active job IDs from this source
        res = supabase.table("jobs").select("id").eq("source", source).eq("is_active", True).execute()
        existing_ids = {row["id"] for row in res.data}
        inactive_ids = existing_ids - active_ids
        if inactive_ids:
            supabase.table("jobs").update({"is_active": False}).in_("id", list(inactive_ids)).execute()
            log.info("Marked %d jobs inactive from %s", len(inactive_ids), source)
    except Exception as e:
        log.warning("Failed to mark inactive for %s: %s", source, e)


def run_scrape():
    from data.companies import COMPANIES
    from tools.greenhouse import scrape_greenhouse
    from tools.lever import scrape_lever
    from tools.ashby import scrape_ashby

    supabase = get_supabase_client()
    log.info("Starting daily scrape at %s", datetime.now().isoformat())

    total_scraped  = 0
    total_upserted = 0
    errors         = []

    # ── Greenhouse ────────────────────────────────────────────────────────────
    log.info("Scraping Greenhouse (%d companies)...", len(COMPANIES["greenhouse"]))
    gh_jobs = []
    for slug in COMPANIES["greenhouse"]:
        result = scrape_greenhouse(slug)
        if result["success"]:
            gh_jobs.extend(result["jobs"])
            log.info("  greenhouse/%s: %d jobs", slug, result["count"])
        else:
            log.warning("  greenhouse/%s failed: %s", slug, result.get("error"))
            errors.append(f"greenhouse/{slug}: {result.get('error')}")
        time.sleep(0.3)

    upserted = upsert_jobs(supabase, gh_jobs)
    total_scraped  += len(gh_jobs)
    total_upserted += upserted
    mark_inactive(supabase, {j["id"] for j in gh_jobs}, "greenhouse")
    log.info("Greenhouse: %d scraped, %d upserted", len(gh_jobs), upserted)

    # ── Lever ─────────────────────────────────────────────────────────────────
    log.info("Scraping Lever (%d companies)...", len(COMPANIES["lever"]))
    lv_jobs = []
    for slug in COMPANIES["lever"]:
        result = scrape_lever(slug)
        if result["success"]:
            lv_jobs.extend(result["jobs"])
            log.info("  lever/%s: %d jobs", slug, result["count"])
        else:
            log.warning("  lever/%s failed: %s", slug, result.get("error"))
            errors.append(f"lever/{slug}: {result.get('error')}")
        time.sleep(0.3)

    upserted = upsert_jobs(supabase, lv_jobs)
    total_scraped  += len(lv_jobs)
    total_upserted += upserted
    mark_inactive(supabase, {j["id"] for j in lv_jobs}, "lever")
    log.info("Lever: %d scraped, %d upserted", len(lv_jobs), upserted)

    # ── Ashby ─────────────────────────────────────────────────────────────────
    log.info("Scraping Ashby (%d companies)...", len(COMPANIES["ashby"]))
    ab_jobs = []
    for slug in COMPANIES["ashby"]:
        result = scrape_ashby(slug)
        if result["success"]:
            ab_jobs.extend(result["jobs"])
            log.info("  ashby/%s: %d jobs", slug, result["count"])
        else:
            log.warning("  ashby/%s failed: %s", slug, result.get("error"))
            errors.append(f"ashby/{slug}: {result.get('error')}")
        time.sleep(0.3)

    upserted = upsert_jobs(supabase, ab_jobs)
    total_scraped  += len(ab_jobs)
    total_upserted += upserted
    if ab_jobs:  # only mark inactive if scrape succeeded
        mark_inactive(supabase, {j["id"] for j in ab_jobs}, "ashby")
    log.info("Ashby: %d scraped, %d upserted", len(ab_jobs), upserted)

    # ── Summary ───────────────────────────────────────────────────────────────
    log.info("=" * 50)
    log.info("Scrape complete: %d total jobs scraped", total_scraped)
    log.info("Upserted to Supabase: %d jobs", total_upserted)
    if errors:
        log.warning("%d errors: %s", len(errors), errors)
    log.info("=" * 50)

    return {
        "scraped":  total_scraped,
        "upserted": total_upserted,
        "errors":   errors,
        "timestamp": datetime.now().isoformat(),
    }


if __name__ == "__main__":
    result = run_scrape()
    print(json.dumps(result, indent=2))