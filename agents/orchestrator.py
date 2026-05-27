"""
agents/orchestrator.py — the brain of Layer 1.

Uses Gemini's function-calling feature to run an autonomous agent loop:
  1. Gemini decides which company to scrape next
  2. Calls the appropriate tool
  3. Receives the result
  4. Decides what to do next (retry, move on, save, summarise)
  5. Repeats until all companies are done
"""
import json
import time
import logging
from datetime import datetime
from colorama import Fore, Style, init as colorama_init

import google.generativeai as genai

from config import GEMINI_API_KEY, GEMINI_MODEL, JOBS_FILE
from data.companies import COMPANIES
from agents.tool_definitions import TOOLS
from tools.greenhouse import scrape_greenhouse
from tools.lever import scrape_lever
from tools.ashby import scrape_ashby
from tools.workday import scrape_workday

colorama_init(autoreset=True)
logging.basicConfig(
    filename="logs/run.log",
    level=logging.INFO,
    format="%(asctime)s  %(levelname)s  %(message)s",
)
log = logging.getLogger(__name__)

# ── Configure Gemini ──────────────────────────────────────────────────────────
genai.configure(api_key=GEMINI_API_KEY)

# ── Runtime state (shared across the agent loop) ───────────────────────────────
_state = {
    "jobs":       [],
    "seen_urls":  set(),
    "succeeded":  [],
    "failed":     {},          # { company: error_message }
    "start_time": None,
}


# ── Tool implementations (called when Gemini requests them) ───────────────────

def _save_jobs(jobs: list) -> dict:
    new = 0
    for job in jobs:
        url = job.get("url", "")
        if url and url not in _state["seen_urls"]:
            _state["seen_urls"].add(url)
            _state["jobs"].append(job)
            new += 1
    with open(JOBS_FILE, "w", encoding="utf-8") as f:
        json.dump(_state["jobs"], f, indent=2, ensure_ascii=False)
    return {"saved": new, "total_so_far": len(_state["jobs"])}


def _get_run_summary() -> dict:
    elapsed = int((datetime.now() - _state["start_time"]).total_seconds()) \
              if _state["start_time"] else 0
    return {
        "total_jobs":          len(_state["jobs"]),
        "companies_succeeded": _state["succeeded"],
        "companies_failed":    _state["failed"],
        "elapsed_seconds":     elapsed,
    }


def _dispatch(tool_name: str, args: dict) -> str:
    """Route a tool call from Gemini to the right Python function."""
    _print_tool_call(tool_name, args)
    log.info(f"Tool call: {tool_name}({args})")

    if tool_name == "scrape_greenhouse":
        slug = args["company_slug"]
        result = scrape_greenhouse(slug)
        if result["success"]:
            _state["succeeded"].append(slug)
            _print_ok(f"{slug}: {result['count']} jobs")
        else:
            _state["failed"][slug] = result["error"]
            _print_fail(f"{slug}: {result['error']}")
        return json.dumps(result)

    elif tool_name == "scrape_lever":
        slug = args["company_slug"]
        result = scrape_lever(slug)
        if result["success"]:
            _state["succeeded"].append(slug)
            _print_ok(f"{slug}: {result['count']} jobs")
        else:
            _state["failed"][slug] = result["error"]
            _print_fail(f"{slug}: {result['error']}")
        return json.dumps(result)

    elif tool_name == "scrape_ashby":
        slug = args["company_slug"]
        result = scrape_ashby(slug)
        if result["success"]:
            _state["succeeded"].append(slug)
            _print_ok(f"{slug}: {result['count']} jobs")
        else:
            _state["failed"][slug] = result["error"]
            _print_fail(f"{slug}: {result['error']}")
        return json.dumps(result)

    elif tool_name == "scrape_workday":
        company = args["company_name"]
        url     = args["url"]
        result  = scrape_workday(company, url)
        if result["success"]:
            _state["succeeded"].append(company)
            _print_ok(f"{company} (Workday): {result['count']} jobs")
        else:
            _state["failed"][company] = result["error"]
            _print_fail(f"{company} (Workday): {result['error']}")
        return json.dumps(result)

    elif tool_name == "save_jobs":
        result = _save_jobs(args.get("jobs", []))
        _print_ok(f"Saved {result['saved']} new jobs (total: {result['total_so_far']})")
        return json.dumps(result)

    elif tool_name == "get_run_summary":
        result = _get_run_summary()
        return json.dumps(result)

    return json.dumps({"error": f"Unknown tool: {tool_name}"})


# ── Main agent loop ────────────────────────────────────────────────────────────

def run_discovery_agent() -> dict:
    """
    Starts the Gemini agent loop.
    Returns the final run summary dict.
    """
    _state["start_time"] = datetime.now()

    model = genai.GenerativeModel(
        model_name=GEMINI_MODEL,
        tools=TOOLS,
        system_instruction="""You are a job discovery agent. Your task is to scrape job listings
from company career pages and save them for later processing.

You have four scraper tools (greenhouse, lever, ashby, workday) and a save_jobs tool.

Rules:
1. For each company, call the right scraper tool first.
2. If the scrape SUCCEEDS, immediately call save_jobs with the returned jobs list.
3. If the scrape FAILS, retry ONCE. If it fails again, log it and move on.
4. Work through ALL companies systematically — do not stop early.
5. When ALL companies are done, call get_run_summary and give a final report.

Be efficient — you can process one company at a time in sequence.""",
    )

    # Build the initial message with the full company list
    workday_list = "\n".join(
        f"  - {c['name']}: {c['url']}" for c in COMPANIES["workday"]
    )
    user_message = f"""Please scrape job listings from all the following companies:

GREENHOUSE companies: {', '.join(COMPANIES['greenhouse'])}

LEVER companies: {', '.join(COMPANIES['lever'])}

ASHBY companies: {', '.join(COMPANIES['ashby'])}

WORKDAY companies (use scrape_workday with the exact URLs below):
{workday_list}

For each company: scrape → save. Retry once on failure. Cover all of them.
At the end, call get_run_summary and tell me what was found."""

    _print_header()
    print(f"{Fore.CYAN}Starting agent...{Style.RESET_ALL}\n")

    # Gemini multi-turn conversation
    chat = model.start_chat(history=[])
    response = chat.send_message(user_message)

    # Agentic loop — keep processing tool calls until Gemini is done
    max_iterations = 200   # safety cap — prevents infinite loops
    iteration = 0

    while iteration < max_iterations:
        iteration += 1

        # Check if Gemini wants to call tools
        tool_calls = _extract_tool_calls(response)

        if not tool_calls:
            # No tool calls = Gemini is done — print its final message
            final_text = _extract_text(response)
            if final_text:
                print(f"\n{Fore.WHITE}{final_text}{Style.RESET_ALL}")
            log.info("Agent finished — no more tool calls.")
            break

        # Execute all tool calls and collect results
        tool_results = []
        for call in tool_calls:
            result_str = _dispatch(call["name"], call["args"])
            tool_results.append({
                "function_response": {
                    "name":     call["name"],
                    "response": json.loads(result_str),
                }
            })

        # Send results back to Gemini to get the next set of tool calls
        response = chat.send_message(tool_results)
        time.sleep(0.3)   # respect free tier rate limits (15 RPM)

    if iteration >= max_iterations:
        print(f"{Fore.YELLOW}Warning: hit max iterations ({max_iterations}){Style.RESET_ALL}")

    summary = _get_run_summary()
    _print_summary(summary)
    log.info(f"Run complete: {json.dumps(summary)}")
    return summary


# ── Helpers ────────────────────────────────────────────────────────────────────

def _extract_tool_calls(response) -> list:
    """Pull function call requests out of a Gemini response."""
    calls = []
    try:
        for part in response.parts:
            if hasattr(part, "function_call") and part.function_call.name:
                fc = part.function_call
                calls.append({
                    "name": fc.name,
                    "args": dict(fc.args),
                })
    except Exception:
        pass
    return calls


def _extract_text(response) -> str:
    """Pull plain text out of a Gemini response."""
    try:
        for part in response.parts:
            if hasattr(part, "text") and part.text:
                return part.text
    except Exception:
        pass
    return ""


# ── Terminal output helpers ────────────────────────────────────────────────────

def _print_header():
    print(f"\n{Fore.CYAN}{'='*55}")
    print(f"  career-ops — Layer 1: Job Discovery Agent")
    print(f"{'='*55}{Style.RESET_ALL}\n")


def _print_tool_call(name: str, args: dict):
    short_args = {k: (v[:40] + "…" if isinstance(v, str) and len(v) > 40 else v)
                  for k, v in args.items() if k != "jobs"}
    print(f"  {Fore.BLUE}→ {name}{Style.RESET_ALL}({short_args})")


def _print_ok(msg: str):
    print(f"  {Fore.GREEN}✓ {msg}{Style.RESET_ALL}")


def _print_fail(msg: str):
    print(f"  {Fore.RED}✗ {msg}{Style.RESET_ALL}")


def _print_summary(s: dict):
    print(f"\n{Fore.CYAN}{'='*55}")
    print(f"  FINAL REPORT")
    print(f"{'='*55}{Style.RESET_ALL}")
    print(f"  Total jobs found    : {Fore.GREEN}{s['total_jobs']}{Style.RESET_ALL}")
    print(f"  Companies succeeded : {Fore.GREEN}{len(s['companies_succeeded'])}{Style.RESET_ALL}")
    print(f"  Companies failed    : {Fore.RED}{len(s['companies_failed'])}{Style.RESET_ALL}")
    if s["companies_failed"]:
        for company, err in s["companies_failed"].items():
            print(f"    {Fore.RED}✗ {company}: {err}{Style.RESET_ALL}")
    print(f"  Time taken          : {s['elapsed_seconds']}s")
    print(f"  Output saved to     : {Fore.CYAN}data/jobs.json{Style.RESET_ALL}\n")
