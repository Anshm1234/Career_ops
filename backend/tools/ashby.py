"""
tools/ashby.py — scrapes Ashby HQ ATS via their public GraphQL API.

Ashby removed jobUrl and descriptionHtml from the board API.
We now:
  1. Fetch job list (id, title, location) via ApiJobBoardWithTeams
  2. Fetch description per job via ApiJobPosting (first 30 jobs only)
"""
import requests
import re
import time
from config import REQUEST_TIMEOUT, RETRY_ATTEMPTS, DELAY_BETWEEN_REQS

ASHBY_BOARD_URL = "https://jobs.ashbyhq.com/api/non-user-graphql?op=ApiJobBoardWithTeams"
ASHBY_JOB_URL   = "https://jobs.ashbyhq.com/api/non-user-graphql?op=ApiJobPosting"

BOARD_QUERY = """
query ApiJobBoardWithTeams($organizationHostedJobsPageName: String!) {
    jobBoard: jobBoardWithTeams(
        organizationHostedJobsPageName: $organizationHostedJobsPageName
    ) {
        jobPostings {
            id
            title
            locationName
            employmentType
        }
    }
}
"""

JOB_QUERY = """
query ApiJobPosting($jobPostingId: String!) {
    jobPosting(id: $jobPostingId) {
        descriptionHtml
    }
}
"""

HEADERS = {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json",
}


def _fetch_description(job_id: str) -> str:
    """Fetch description for a single job. Returns empty string on failure."""
    try:
        resp = requests.post(
            ASHBY_JOB_URL,
            json={
                "operationName": "ApiJobPosting",
                "variables": {"jobPostingId": job_id},
                "query": JOB_QUERY,
            },
            headers=HEADERS,
            timeout=REQUEST_TIMEOUT,
        )
        if resp.ok:
            html = resp.json().get("data", {}).get("jobPosting", {}).get("descriptionHtml", "")
            return _strip_html(html)
    except Exception:
        pass
    return ""


def scrape_ashby(company_slug: str) -> dict:
    """
    Fetch all open jobs from an Ashby-powered company.

    Args:
        company_slug: e.g. 'linear', 'cursor', 'perplexity'
    """
    payload = {
        "operationName": "ApiJobBoardWithTeams",
        "variables": {"organizationHostedJobsPageName": company_slug},
        "query": BOARD_QUERY,
    }

    for attempt in range(1, RETRY_ATTEMPTS + 1):
        try:
            resp = requests.post(
                ASHBY_BOARD_URL,
                json=payload,
                headers=HEADERS,
                timeout=REQUEST_TIMEOUT,
            )
            resp.raise_for_status()
            data = resp.json()

            if "errors" in data:
                error_msg = data["errors"][0].get("message", "GraphQL error")
                return {"success": False, "jobs": [], "count": 0, "error": error_msg}

            postings = (
                data.get("data", {})
                    .get("jobBoard", {})
                    .get("jobPostings", []) or []
            )

            jobs = []
            for i, post in enumerate(postings):
                job_id = post.get("id", "")
                if not job_id:
                    continue

                # Fetch description for first 30 jobs to limit API calls
                desc = ""
                if i < 30:
                    desc = _fetch_description(job_id)
                    time.sleep(0.1)

                jobs.append({
                    "id":          job_id,
                    "title":       post.get("title", "").strip(),
                    "company":     company_slug,
                    "url":         f"https://jobs.ashbyhq.com/{company_slug}/{job_id}",
                    "location":    post.get("locationName", "Not specified"),
                    "description": desc,
                    "source":      "ashby",
                    "posted_at":   post.get("employmentType", ""),
                })

            time.sleep(DELAY_BETWEEN_REQS)
            return {"success": True, "jobs": jobs, "count": len(jobs), "error": None}

        except requests.exceptions.HTTPError as e:
            status = e.response.status_code if e.response else "?"
            error = f"HTTP {status} — slug '{company_slug}' may be wrong or company left Ashby"
            if attempt == RETRY_ATTEMPTS:
                return {"success": False, "jobs": [], "count": 0, "error": error}

        except Exception as e:
            if attempt == RETRY_ATTEMPTS:
                return {"success": False, "jobs": [], "count": 0, "error": str(e)}

        time.sleep(attempt * 1.5)

    return {"success": False, "jobs": [], "count": 0, "error": "Max retries exceeded"}


def _strip_html(html: str) -> str:
    """Remove HTML tags and normalise whitespace."""
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:10000]