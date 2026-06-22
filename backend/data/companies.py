"""
companies.py — master list of companies grouped by which ATS they use.

How to find a company's slug:
  Greenhouse → https://boards.greenhouse.io/SLUG
  Lever      → https://jobs.lever.co/SLUG
  Ashby      → https://jobs.ashbyhq.com/SLUG
  Workday    → search "company careers workday" and grab the subdomain
"""

COMPANIES = {

    # ── Greenhouse (public JSON API — most reliable) ───────────────────────
    "greenhouse": [
        # Global AI/Tech (verified June 2026)
        "anthropic",
        "stripe",
        "discord",
        "figma",
        "vercel",
        "airtable",
        "databricks",
        "brex",
        "scaleai",
        "mixpanel",
        "amplitude",
        "twilio",
        "cloudflare",
        "xai",
        "deepmind",
        "postman",
        "imbue",
        # Indian + India-office companies (verified June 2026)
        "phonepe",                          # Indian fintech, Bangalore
        "groww",                            # Indian fintech, Bangalore
        "razorpaysoftwareprivatelimited",   # Razorpay — Indian fintech unicorn, ~40 jobs
        "alphasense",                       # Market intelligence, India offices (Pune/Mumbai/Blr), ~150 jobs
        "hackerrank",                       # Indian-origin tech assessment platform, ~46 jobs
    ],

    # ── Lever (public JSON API) ────────────────────────────────────────────
    "lever": [
        # Global (verified May 2026)
        "spotify",          # 183 jobs
        "zoox",             # 225 jobs
        "matchgroup",       # 80 jobs
        "woven-by-toyota",  # 157 jobs
        "fullscript",       # 23 jobs
        "theathletic",      # 15 jobs
        "remofirst",        # 18 jobs
        "xsolla",           # 167 jobs
        "palantir",         # 221 jobs
        "applike",          # 58 jobs
        # Indian companies (verified June 2026)
        "cred",             # Indian fintech, Bangalore
        "meesho",           # Indian e-commerce unicorn, Bangalore
        "hevodata",         # Indian data pipeline startup, Bangalore
        "fampay",           # Indian fintech for teens, Bangalore
    ],

    # ── Ashby (GraphQL API — public, no auth) ─────────────────────────────
    "ashby": [
        # Global AI-native (verified May 2026)
        "linear",       # 26 jobs
        "cursor",       # 86 jobs
        "perplexity",   # 60 jobs
        "replit",       # 89 jobs
        "ramp",         # 119 jobs
        "cohere",       # 131 jobs
        "runway",       # 4 jobs
        "supabase",     # 43 jobs
        "modal",        # 29 jobs
        "neon",         # 7 jobs
        "watershed",    # 38 jobs
        # Indian AI startup
        "sarvam",       # 43 jobs — Indian LLM startup
        # Vector DB / AI infra
        "e2b",          # 16 jobs
        "lancedb",      # 6 jobs
        "weaviate",     # 4 jobs
        "pinecone",     # 7 jobs
        # India-office companies (verified June 2026 — re-verify job counts after first scrape)
        "airwallex",    # Fintech, Bangalore office
        "flagright.com", # AI fintech compliance, Bangalore
    ],

    # ── Workday (HTML scraping via Playwright) ─────────────────────────────
    # Format: { "name": display name, "url": full jobs page URL }
    "workday": [
        {
            "name": "google",
            "url": "https://www.google.com/about/careers/applications/jobs/results/?degree=BACHELORS&employment_type=INTERN",
        },
        {
            "name": "microsoft",
            "url": "https://jobs.careers.microsoft.com/global/en/search?q=intern&lc=India",
        },
        {
            "name": "amazon",
            "url": "https://www.amazon.jobs/en/search?base_query=software+intern&loc_query=India",
        },
        {
            "name": "intel",
            "url": "https://jobs.intel.com/en/search-jobs/intern/India/599/1/2/6254388/22.8384/80.9108/50/any",
        },
    ],
}