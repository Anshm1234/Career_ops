"""
agents/tool_definitions.py — describes every tool the orchestrator agent can call.
Gemini uses these to decide which tool to invoke and with what arguments.
"""

# Gemini expects tools as a list of dicts with 'function_declarations'
TOOLS = [
    {
        "function_declarations": [
            {
                "name": "scrape_greenhouse",
                "description": (
                    "Scrape all open job listings from a company that uses Greenhouse ATS. "
                    "Returns jobs with title, URL, location, and description. "
                    "Use for: Anthropic, OpenAI, Stripe, Notion, Discord, Figma, Vercel, "
                    "Airtable, Canva, Databricks, Confluent, Rippling, Brex, Scale AI, HuggingFace. "
                    "If it fails, retry once before moving on."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "company_slug": {
                            "type": "string",
                            "description": (
                                "The company's Greenhouse slug, lowercase with hyphens. "
                                "Examples: 'anthropic', 'openai', 'stripe', 'huggingface'"
                            ),
                        }
                    },
                    "required": ["company_slug"],
                },
            },
            {
                "name": "scrape_lever",
                "description": (
                    "Scrape all open job listings from a company that uses Lever ATS. "
                    "Use for: Reddit, Carta, Benchling, NerdWallet, Plaid, Robinhood, Faire, Lattice."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "company_slug": {
                            "type": "string",
                            "description": "The company's Lever slug, e.g. 'reddit', 'carta', 'plaid'",
                        }
                    },
                    "required": ["company_slug"],
                },
            },
            {
                "name": "scrape_ashby",
                "description": (
                    "Scrape all open job listings from a company that uses Ashby HQ ATS. "
                    "Use for: Linear, Loom, Beehiiv, Retool, dbt Labs, Mercury, Ramp, Watershed."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "company_slug": {
                            "type": "string",
                            "description": "The company's Ashby slug, e.g. 'linear', 'loom', 'retool'",
                        }
                    },
                    "required": ["company_slug"],
                },
            },
            {
                "name": "scrape_workday",
                "description": (
                    "Scrape job listings from a Workday-powered career page using a browser. "
                    "Slower than the API scrapers — use for Google, Microsoft, Amazon, Intel. "
                    "Requires the full URL of the jobs listing page."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "company_name": {
                            "type": "string",
                            "description": "Human-readable company name, e.g. 'google', 'microsoft'",
                        },
                        "url": {
                            "type": "string",
                            "description": "Full URL of the Workday jobs listing page",
                        },
                    },
                    "required": ["company_name", "url"],
                },
            },
            {
                "name": "save_jobs",
                "description": (
                    "Save a batch of scraped jobs to disk. "
                    "Call this immediately after each successful scrape. "
                    "Automatically deduplicates by job URL so calling it multiple times is safe."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "jobs": {
                            "type": "array",
                            "description": "List of job objects returned by a scraper tool",
                            "items": {"type": "object"},
                        }
                    },
                    "required": ["jobs"],
                },
            },
            {
                "name": "get_run_summary",
                "description": (
                    "Get the current status of the scraping run — "
                    "total jobs found, which companies succeeded, which failed, time elapsed. "
                    "Call this at the end of the run to produce the final report."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "required": [],
                },
            },
        ]
    }
]
