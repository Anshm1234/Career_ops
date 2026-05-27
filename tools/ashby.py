"""
tools/ashby.py — scrapes Ashby HQ ATS via their public GraphQL API.
"""
import requests
import re
import time
from config import REQUEST_TIMEOUT, RETRY_ATTEMPTS, DELAY_BETWEEN_REQS

ASHBY_GRAPHQL_URL = "https://jobs.ashbyhq.com/api/non-user-graphql?op=ApiJobBoardWithTeams"

QUERY = """
query ApiJobBoardWithTeams($organizationHostedJobsPageName: String!) {
    jobBoard: jobBoardWithTeams(
        organizationHostedJobsPageName: $organizationHostedJobsPageName
    ) {
        jobPostings {
            id
            title
            locationName
            jobUrl
            descriptionHtml
            publishedDate
        }
    }
}
"""


def scrape_ashby(company_slug: str) -> dict:
    """
    Fetch all open jobs from an Ashby-powered company.

    Args:
        company_slug: e.g. 'linear', 'loom', 'retool'
    """
    payload = {
        "operationName": "ApiJobBoardWithTeams",
        "variables": {"organizationHostedJobsPageName": company_slug},
        "query": QUERY,
    }
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; career-ops-bot/1.0)",
    }

    for attempt in range(1, RETRY_ATTEMPTS + 1):
        try:
            resp = requests.post(
                ASHBY_GRAPHQL_URL,
                json=payload,
                headers=headers,
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
                    .get("jobPostings", [])
            )

            jobs = []
            for post in postings:
                jobs.append({
                    "id":          post.get("id", ""),
                    "title":       post.get("title", "").strip(),
                    "company":     company_slug,
                    "url":         post.get("jobUrl", ""),
                    "location":    post.get("locationName", "Not specified"),
                    "description": _strip_html(post.get("descriptionHtml", "")),
                    "source":      "ashby",
                    "posted_at":   post.get("publishedDate", ""),
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


def _strip_html(html: str) -> str:
    """Remove HTML tags and normalise whitespace."""
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:10000]
