# career-ops — Layer 1: Job Discovery Agent

An autonomous agent powered by **Gemini** (free tier) that scrapes job listings
from 40+ company career pages across 4 ATS platforms and saves them to a structured JSON file.

---

## Project structure

```
career-ops/
├── main.py                     ← run this
├── config.py                   ← reads .env, exposes typed config
├── requirements.txt            ← pip dependencies
├── .env.example                ← copy to .env and fill in
├── .gitignore
│
├── agents/
│   ├── orchestrator.py         ← Gemini agent loop with tool calling
│   └── tool_definitions.py     ← tool schemas for Gemini
│
├── tools/
│   ├── greenhouse.py           ← JSON API scraper
│   ├── lever.py                ← JSON API scraper
│   ├── ashby.py                ← GraphQL API scraper
│   └── workday.py              ← Playwright HTML scraper
│
├── data/
│   ├── companies.py            ← master list of companies + ATS platform
│   └── jobs.json               ← output (auto-created on first run)
│
└── logs/
    └── run.log                 ← auto-created on first run
```

---

## Setup

### 1. Create and activate a virtual environment

```bash
# Create
python -m venv venv

# Activate — Mac/Linux
source venv/bin/activate

# Activate — Windows
venv\Scripts\activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Install Playwright browser (one-time)

```bash
playwright install chromium
```

This downloads a headless Chromium browser (~130MB) used for Workday scraping.


### 4. Set up your .env file

```bash
cp .env.example .env
```

Open `.env` and add your Gemini API key:

```
GEMINI_API_KEY=your_key_here
```

Get a free key at: https://aistudio.google.com/app/apikey
Free tier: 1500 requests/day, 15 requests/minute — more than enough for this agent.

### 5. Run

```bash
python main.py
```

---

## Output

Jobs are saved to `data/jobs.json`. Each job looks like:

```json
{
  "id": "12345",
  "title": "Software Engineering Intern",
  "company": "anthropic",
  "url": "https://boards.greenhouse.io/anthropic/jobs/12345",
  "location": "San Francisco, CA",
  "description": "We are looking for...",
  "source": "greenhouse",
  "posted_at": "2025-06-01T00:00:00Z"
}
```

---

## How the agent works

| Step | What happens |
|------|-------------|
| 1 | Gemini receives the full company list |
| 2 | Gemini decides which company + tool to use first |
| 3 | Tool runs, returns `{ success, jobs, count, error }` |
| 4 | Gemini calls `save_jobs` to persist results |
| 5 | If failed, Gemini retries once automatically |
| 6 | Repeats for all companies |
| 7 | Calls `get_run_summary`, prints final report |

This is an **agentic loop** — Gemini reasons about results and decides next steps.
It's not a script; it handles failures, retries, and state on its own.

---

## Adding more companies

Edit `data/companies.py`:

- **Greenhouse**: add the slug from `https://boards.greenhouse.io/SLUG`
- **Lever**: add the slug from `https://jobs.lever.co/SLUG`
- **Ashby**: add the slug from `https://jobs.ashbyhq.com/SLUG`
- **Workday**: add `{ "name": "company", "url": "full jobs page URL" }`

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Missing environment variable: GEMINI_API_KEY` | You forgot to copy `.env.example` to `.env` |
| `playwright install chromium` fails | Try `python -m playwright install chromium` |
| A company returns 0 jobs | Their slug may have changed — check the URL manually |
| Rate limit error from Gemini | Free tier is 15 RPM — the 0.3s delay handles this, but if you hit it, increase `DELAY_BETWEEN_REQS` in `.env` |
| Workday returns 0 jobs | Workday frequently changes its HTML structure — check `tools/workday.py` selectors |
