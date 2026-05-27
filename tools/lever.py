"""
tools/lever.py — scrapes Lever ATS via their public JSON API.
"""
import requests
import time
from config import REQUEST_TIMEOUT, RETRY_ATTEMPTS, DELAY_BETWEEN_REQS


def scrape_lever(company_slug: str) -> dict:
    """
    Fetch all open jobs from a Lever-powered company.

    Args:
        company_slug: e.g. 'reddit', 'carta', 'plaid'
    """
    url = f"https://api.lever.co/v0/postings/{company_slug}?mode=json"

    for attempt in range(1, RETRY_ATTEMPTS + 1):
        try:
            resp = requests.get(url, timeout=REQUEST_TIMEOUT)
            resp.raise_for_status()
            postings = resp.json()

            # Lever returns a list directly (not wrapped in a key)
            if not isinstance(postings, list):
                return {"success": False, "jobs": [], "count": 0,
                        "error": "Unexpected response format from Lever"}

            jobs = []
            for post in postings:
                # Build clean description from all Lever text blocks
                desc_parts = []
                for section in post.get("lists", []):
                    desc_parts.append(section.get("text", ""))
                    for item in section.get("content", []):
                        desc_parts.append(f"• {item}")
                desc_plain = post.get("descriptionPlain", "")
                full_desc = desc_plain or "\n".join(desc_parts)

                jobs.append({
                    "id":          post.get("id", ""),
                    "title":       post.get("text", "").strip(),
                    "company":     company_slug,
                    "url":         post.get("hostedUrl", ""),
                    "location":    post.get("categories", {}).get("location", "Not specified"),
                    "description": full_desc[:10000],
                    "source":      "lever",
                    "posted_at":   "",
                })

            time.sleep(DELAY_BETWEEN_REQS)
            return {"success": True, "jobs": jobs, "count": len(jobs), "error": None}

        except requests.exceptions.HTTPError as e:
            status = e.response.status_code if e.response else "?"
            error = f"HTTP {status} — slug '{company_slug}' may be wrong"
            if attempt == RETRY_ATTEMPTS:
                return {"success": False, "jobs": [], "count": 0, "error": error}

        except Exception as e:
            if attempt == RETRY_ATTEMPTS:
                return {"success": False, "jobs": [], "count": 0, "error": str(e)}

        time.sleep(attempt * 1.5)

    return {"success": False, "jobs": [], "count": 0, "error": "Max retries exceeded"}
