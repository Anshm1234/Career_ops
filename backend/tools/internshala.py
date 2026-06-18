"""
tools/internshala.py — scrapes Internshala via Playwright subprocess.
Fetches both jobs and internships sections.
"""
import json
import subprocess
import sys
import logging
from pathlib import Path

log = logging.getLogger(__name__)

_INTERNSHALA_SCRIPT = """
import json, sys, time
from playwright.sync_api import sync_playwright

keyword           = sys.argv[1]
fetch_jobs        = sys.argv[2] == "True"
fetch_internships = sys.argv[3] == "True"
project_root      = sys.argv[4]

def scrape_page(page, url, source_type, seen_urls):
    try:
        page.goto(url, timeout=30000)
        try:
            page.wait_for_selector("div.individual_internship", timeout=10000)
        except Exception:
            pass
        time.sleep(2)

        cards = page.query_selector_all("div.individual_internship")
        results = []
        for card in cards[:50]:
            try:
                if "Online Course" in (card.inner_text() or ""):
                    continue

                title_el   = card.query_selector("h2.job-internship-name a, h3.job-internship-name a, a.job-title-href")
                company_el = card.query_selector("p.company-name, div.company_name p")
                loc_el     = card.query_selector("p.locations span, p.row-1-item.locations span")
                sal_el     = card.query_selector("p.stipend, span.stipend, p.row-1-item.salary")
                skills_el  = card.query_selector("div.skills_section, div[class*='skill']")
                url_el     = card.query_selector("a.job-title-href, h2 a, h3 a")

                title   = title_el.inner_text().strip()   if title_el   else ""
                company = company_el.inner_text().strip() if company_el else ""
                loc     = loc_el.inner_text().strip()     if loc_el     else "Remote"
                salary  = sal_el.inner_text().strip()     if sal_el     else ""
                skills  = skills_el.inner_text().strip()  if skills_el  else ""
                href    = url_el.get_attribute("href")    if url_el     else ""

                if not title or not href:
                    continue

                full_url = href if href.startswith("http") else f"https://internshala.com{href}"

                if full_url in seen_urls:
                    continue
                seen_urls.add(full_url)

                desc_parts = []
                if salary: desc_parts.append(f"Salary: {salary}")
                if skills: desc_parts.append(f"Skills: {skills}")
                desc = "\\n".join(desc_parts)

                results.append({
                    "id":          href.split("/")[-1],
                    "title":       title,
                    "company":     company.lower().replace(" ", "-"),
                    "url":         full_url,
                    "location":    loc,
                    "description": desc[:10000],
                    "source":      f"internshala-{source_type}",
                    "posted_at":   "",
                })
            except Exception:
                continue
        return results
    except Exception:
        return []

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 800},
        )
        page = ctx.new_page()
        all_jobs = []
        seen_urls = set()
        kw_slug = keyword.lower().replace(" ", "-")

        if fetch_jobs:
            all_jobs += scrape_page(page, f"https://internshala.com/jobs/{kw_slug}-jobs", "job", seen_urls)
        if fetch_internships:
            all_jobs += scrape_page(page, f"https://internshala.com/internships/{kw_slug}-internship", "internship", seen_urls)

        browser.close()
        print(json.dumps({"success": True, "jobs": all_jobs, "count": len(all_jobs), "error": None}))

except Exception as e:
    print(json.dumps({"success": False, "jobs": [], "count": 0, "error": str(e)}))
"""


def scrape_internshala(keyword: str = "computer science", fetch_jobs: bool = True, fetch_internships: bool = True) -> dict:
    """Scrape Internshala for jobs and/or internships."""
    project_root = str(Path(__file__).parent.parent)
    try:
        proc = subprocess.run(
            [sys.executable, "-c", _INTERNSHALA_SCRIPT, keyword, str(fetch_jobs), str(fetch_internships), project_root],
            capture_output=True, text=True, timeout=90,
        )
        if proc.stdout.strip():
            return json.loads(proc.stdout.strip())
        log.warning("Internshala stderr: %s", proc.stderr[-300:] if proc.stderr else "none")
        return {"success": False, "jobs": [], "count": 0, "error": "No output from browser"}
    except subprocess.TimeoutExpired:
        return {"success": False, "jobs": [], "count": 0, "error": "Timeout"}
    except Exception as e:
        return {"success": False, "jobs": [], "count": 0, "error": str(e)}