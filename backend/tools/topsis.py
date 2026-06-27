"""
tools/topsis.py — ranks matched jobs using TOPSIS (Technique for Order of
Preference by Similarity to Ideal Solution).

Each job is scored on 5 dimensions, then TOPSIS finds the job closest to the
ideal best and farthest from the ideal worst.

Dimensions & default weights:
    skill_score    0.30  — how many profile keywords appear in the job
    salary_score   0.30  — how well salary fits the user's range (INR)
    role_score     0.20  — job title alignment with preferred roles
    location_score 0.10  — location / remote preference match
    seniority_score 0.10 — experience years match

Special rule (location compensation):
    If location doesn't match but salary is significantly higher than the
    user's max (>= 1.5x), location_score is boosted to reflect the trade-off.

Usage:
    from tools.topsis import rank_jobs
    ranked = rank_jobs(matched_jobs, profile, weights)
"""

import re
import math
import logging
from typing import Any

log = logging.getLogger(__name__)

# ── Default weights (must sum to 1.0) ────────────────────────────────────────

DEFAULT_WEIGHTS = {
    "skill":    0.30,
    "salary":   0.30,
    "role":     0.20,
    "location": 0.10,
    "seniority":0.10,
}

# ── Location scoring constants ────────────────────────────────────────────────

# Job has no listed location (passed filter because user wants remote or unknown)
LOCATION_UNKNOWN_SCORE  = 0.25
# Job location clearly contradicts user's stated preferences
LOCATION_MISMATCH_SCORE = 0.05

_REMOTE_JOB_KEYWORDS = frozenset(("remote", "wfh", "work from home", "anywhere"))

_LOCATION_ALIASES: dict[str, list[str]] = {
    "bangalore":  ["bengaluru", "bangalore"],
    "bengaluru":  ["bengaluru", "bangalore"],
    "delhi":      ["delhi", "new delhi", "ncr", "gurugram", "gurgaon", "noida"],
    "ncr":        ["delhi", "new delhi", "ncr", "gurugram", "gurgaon", "noida"],
    "mumbai":     ["mumbai", "bombay"],
    "hyderabad":  ["hyderabad", "secunderabad"],
    "chennai":    ["chennai", "madras"],
}


def _is_remote_pref(p: str) -> bool:
    """True if a location preference string represents a desire to work remotely."""
    return p.startswith("remote") or p in ("wfh", "work from home", "anywhere")


# ── Individual dimension scorers (each returns 0.0 – 1.0) ────────────────────

def _score_skill(job: dict, profile: dict) -> float:
    """
    Fraction of profile search_keywords found in job title + description.
    Title hits count double.
    """
    keywords = [k.lower() for k in profile.get("search_keywords", [])]
    skills   = [s.lower() for s in profile.get("skills", [])[:20]]
    terms    = list(dict.fromkeys(keywords + skills))   # deduplicated, order preserved

    if not terms:
        return 0.5   # no basis to judge — neutral

    title = (job.get("title", "") or "").lower()
    desc  = (job.get("description", "") or "").lower()

    hits = sum(2 if t in title else (1 if t in desc else 0) for t in terms)
    max_possible = len(terms) * 2   # if every term hits in title
    return min(hits / max_possible, 1.0)


def _score_salary(job: dict, profile: dict) -> float:
    """
    How well the job salary fits the user's INR range.
    Returns 1.0 for perfect overlap, 0.5 for unknown, 0.0 for no overlap.
    Partial overlap scores proportionally.
    """
    job_low  = job.get("salary_inr_low")
    job_high = job.get("salary_inr_high")
    u_min    = profile.get("salary_min")
    u_max    = profile.get("salary_max")

    # No salary info anywhere — neutral
    if job_low is None or (u_min is None and u_max is None):
        return 0.5

    jl = job_low  or 0.0
    jh = job_high or jl
    ul = u_min    or 0.0
    uh = u_max    or jh * 2   # if only min set, treat max as 2× job high

    # No overlap
    if jh < ul or jl > uh:
        # How far outside? Penalise proportionally
        if jh < ul:
            gap = (ul - jh) / ul if ul > 0 else 1.0
        else:
            gap = (jl - uh) / uh if uh > 0 else 1.0
        return max(0.0, 0.5 - gap)

    # Overlap — score by how centred the job range is within user range
    overlap_low  = max(jl, ul)
    overlap_high = min(jh, uh)
    overlap      = overlap_high - overlap_low
    user_span    = max(uh - ul, 1.0)
    return 0.5 + 0.5 * min(overlap / user_span, 1.0)


def _score_role(job: dict, profile: dict) -> float:
    """
    1.0 if job title matches a preferred role, 0.0 otherwise.
    Uses same abbreviation expansion as job_filter.
    """
    _EXPAND = {
        "ml": "machine learning", "ai": "artificial intelligence",
        "nlp": "natural language processing", "cv": "computer vision",
        "sde": "software development", "swe": "software engineer",
        "de": "data engineer",  "ds": "data scientist", "pm": "product manager",
    }
    _STOP = {"engineer", "developer", "manager", "lead", "senior", "junior",
             "associate", "staff", "principal", "head", "director", "intern"}

    def _expand(text: str) -> str:
        for abbr, full in _EXPAND.items():
            text = re.sub(rf"\b{abbr}\b", full, text)
        return text

    preferred = profile.get("preferred_roles", [])
    if not preferred:
        return 0.5

    job_title = _expand((job.get("title", "") or "").lower())

    for role in preferred:
        r = _expand(role.lower().strip())
        role_words = [w for w in r.split() if len(w) > 3 and w not in _STOP]
        if not role_words:
            if r in job_title:
                return 1.0
        elif all(w in job_title for w in role_words):
            return 1.0

    return 0.0


def _score_location(job: dict, profile: dict) -> float:
    """
    Score how well the job's location fits the user's stated preferences.

    Returns:
        1.0   — exact city match or confirmed remote match
        0.25  — job has no listed location (LOCATION_UNKNOWN_SCORE)
        0.05  — clear location mismatch (LOCATION_MISMATCH_SCORE)
        0.5   — user has no location preference (neutral)

    Logic mirrors job_filter._location_matches so filter and scorer agree:
      - "open to relocation" → full score (user will go anywhere)
      - Remote prefs (startswith "remote", "wfh", "anywhere") → match only if
        job explicitly signals remote via _REMOTE_JOB_KEYWORDS
      - City prefs → checked with _LOCATION_ALIASES for spelling variants
      - No salary-based compensation — a high USD salary does not override
        a stated India location preference
    """
    prefs = [p.lower().strip() for p in profile.get("location_preferences", [])]
    if not prefs:
        return 0.5   # no preference — neutral

    job_loc  = (job.get("location", "") or "").lower()
    job_desc = (job.get("description", "") or "").lower()
    combined = f"{job_loc} {job_desc}"

    for pref in prefs:
        # "Open to relocation" — user accepts any location
        if pref == "open to relocation":
            return 1.0

        # Remote preference — require explicit remote signal in the job
        if _is_remote_pref(pref):
            if any(w in combined for w in _REMOTE_JOB_KEYWORDS):
                return 1.0
            if not job_loc.strip():
                return LOCATION_UNKNOWN_SCORE
            continue   # this job has no remote signal; try remaining prefs

        # City match with aliases
        city_variants = _LOCATION_ALIASES.get(pref, [pref])
        for variant in city_variants:
            if variant in job_loc:
                return 1.0

    # No preference matched
    if not job_loc.strip():
        return LOCATION_UNKNOWN_SCORE

    return LOCATION_MISMATCH_SCORE


def _score_seniority(job: dict, profile: dict) -> float:
    """
    Compare required years of experience (from job description) against
    the candidate's total_experience_years and per-skill experience_years.

    1.0  — candidate meets or exceeds requirement
    0.7  — candidate is within 1 year of requirement
    0.5  — job mentions no experience requirement (can't judge)
    0.3  — candidate is 1-2 years short but has strong project evidence
    0.0  — candidate is significantly underqualified
    """
    exp_years = profile.get("total_experience_years") or 0
    desc = (job.get("description", "") or "").lower()

    # Extract required years from patterns like "5+ years", "3-5 years experience"
    patterns = [
        r"(\d+)\+?\s*years?\s+(?:of\s+)?(?:experience|exp)",
        r"(\d+)\s*[-–]\s*\d+\s*years?\s+(?:of\s+)?(?:experience|exp)",
        r"minimum\s+(\d+)\s*years?",
        r"at\s+least\s+(\d+)\s*years?",
    ]
    required = None
    for pat in patterns:
        m = re.search(pat, desc)
        if m:
            required = int(m.group(1))
            break

    if required is None:
        return 0.5   # no requirement stated

    gap = required - exp_years

    if gap <= 0:
        return 1.0   # meets or exceeds
    elif gap <= 1:
        return 0.7   # close
    elif gap <= 2:
        # Check if project depth compensates — if candidate has 2+ substantial projects
        project_count = len(profile.get("projects", []))
        return 0.4 if project_count >= 2 else 0.2
    else:
        return 0.0   # too far under


# ── Build score matrix ────────────────────────────────────────────────────────

def _build_scores(jobs: list[dict], profile: dict) -> list[dict]:
    """Compute all 5 dimension scores for every job. Returns list of score dicts."""
    scored = []
    for job in jobs:
        scores = {
            "skill":     _score_skill(job, profile),
            "salary":    _score_salary(job, profile),
            "role":      _score_role(job, profile),
            "location":  _score_location(job, profile),
            "seniority": _score_seniority(job, profile),
        }
        scored.append(scores)
    return scored


# ── TOPSIS core ───────────────────────────────────────────────────────────────

def _topsis(score_matrix: list[dict], weights: dict[str, float]) -> list[float]:
    """
    Pure-Python TOPSIS implementation.

    Steps:
      1. Normalise each dimension (vector normalisation)
      2. Apply weights
      3. Find ideal best (max per dim) and ideal worst (min per dim)
      4. Compute Euclidean distance from each job to best and worst
      5. Score = dist_to_worst / (dist_to_best + dist_to_worst)
         → 1.0 = closest to ideal best, 0.0 = closest to ideal worst

    All dimensions are benefit criteria (higher = better).
    """
    dims = list(weights.keys())
    n    = len(score_matrix)

    if n == 0:
        return []
    if n == 1:
        # Can't compute relative distances with a single job.
        # Use the weighted sum of dimension scores as an absolute quality proxy
        # so that a wrong-location job does not auto-score 1.0.
        absolute = sum(score_matrix[0].get(dim, 0.0) * weights.get(dim, 0.0) for dim in dims)
        return [round(absolute, 4)]

    # Step 1: vector normalisation per dimension
    norm_matrix: list[dict] = [{} for _ in range(n)]
    for dim in dims:
        col    = [score_matrix[i][dim] for i in range(n)]
        denom  = math.sqrt(sum(v ** 2 for v in col)) or 1.0
        for i in range(n):
            norm_matrix[i][dim] = col[i] / denom

    # Step 2: apply weights
    weighted: list[dict] = [{} for _ in range(n)]
    for i in range(n):
        for dim in dims:
            weighted[i][dim] = norm_matrix[i][dim] * weights[dim]

    # Step 3: ideal best and worst
    ideal_best  = {dim: max(weighted[i][dim] for i in range(n)) for dim in dims}
    ideal_worst = {dim: min(weighted[i][dim] for i in range(n)) for dim in dims}

    # Step 4: distances
    def _dist(a: dict, b: dict) -> float:
        return math.sqrt(sum((a[dim] - b[dim]) ** 2 for dim in dims))

    topsis_scores = []
    for i in range(n):
        d_best  = _dist(weighted[i], ideal_best)
        d_worst = _dist(weighted[i], ideal_worst)
        denom   = d_best + d_worst
        score   = d_worst / denom if denom > 0 else 0.5
        topsis_scores.append(round(score, 4))

    return topsis_scores


# ── Public API ────────────────────────────────────────────────────────────────

def _normalise_weights(raw: dict[str, float]) -> dict[str, float]:
    """Ensure weights sum to 1.0, fill missing dims from defaults."""
    dims = DEFAULT_WEIGHTS.keys()
    w = {d: float(raw.get(d, DEFAULT_WEIGHTS[d])) for d in dims}
    total = sum(w.values())
    if total <= 0:
        return DEFAULT_WEIGHTS.copy()
    return {d: v / total for d, v in w.items()}


def rank_jobs(
    matched_jobs: list[dict],
    profile: dict,
    weights: dict[str, float] | None = None,
) -> list[dict]:
    """
    Score and rank a list of already-filtered jobs using TOPSIS.

    Args:
        matched_jobs: Output of filter_jobs() — jobs that passed all filters.
        profile:      User profile dict.
        weights:      Optional dict with keys: skill, salary, role, location, seniority.
                      Missing keys use defaults. Values are normalised to sum to 1.

    Returns:
        Same jobs sorted best-first, each with added fields:
            topsis_score     float 0–1 (higher = better fit)
            topsis_rank      int 1-based rank
            dimension_scores { skill, salary, role, location, seniority }  (each 0–1)
    """
    if not matched_jobs:
        return []

    w = _normalise_weights(weights or {})
    log.info("Ranking %d jobs with weights %s", len(matched_jobs), w)

    score_matrix  = _build_scores(matched_jobs, profile)
    topsis_scores = _topsis(score_matrix, w)

    # Attach scores to jobs
    results = []
    for job, dim_scores, t_score in zip(matched_jobs, score_matrix, topsis_scores):
        job = dict(job)   # shallow copy — don't mutate original
        job["topsis_score"]      = t_score
        job["dimension_scores"]  = {k: round(v, 3) for k, v in dim_scores.items()}
        results.append(job)

    # Sort descending by TOPSIS score
    results.sort(key=lambda j: j["topsis_score"], reverse=True)

    # Add rank
    for i, job in enumerate(results):
        job["topsis_rank"] = i + 1

    return results


# ── CLI test ───────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import json, sys

    if len(sys.argv) < 3:
        print("Usage: python -m tools.topsis <matched_jobs.json> <profile.json>")
        sys.exit(1)

    with open(sys.argv[1]) as f: jobs    = json.load(f)
    with open(sys.argv[2]) as f: profile = json.load(f)

    ranked = rank_jobs(jobs, profile)
    print(f"\nTop {min(10, len(ranked))} jobs:\n")
    for j in ranked[:10]:
        d = j["dimension_scores"]
        print(
            f"  #{j['topsis_rank']:2}  {j.get('company','?'):20}  "
            f"{j.get('title','?'):40}  "
            f"score={j['topsis_score']:.3f}  "
            f"[sk={d['skill']:.2f} sa={d['salary']:.2f} "
            f"ro={d['role']:.2f} lo={d['location']:.2f} se={d['seniority']:.2f}]"
        )
