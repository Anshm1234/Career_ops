"""
tools/workday.py — scrapes Workday career pages using Playwright.

Why Playwright and not requests?
  Workday pages are JavaScript-rendered (React/Angular SPAs).
  A plain requests.get() returns an empty shell — no job listings.
  Playwright launches a real headless browser that runs the JS,
  waits for the listings to load, then extracts the HTML.

First-time setup (run once after installing requirements):
    playwright install chromium
"""
import time
import re
from typing import Optional
from config import REQUEST_TIMEOUT


def scrape_workday(company_name: str, url: str) -> dict:
    """
    Scrape job listings from a Workday career page.

    Args:
        company_name: Human-readable name, e.g. 'google'
        url:          Full URL of the jobs listing page

    Returns standard { success, jobs, count, error } dict.
    """
    try:
        from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout
    except ImportError:
        return {
            "success": False, "jobs": [], "count": 0,
            "error": "Playwright not installed. Run: pip install playwright && playwright install chromium"
        }

    jobs = []

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-setuid-sandbox"],
            )
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                           "AppleWebKit/537.36 (KHTML, like Gecko) "
                           "Chrome/120.0.0.0 Safari/537.36",
                viewport={"width": 1280, "height": 800},
            )
            page = context.new_page()

            # Navigate and wait for job listings to render
            page.goto(url, wait_until="domcontentloaded", timeout=REQUEST_TIMEOUT * 1000)

            # Wait for job cards — try multiple selectors Workday uses
            job_selectors = [
                "li[data-automation-id='compositeContainer']",
                "li.css-1q2dra3",
                "div[data-automation-id='jobItem']",
                "section[data-automation-id='jobResults'] li",
                "ul[role='list'] li",
            ]

            loaded = False
            for selector in job_selectors:
                try:
                    page.wait_for_selector(selector, timeout=8000)
                    loaded = True
                    break
                except PWTimeout:
                    continue

            if not loaded:
                # Fallback: wait for any list items
                try:
                    page.wait_for_selector("li", timeout=5000)
                except PWTimeout:
                    pass

            # Scroll to load lazy content
            _auto_scroll(page)

            # Extract jobs using multiple selector strategies
            jobs = _extract_jobs(page, company_name, url)

            # If the page has pagination, try to get more pages (max 3)
            if jobs:
                jobs = _handle_pagination(page, company_name, url, jobs, max_pages=3)

            browser.close()

        return {
            "success": True,
            "jobs":    jobs,
            "count":   len(jobs),
            "error":   None,
        }

    except Exception as e:
        return {
            "success": False,
            "jobs":    [],
            "count":   0,
            "error":   f"Playwright error: {str(e)}",
        }


def _extract_jobs(page, company_name: str, base_url: str) -> list:
    """Extract job data from the loaded page DOM."""
    jobs = []

    # Strategy 1: Workday's standard job list structure
    try:
        job_items = page.query_selector_all(
            "li[data-automation-id='compositeContainer'], "
            "li.css-1q2dra3, "
            "div[data-automation-id='jobItem']"
        )

        for item in job_items:
            title    = _safe_text(item, "a[data-automation-id='jobTitle'], h3 a, .css-19uc56f")
            location = _safe_text(item, "dd[data-automation-id='locations'], .css-129m7dg, dd")
            link_el  = item.query_selector("a[data-automation-id='jobTitle'], h3 a, a")
            href     = link_el.get_attribute("href") if link_el else ""

            if title:
                full_url = _make_absolute(href, base_url)
                jobs.append({
                    "id":          _url_to_id(full_url),
                    "title":       title,
                    "company":     company_name,
                    "url":         full_url,
                    "location":    location or "Not specified",
                    "description": "",   # Workday descriptions require a second page load
                    "source":      "workday",
                    "posted_at":   _safe_text(item, "dd[data-automation-id='postedOn'], .css-1q2dra3 dd:last-child"),
                })
    except Exception:
        pass

    # Strategy 2: Generic anchor scrape (fallback)
    if not jobs:
        try:
            anchors = page.query_selector_all("a[href*='job/'], a[href*='/jobs/']")
            seen = set()
            for a in anchors:
                title = (a.inner_text() or "").strip()
                href  = a.get_attribute("href") or ""
                if title and len(title) > 4 and href and href not in seen:
                    seen.add(href)
                    jobs.append({
                        "id":          _url_to_id(href),
                        "title":       title,
                        "company":     company_name,
                        "url":         _make_absolute(href, base_url),
                        "location":    "Not specified",
                        "description": "",
                        "source":      "workday",
                        "posted_at":   "",
                    })
        except Exception:
            pass

    return jobs


def _handle_pagination(page, company_name: str, base_url: str,
                        existing_jobs: list, max_pages: int = 3) -> list:
    """Click 'next page' up to max_pages times and collect more jobs."""
    all_jobs = list(existing_jobs)
    seen_urls = {j["url"] for j in all_jobs}

    for _ in range(max_pages - 1):
        try:
            next_btn = page.query_selector(
                "button[data-automation-id='next'], "
                "button[aria-label='next'], "
                "a[aria-label='next page']"
            )
            if not next_btn or not next_btn.is_enabled():
                break

            next_btn.click()
            page.wait_for_load_state("networkidle", timeout=8000)
            time.sleep(1)

            new_jobs = _extract_jobs(page, company_name, base_url)
            added = 0
            for job in new_jobs:
                if job["url"] not in seen_urls:
                    seen_urls.add(job["url"])
                    all_jobs.append(job)
                    added += 1
            if added == 0:
                break   # no new jobs = last page
        except Exception:
            break

    return all_jobs


def _auto_scroll(page, scroll_steps: int = 4):
    """Scroll down incrementally to trigger lazy loading."""
    for i in range(1, scroll_steps + 1):
        page.evaluate(f"window.scrollTo(0, document.body.scrollHeight * {i / scroll_steps})")
        time.sleep(0.4)


def _safe_text(element, selector: str) -> str:
    """Query a child element and return its text, or empty string."""
    try:
        el = element.query_selector(selector)
        return (el.inner_text() or "").strip() if el else ""
    except Exception:
        return ""


def _make_absolute(href: str, base_url: str) -> str:
    """Turn a relative href into a full URL."""
    if not href:
        return base_url
    if href.startswith("http"):
        return href
    from urllib.parse import urljoin
    return urljoin(base_url, href)


def _url_to_id(url: str) -> str:
    """Derive a short ID from a URL."""
    return re.sub(r"[^a-zA-Z0-9]", "_", url.split("/")[-1] or url[-20:])
