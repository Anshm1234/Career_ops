"""
tools/job_filter.py — filters a list of scraped jobs against a user profile.

Runs entirely in Python — no LLM call.
Checks job title + description against profile keywords, skills, and roles.

Usage:
    from tools.job_filter import filter_jobs
    matched = filter_jobs(raw_jobs, profile)
"""

import re
import json
import logging
from pathlib import Path

from tools.salary import extract_salary_inr, salary_in_range

log = logging.getLogger(__name__)

# Keywords that indicate a job is genuinely remote-eligible
_REMOTE_JOB_KEYWORDS = frozenset(("remote", "wfh", "work from home", "anywhere"))


def _is_remote_pref(p: str) -> bool:
    """True if a location preference string represents a desire to work remotely."""
    return p.startswith("remote") or p in ("wfh", "work from home", "anywhere")


def _tokenise(text: str) -> str:
    """Lowercase and collapse whitespace for consistent matching."""
    return re.sub(r"\s+", " ", text.lower().strip())


def _build_terms(profile: dict) -> list[str]:
    """
    Derive a flat list of match terms from the profile.
    Sources: search_keywords → preferred_roles → skills (top 20).
    All lowercased, duplicates removed, blanks dropped.
    """
    raw = []
    raw.extend(profile.get("search_keywords", []))
    raw.extend(profile.get("preferred_roles", []))
    raw.extend(profile.get("skills", [])[:8])   # top 8 skills only — avoids generic-term noise

    seen = set()
    terms = []
    for t in raw:
        t = t.lower().strip()
        if t and t not in seen and len(t) > 1:
            seen.add(t)
            terms.append(t)
    return terms


def _term_in_text(term: str, text: str) -> bool:
    """
    Check if a term appears in text.
    Short terms (<=2 chars) require whole-word match to avoid 'r' matching 'r' in every word.
    Longer terms use simple substring match.
    """
    if len(term) <= 2:
        return bool(re.search(rf"\b{re.escape(term)}\b", text))
    return term in text


def _job_matches(job: dict, terms: list[str], min_matches: int) -> tuple[bool, list[str]]:
    """
    Return (matched, hits) where hits is the list of terms found in the job.
    Searches title (weighted — a title hit counts as 2) + description.
    """
    title = _tokenise(job.get("title", ""))
    desc  = _tokenise(job.get("description", ""))

    hits = []
    score = 0
    for term in terms:
        in_title = _term_in_text(term, title)
        in_desc  = _term_in_text(term, desc)
        if in_title:
            hits.append(term)
            score += 2          # title match is stronger signal
        elif in_desc:
            hits.append(term)
            score += 1

    return score >= min_matches, hits


def _location_matches(job: dict, location_prefs: list[str]) -> tuple[bool, str]:
    """
    Check if job location matches any of the user's preferred locations.
    Returns (ok, note). If user has no location prefs, always passes.

    Remote handling:
      - Prefs like "Remote (India)", "Remote (Worldwide)", "wfh", "anywhere"
        are treated as remote preferences.
      - Remote prefs match jobs that explicitly signal remote work via keywords
        ("remote", "wfh", "work from home", "anywhere") in location or description.
      - "hybrid" is NOT treated as remote — a hybrid SF job is not remote-eligible
        for an India-based user.
      - "Open to relocation" bypasses the location filter entirely.

    No-location escape hatch:
      - Jobs with no location listed pass ONLY if the user has at least one
        remote preference. Otherwise they are excluded.
    """
    if not location_prefs:
        return True, "no location preference set"

    job_location = _tokenise(job.get("location", ""))
    job_desc     = _tokenise(job.get("description", ""))
    combined     = f"{job_location} {job_desc}"

    _ALIASES: dict[str, list[str]] = {
        "bangalore":  ["bengaluru", "bangalore"],
        "bengaluru":  ["bengaluru", "bangalore"],
        "delhi":      ["delhi", "new delhi", "ncr", "gurugram", "gurgaon", "noida"],
        "ncr":        ["delhi", "new delhi", "ncr", "gurugram", "gurgaon", "noida"],
        "mumbai":     ["mumbai", "bombay"],
        "hyderabad":  ["hyderabad", "secunderabad"],
        "chennai":    ["chennai", "madras"],
    }

    user_wants_remote = any(_is_remote_pref(p.lower().strip()) for p in location_prefs)

    for pref in location_prefs:
        p = pref.lower().strip()

        # "Open to relocation" — user will work anywhere; skip location filter
        if p == "open to relocation":
            return True, "user is open to relocation"

        # Remote preference — only match jobs that explicitly say remote/wfh
        if _is_remote_pref(p):
            if any(w in combined for w in _REMOTE_JOB_KEYWORDS):
                return True, "remote job matches preference"
            if not job_location.strip():
                return True, "no location listed — assumed remote-friendly"
            continue   # no remote signal in this job; try remaining prefs

        # City match (with aliases)
        city_variants = _ALIASES.get(p, [p])
        for variant in city_variants:
            if variant in job_location:
                return True, f"location '{job_location}' matches '{pref}'"

    # No preference matched.
    # Jobs with no location: pass only when user has a remote preference.
    if not job_location.strip():
        if user_wants_remote:
            return True, "no location listed — assumed remote-friendly"
        return False, "no location in job — excluded (user has no remote preference)"

    return False, f"location '{job.get('location', '')}' not in preferences {location_prefs}"


def _role_matches(job: dict, preferred_roles: list[str]) -> tuple[bool, str]:
    """
    Check if job title matches any of the user's preferred roles.
    Uses partial matching — 'engineer' matches 'Software Engineer', etc.
    Returns (ok, note).
    If user has no role prefs, always passes.
    """
    if not preferred_roles:
        return True, "no role preference set"

    job_title = _tokenise(job.get("title", ""))

    # Expand common abbreviations before matching
    _EXPAND = {"ml": "machine learning", "ai": "artificial intelligence",
               "nlp": "natural language processing", "cv": "computer vision",
               "sde": "software development", "swe": "software engineer",
               "de": "data engineer", "ds": "data scientist", "pm": "product manager"}

    def _expand(text: str) -> str:
        for abbr, full in _EXPAND.items():
            text = re.sub(rf"\b{abbr}\b", full, text)
        return text

    _STOP = {"engineer", "developer", "manager", "lead", "senior", "junior",
             "associate", "staff", "principal", "head", "director", "intern"}

    job_title_expanded = _expand(job_title)

    for role in preferred_roles:
        # Split on "/" to handle "Machine Learning / AI Engineer" — check each side separately
        role_parts = [p.strip() for p in role.split("/")]
        for part in role_parts:
            r = _expand(part.lower().strip())
            role_words = [w for w in r.split() if len(w) > 3 and w not in _STOP]
            if not role_words:
                if r in job_title_expanded:
                    return True, f"title '{job.get('title', '')}' matches role '{role}'"
            elif all(word in job_title_expanded for word in role_words):
                return True, f"title '{job.get('title', '')}' matches role '{role}'"

    return False, f"title '{job.get('title', '')}' not in preferred roles {preferred_roles}"



def filter_jobs(
    jobs: list[dict],
    profile: dict,
    min_matches: int = 2,
) -> list[dict]:
    """
    Filter a list of scraped job dicts against a user profile.

    Args:
        jobs:        Raw list of job dicts from any scraper.
        profile:     Parsed profile dict (from resume_parser).
        min_matches: Minimum keyword match score to keep a job.
                     Score = 2 per title hit + 1 per description hit.
                     Default 2 means: 1 title match OR 2 description matches.

    Returns:
        Filtered list of job dicts, each with an extra "matched_keywords" field.
    """
    terms          = _build_terms(profile)
    location_prefs = [l.lower().strip() for l in profile.get("location_preferences", [])]
    preferred_roles = profile.get("preferred_roles", [])

    if not terms:
        log.warning("Profile has no keywords/skills — returning all jobs unfiltered.")
        return jobs

    log.info("Filtering %d jobs against %d terms, %d locations, %d roles",
             len(jobs), len(terms), len(location_prefs), len(preferred_roles))

    matched = []
    for job in jobs:
        # ── 1. Keyword match ──────────────────────────────────────────────────
        ok, hits = _job_matches(job, terms, min_matches)
        if not ok:
            continue

        # ── 2. Role match ─────────────────────────────────────────────────────
        role_ok, role_reason = _role_matches(job, preferred_roles)
        if not role_ok:
            log.debug("Skipping %s @ %s — %s", job.get("title"), job.get("company"), role_reason)
            continue

        # ── 3. Location match ─────────────────────────────────────────────────
        loc_ok, loc_reason = _location_matches(job, location_prefs)
        if not loc_ok:
            log.debug("Skipping %s @ %s — %s", job.get("title"), job.get("company"), loc_reason)
            continue

        # ── 4. Salary match ───────────────────────────────────────────────────
        job_low, job_high = extract_salary_inr(job.get("description", ""))
        salary_ok, salary_reason = salary_in_range(
            job_low, job_high,
            profile.get("salary_min"),
            profile.get("salary_max"),
        )
        if not salary_ok:
            log.debug("Skipping %s @ %s — %s", job.get("title"), job.get("company"), salary_reason)
            continue

        job["matched_keywords"] = hits
        job["salary_inr_low"]   = job_low
        job["salary_inr_high"]  = job_high
        job["salary_note"]      = salary_reason
        job["location_note"]    = loc_reason
        job["role_note"]        = role_reason
        matched.append(job)

    log.info("Filter result: %d / %d jobs kept", len(matched), len(jobs))
    print(f"  → Filtered {len(jobs)} jobs → {len(matched)} matched (terms: {len(terms)})")
    return matched


def filter_jobs_from_file(
    jobs_file: str,
    profile_file: str,
    output_file: str | None = None,
    min_matches: int = 2,
) -> list[dict]:
    """
    Convenience wrapper: read jobs + profile from disk, filter, optionally save.

    Args:
        jobs_file:    Path to jobs.json (output of orchestrator).
        profile_file: Path to a user's profile.json.
        output_file:  If given, write filtered jobs to this path.
        min_matches:  Passed through to filter_jobs().
    """
    with open(jobs_file, encoding="utf-8") as f:
        jobs = json.load(f)

    with open(profile_file, encoding="utf-8") as f:
        profile = json.load(f)

    filtered = filter_jobs(jobs, profile, min_matches=min_matches)

    if output_file:
        Path(output_file).parent.mkdir(parents=True, exist_ok=True)
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(filtered, f, indent=2, ensure_ascii=False)
        print(f"  ✓ Saved {len(filtered)} filtered jobs to {output_file}")

    return filtered


# ── CLI helper ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 3:
        print("Usage: python -m tools.job_filter <jobs.json> <profile.json> [output.json]")
        sys.exit(1)

    logging.basicConfig(level=logging.INFO)
    jobs_f    = sys.argv[1]
    profile_f = sys.argv[2]
    out_f     = sys.argv[3] if len(sys.argv) > 3 else None

    results = filter_jobs_from_file(jobs_f, profile_f, output_file=out_f)
    print(f"\nKept {len(results)} jobs.")
    for j in results[:5]:
        print(f"  {j['company']:20}  {j['title']:50}  hits: {j['matched_keywords']}")
