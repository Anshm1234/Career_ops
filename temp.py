"""
Find which fields Ashby board API allows. Run from D:\CODING\career-ops.
"""
import requests

URL = "https://jobs.ashbyhq.com/api/non-user-graphql?op=ApiJobBoardWithTeams"
HEADERS = {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
}

# Try minimal fields first
for fields in [
    "id title locationName",
    "id title locationName employmentType",
    "id title locationName teamId",
    "id title locationName departmentName",
    "id title location { name }",
]:
    query = f"""query ApiJobBoardWithTeams($organizationHostedJobsPageName: String!) {{
        jobBoard: jobBoardWithTeams(organizationHostedJobsPageName: $organizationHostedJobsPageName) {{
            jobPostings {{ {fields} }}
        }}
    }}"""
    r = requests.post(URL, json={
        "operationName": "ApiJobBoardWithTeams",
        "variables": {"organizationHostedJobsPageName": "linear"},
        "query": query,
    }, headers=HEADERS, timeout=10)
    data = r.json()
    if "errors" in data:
        print(f"✗ [{fields}]: {data['errors'][0]['message'][:70]}")
    else:
        jobs = data.get("data",{}).get("jobBoard",{}).get("jobPostings",[])
        print(f"✓ [{fields}]: {len(jobs)} jobs")
        if jobs:
            print(f"   sample: {jobs[0]}")