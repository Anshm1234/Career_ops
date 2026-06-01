"""
tools/naukri.py — scrapes Naukri.com via Playwright subprocess.
"""
import json
import subprocess
import sys
import logging
from pathlib import Path

log = logging.getLogger(__name__)

# Standalone script that runs in the subprocess
_NAUKRI_SCRIPT = """
import json, sys, time
sys.path.insert(0, sys.argv[3])
from playwright.sync_api import sync_playwright

url   = sys.argv[1]
count = int(sys.argv[2])

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
            ]
        )
        ctx = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 800},
            extra_http_headers={
                "Accept-Language": "en-US,en;q=0.9",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            },
            java_script_enabled=True,
        )
        # Remove webdriver flag
        ctx.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        page = ctx.new_page()
        page.goto(url, timeout=30000)

        try:
            page.wait_for_selector("div[class*='tuple']", timeout=15000)
        except Exception:
            pass
        time.sleep(2)

        jobs = []
        cards = page.query_selector_all("div[class*='tuple']")
        seen_ids = set()

        for card in cards[:count]:
            try:
                job_id = card.get_attribute("data-job-id") or ""
                if job_id and job_id in seen_ids:
                    continue
                if job_id:
                    seen_ids.add(job_id)

                title_el   = card.query_selector("a[class*='title'], h2 a, h3 a")
                company_el = card.query_selector("a[class*='comp-name'], span[class*='comp-name']")
                loc_el     = card.query_selector("span[class*='locWdth'], li[class*='loc'], span[class*='loc']")
                sal_el     = card.query_selector("span[class*='sal'], li[class*='sal']")
                exp_el     = card.query_selector("span[class*='exp'], li[class*='exp']")
                skills_el  = card.query_selector("ul[class*='tags'], div[class*='tags']")
                url_el     = card.query_selector("a[class*='title'], h2 a, h3 a")

                title   = title_el.inner_text().strip()   if title_el   else ""
                company = company_el.inner_text().strip() if company_el else ""
                loc     = loc_el.inner_text().strip()     if loc_el     else ""
                salary  = sal_el.inner_text().strip()     if sal_el     else ""
                exp     = exp_el.inner_text().strip()     if exp_el     else ""
                skills  = skills_el.inner_text().strip()  if skills_el  else ""
                job_url = url_el.get_attribute("href")    if url_el     else ""

                if not title:
                    continue

                desc_parts = []
                if exp:    desc_parts.append(f"Experience: {exp}")
                if salary: desc_parts.append(f"Salary: {salary}")
                if skills: desc_parts.append(f"Skills: {skills}")
                desc = "\\n".join(desc_parts)

                if job_url and not job_url.startswith("http"):
                    job_url = "https://www.naukri.com" + job_url

                jobs.append({
                    "id":          job_id or title[:20],
                    "title":       title,
                    "company":     company.lower().replace(" ", "-"),
                    "url":         job_url or url,
                    "location":    loc,
                    "description": desc[:10000],
                    "source":      "naukri",
                    "posted_at":   "",
                })
            except Exception:
                continue

        browser.close()
        print(json.dumps({"success": True, "jobs": jobs, "count": len(jobs), "error": None}))

except Exception as e:
    print(json.dumps({"success": False, "jobs": [], "count": 0, "error": str(e)}))
"""


def scrape_naukri(keyword: str = "software engineer", location: str = "", count: int = 30) -> dict:
    """Scrape Naukri.com jobs for a given keyword."""
    kw_slug  = keyword.lower().replace(" ", "-")
    loc_slug = location.lower().replace(" ", "-") if location else ""
    url = f"https://www.naukri.com/{kw_slug}-jobs-in-{loc_slug}" if loc_slug else f"https://www.naukri.com/{kw_slug}-jobs"
    project_root = str(Path(__file__).parent.parent)

    try:
        proc = subprocess.run(
            [sys.executable, "-c", _NAUKRI_SCRIPT, url, str(count), project_root],
            capture_output=True, text=True, timeout=60,
        )
        if proc.stdout.strip():
            return json.loads(proc.stdout.strip())
        log.warning("Naukri stderr: %s", proc.stderr[-300:] if proc.stderr else "none")
        return {"success": False, "jobs": [], "count": 0, "error": "No output from browser"}
    except subprocess.TimeoutExpired:
        return {"success": False, "jobs": [], "count": 0, "error": "Timeout"}
    except Exception as e:
        return {"success": False, "jobs": [], "count": 0, "error": str(e)}