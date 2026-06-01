"""
tools/greenhouse.py — scrapes Greenhouse ATS via their public JSON API.
No login, no API key needed. Works for Anthropic, OpenAI, Stripe, etc.
"""
import requests
import time
from config import REQUEST_TIMEOUT, RETRY_ATTEMPTS, DELAY_BETWEEN_REQS


def scrape_greenhouse(company_slug: str) -> dict:
    """
    Fetch all open jobs from a Greenhouse-powered company.

    Args:
        company_slug: The company's Greenhouse slug (e.g. 'anthropic', 'openai')

    Returns:
        {
            "success": bool,
            "jobs":    list of job dicts,
            "count":   int,
            "error":   str or None
        }
    """
    url = f"https://boards-api.greenhouse.io/v1/boards/{company_slug}/jobs?content=true"

    for attempt in range(1, RETRY_ATTEMPTS + 1):
        try:
            resp = requests.get(url, timeout=REQUEST_TIMEOUT)
            resp.raise_for_status()
            data = resp.json()

            jobs = []
            for job in data.get("jobs", []):
                jobs.append({
                    "id":          str(job["id"]),
                    "title":       job.get("title", "").strip(),
                    "company":     company_slug,
                    "url":         job.get("absolute_url", ""),
                    "location":    job.get("location", {}).get("name", "Not specified"),
                    "description": _clean(job.get("content", "")),
                    "source":      "greenhouse",
                    "posted_at":   job.get("updated_at", ""),
                })

            time.sleep(DELAY_BETWEEN_REQS)
            return {"success": True, "jobs": jobs, "count": len(jobs), "error": None}

        except requests.exceptions.HTTPError as e:
            status = e.response.status_code if e.response else "?"
            error = f"HTTP {status} — slug '{company_slug}' may be wrong or company left Greenhouse"
            if attempt == RETRY_ATTEMPTS:
                return {"success": False, "jobs": [], "count": 0, "error": error}

        except requests.exceptions.Timeout:
            error = f"Timeout after {REQUEST_TIMEOUT}s"
            if attempt == RETRY_ATTEMPTS:
                return {"success": False, "jobs": [], "count": 0, "error": error}

        except Exception as e:
            error = str(e)
            if attempt == RETRY_ATTEMPTS:
                return {"success": False, "jobs": [], "count": 0, "error": error}

        time.sleep(attempt * 1.5)   # back off before retry

    return {"success": False, "jobs": [], "count": 0, "error": "Max retries exceeded"}


def _clean(html: str) -> str:
    """Strip HTML tags and cap length for LLM context."""
    import re
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:10000]
