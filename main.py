# main.py
import os
from dotenv import load_dotenv
from agents.orchestrator import run_discovery_agent

load_dotenv()

if __name__ == "__main__":
    summary = run_discovery_agent()

    print("\n" + "=" * 50)
    print("FINAL REPORT")
    print("=" * 50)
    print(f"Total jobs found:    {summary['total_jobs']}")
    print(f"Companies succeeded: {len(summary['companies_succeeded'])}")
    print(f"Companies failed:    {len(summary['companies_failed'])}")
    if summary['companies_failed']:
        print(f"Failed:              {', '.join(summary['companies_failed'])}")
    print(f"Time taken:          {summary['elapsed_seconds']}s")
    print(f"\nJobs saved to: data/jobs.json")