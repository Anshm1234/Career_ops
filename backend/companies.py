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
        "anthropic",
        "openai",
        "stripe",
        "notion",
        "discord",
        "figma",
        "vercel",
        "airtable",
        "canva",
        "databricks",
        "confluent",
        "rippling",
        "brex",
        "scaleai",
        "huggingface",
        "mixpanel",
        "amplitude",
        "segment",
        "twilio",
        "cloudflare",
    ],

    # ── Lever (public JSON API) ────────────────────────────────────────────
    "lever": [
        "spotify",
        "zoox",
        "matchgroup",
        "woven-by-toyota",
        "fullscript",
        "theathletic",
        "faire",
        "lattice",
        "duolingo",
        "lyft",
        "doordash",
        "coinbase",
        "gusto",
        "zendesk",
        "twitch",
        "pinterest",
        "riotgames",
        "remofirst",
        "xsolla",
        "radicalai",
        "github",
    ],

    # ── Ashby (GraphQL API — public, no auth) ─────────────────────────────
    "ashby": [
        "linear",
        "loom",
        "beehiiv",
        "retool",
        "dbt-labs",
        "mercury",
        "ramp",
        "watershed",
        "cursor",
        "perplexity",
        "mistral",
        "cohere",
        "together-ai",
        "groq",
        "runway",
        "replit",
        "supabase",
        "modal",
        "neon",
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
