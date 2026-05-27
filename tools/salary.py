"""
tools/salary.py — extracts and normalises salary figures from job descriptions.

Converts any currency (USD, GBP, EUR, SGD, AED, etc.) and any pay period
(hourly, monthly, annual) to INR per annum so all jobs can be compared on
the same scale against the user's INR salary expectation.

Exchange rates are approximate and hardcoded — update periodically.
No external API call needed.

Usage:
    from tools.salary import extract_salary_inr, salary_in_range

    low, high = extract_salary_inr("Salary: $120,000 - $150,000 per year")
    # → (10_029_600, 12_537_000)   (approx INR)

    ok = salary_in_range(low, high, profile_min=800000, profile_max=2000000)
"""

import re
import logging

log = logging.getLogger(__name__)

# ── Approximate exchange rates to INR (1 unit of foreign = X INR) ─────────────
# Update these periodically. Source: rough mid-market rates May 2026.
_FX: dict[str, float] = {
    "usd": 83.5,
    "$":   83.5,
    "gbp": 106.0,
    "£":   106.0,
    "eur": 90.0,
    "€":   90.0,
    "sgd": 62.0,
    "s$":  62.0,
    "aed": 22.7,
    "cad": 61.5,
    "aud": 54.5,
    "jpy": 0.55,
    "¥":   0.55,
    "inr": 1.0,
    "₹":   1.0,
    "rs":  1.0,
    "rs.": 1.0,
    "lpa": 100_000.0,   # "LPA" = lakhs per annum — treat 1 LPA = 1,00,000 INR
}

# ── Period multipliers → annual ────────────────────────────────────────────────
_PERIOD: dict[str, float] = {
    "hour":    2080.0,   # 40h/week × 52
    "hourly":  2080.0,
    "hr":      2080.0,
    "/hr":     2080.0,
    "day":     260.0,    # 5 days × 52
    "daily":   260.0,
    "week":    52.0,
    "weekly":  52.0,
    "month":   12.0,
    "monthly": 12.0,
    "mo":      12.0,
    "/mo":     12.0,
    "year":    1.0,
    "yearly":  1.0,
    "annual":  1.0,
    "annum":   1.0,
    "pa":      1.0,
    "p.a":     1.0,
    "lpa":     1.0,      # already annual
}

# Regex: optional currency symbol/code, number with optional k/l suffix, optional range
_SALARY_RE = re.compile(
    r"""
    (?P<currency>
        \$|£|€|₹|
        usd|gbp|eur|sgd|aed|cad|aud|jpy|inr|
        rs\.?|lpa
    )?
    \s*
    (?P<low>[\d,]+(?:\.\d+)?)\s*(?P<low_k>[klKL])?   # e.g. 120,000 or 12L or 12k
    (?:                                                 # optional range
        \s*[-–to]+\s*
        (?P<high>[\d,]+(?:\.\d+)?)\s*(?P<high_k>[klKL])?
    )?
    \s*
    (?P<currency2>
        \$|£|€|₹|
        usd|gbp|eur|sgd|aed|cad|aud|jpy|inr|
        rs\.?|lpa
    )?
    \s*
    (?:per\s*)?
    (?P<period>
        hour(?:ly)?|/hr|day(?:ly)?|week(?:ly)?|
        month(?:ly)?|/mo|year(?:ly)?|annual(?:ly)?|
        annum|p\.?a\.?|lpa
    )?
    """,
    re.IGNORECASE | re.VERBOSE,
)


def _parse_number(num_str: str, suffix: str | None) -> float:
    """Parse '120,000' or '12' with optional k/K/l/L suffix."""
    n = float(num_str.replace(",", ""))
    if suffix:
        s = suffix.lower()
        if s == "k":
            n *= 1_000
        elif s in ("l",):
            n *= 100_000   # lakh
    return n


def _to_inr_annual(amount: float, currency: str, period: str) -> float:
    """Convert amount in given currency/period to INR per annum."""
    fx = _FX.get(currency.lower().rstrip("."), 1.0)
    period_key = period.lower().rstrip(".")
    multiplier = _PERIOD.get(period_key, _PERIOD.get(period_key.lstrip("/"), 1.0))
    return amount * fx * multiplier


def _clean_html(text: str) -> str:
    """Strip HTML tags and decode common HTML entities for clean text matching."""
    import html
    text = html.unescape(text)                      # &amp; → &, &lt; → <, &#8377; → ₹
    text = re.sub(r"<[^>]+>", " ", text)            # remove all HTML tags
    text = re.sub(r"\s+", " ", text).strip()
    return text


# ── Hardcoded salary trigger patterns ─────────────────────────────────────────
# Matches any number followed directly by LPA, USD, RS, INR, GBP, EUR, CTC etc.
# This is the "dumb but reliable" pass — if a number has a currency/unit next to it, it's a salary.
_HARDCODED_PATTERNS = [
    # LPA: "12 LPA", "8-12 LPA", "12.5LPA"
    (re.compile(r"(\d{1,3}(?:\.\d+)?)\s*[-–to]+\s*(\d{1,3}(?:\.\d+)?)\s*lpa", re.I), "lpa_range"),
    (re.compile(r"(\d{1,3}(?:\.\d+)?)\s*lpa", re.I), "lpa_single"),
    # USD: "$120,000", "$120k", "USD 120,000", "120,000 USD"
    (re.compile(r"\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*[kK]?\s*[-–to]*\s*\$?\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?)?[kK]?", re.I), "usd"),
    (re.compile(r"(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*[kK]?\s*[-–to]*\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?)?[kK]?\s*usd", re.I), "usd"),
    # INR/RS: "₹8,00,000", "Rs 12 LPA", "INR 15,00,000"
    (re.compile(r"(?:₹|rs\.?|inr)\s*(\d{1,3}(?:[,\d]*\d)?(?:\.\d+)?)\s*[-–to]*\s*(?:₹|rs\.?|inr)?\s*(\d{1,3}(?:[,\d]*\d)?(?:\.\d+)?)?", re.I), "inr"),
    # GBP: "£60,000", "GBP 60000"
    (re.compile(r"(?:£|gbp)\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?)[kK]?\s*[-–to]*\s*(?:£|gbp)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?)?[kK]?", re.I), "gbp"),
    # EUR: "€80,000", "EUR 80000"
    (re.compile(r"(?:€|eur)\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?)[kK]?\s*[-–to]*\s*(?:€|eur)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?)?[kK]?", re.I), "eur"),
    # CTC: "CTC: 12-18 LPA", "CTC upto 20 LPA"
    (re.compile(r"ctc[:\s]*(?:upto|up to|of)?\s*(\d{1,3}(?:\.\d+)?)\s*[-–to]*\s*(\d{1,3}(?:\.\d+)?)?\s*lpa", re.I), "lpa_range"),
]

def _parse_hardcoded(text: str) -> tuple[float | None, float | None]:
    """
    Dumb but reliable: scan for numbers directly attached to known salary keywords.
    Returns (low_inr, high_inr) or (None, None).
    """
    for pattern, kind in _HARDCODED_PATTERNS:
        m = pattern.search(text)
        if not m:
            continue
        try:
            g = m.groups()
            raw1 = g[0].replace(",", "") if g[0] else None
            raw2 = g[1].replace(",", "") if len(g) > 1 and g[1] else None
            if not raw1:
                continue
            n1 = float(raw1)
            n2 = float(raw2) if raw2 else n1

            # Apply k suffix if present in original match
            span = m.group(0)
            if re.search(r"\d[kK]", span):
                if n1 < 1000: n1 *= 1000
                if n2 < 1000: n2 *= 1000

            low, high = min(n1, n2), max(n1, n2)

            if kind in ("lpa_range", "lpa_single"):
                return low * 100_000, high * 100_000
            elif kind == "usd":
                return low * _FX["usd"], high * _FX["usd"]
            elif kind == "inr":
                # Already INR — sanity check it looks like annual salary
                if low < 10_000:   # probably in lakhs
                    return low * 100_000, high * 100_000
                return low, high
            elif kind == "gbp":
                return low * _FX["gbp"], high * _FX["gbp"]
            elif kind == "eur":
                return low * _FX["eur"], high * _FX["eur"]
        except Exception:
            continue
    return None, None


def extract_salary_inr(text: str) -> tuple[float | None, float | None]:
    """
    Scan job description text for salary mentions and return (low, high) in INR annual.
    Returns (None, None) if no salary found.
    If only one figure found, returns (figure, figure).
    """
    if not text:
        return None, None

    # Strip HTML tags and decode entities first — descriptions come as raw HTML
    text = _clean_html(text)

    # Pass 0: hardcoded patterns — number directly attached to LPA/USD/RS/GBP/EUR
    low, high = _parse_hardcoded(text)
    if low is not None:
        return low, high

    best_low: float | None = None
    best_high: float | None = None

    # ── Pass 1: standalone "12 LPA" / "8-12 LPA" / "$45/hr" patterns ────────────
    _STANDALONE = re.compile(
        r"""
        (?:
            # "12 LPA" or "8-12 LPA"
            (?P<lpa_low>\d{1,3}(?:\.\d+)?)\s*[-–]?\s*(?P<lpa_high>\d{1,3}(?:\.\d+)?)?\s*LPA
            |
            # "$45/hr" or "₹500/hr"
            (?P<hr_ccy>[$£€₹]|USD|INR|GBP|EUR)\s*(?P<hr_num>\d+(?:\.\d+)?)\s*/\s*h(?:r|our)
        )
        """,
        re.IGNORECASE | re.VERBOSE,
    )

    for m in _STANDALONE.finditer(text):
        if m.group("lpa_low"):
            n1 = float(m.group("lpa_low")) * 100_000
            n2 = float(m.group("lpa_high")) * 100_000 if m.group("lpa_high") else n1
            best_low, best_high = min(n1, n2), max(n1, n2)
            return best_low, best_high
        elif m.group("hr_num"):
            ccy = _FX.get(m.group("hr_ccy").lower(), _FX.get("usd"))
            annual = float(m.group("hr_num")) * ccy * 2080
            best_low = best_high = annual
            return best_low, best_high

    # ── Pass 2: general currency-prefixed patterns ────────────────────────────
    for m in _SALARY_RE.finditer(text):
        try:
            low_str  = m.group("low")
            high_str = m.group("high")

            if not low_str or not low_str.strip():
                continue

            cleaned = low_str.replace(",", "").strip()
            if not cleaned or not cleaned.replace(".", "").isdigit():
                continue

            low_raw = float(cleaned)
            if low_raw < 100 and not m.group("low_k"):
                continue

            currency = (m.group("currency") or m.group("currency2") or "usd").strip()
            period   = (m.group("period") or "year").strip()

            context = text[max(0, m.start()-5): m.end()+5].lower()
            if "lpa" in context:
                low_inr  = _parse_number(low_str, m.group("low_k")) * 100_000
                high_inr = _parse_number(high_str, m.group("high_k")) * 100_000 if high_str else low_inr
            else:
                low_inr  = _to_inr_annual(_parse_number(low_str, m.group("low_k")), currency, period)
                high_inr = _to_inr_annual(_parse_number(high_str, m.group("high_k")), currency, period) if high_str else low_inr

            if low_inr > 50_000:
                best_low  = low_inr
                best_high = high_inr
                break
        except Exception:
            continue

    return best_low, best_high


def salary_in_range(
    job_low:      float | None,
    job_high:     float | None,
    profile_min:  float | None,
    profile_max:  float | None,
    tolerance:    float = 0.20,
) -> tuple[bool, str]:
    """
    Check whether a job's salary range overlaps with the user's expectation.

    Overlap logic (generous — partial overlap is acceptable):
      job_high >= profile_min * (1 - tolerance)
      AND job_low <= profile_max * (1 + tolerance)

    Args:
        job_low/high:    Job salary in INR annual (from extract_salary_inr).
        profile_min/max: User's expectation in INR annual (from profile.json).
        tolerance:       Allow 20% slack either side by default.

    Returns:
        (passes: bool, reason: str)
    """
    # If job has no salary info, don't filter it out — pass with a note
    if job_low is None:
        return True, "no salary info in job posting"

    # If user has no preference, don't filter
    if profile_min is None and profile_max is None:
        return True, "no salary preference set"

    p_min = profile_min or 0
    p_max = profile_max or float("inf")

    lower_bound = p_min * (1 - tolerance)
    upper_bound = p_max * (1 + tolerance)

    overlaps = job_high >= lower_bound and job_low <= upper_bound

    if overlaps:
        reason = (
            f"job ₹{job_low/100_000:.1f}L–{job_high/100_000:.1f}L "
            f"overlaps with your ₹{p_min/100_000:.1f}L–{p_max/100_000:.1f}L"
        )
    else:
        reason = (
            f"job ₹{job_low/100_000:.1f}L–{job_high/100_000:.1f}L "
            f"outside your ₹{p_min/100_000:.1f}L–{p_max/100_000:.1f}L"
        )

    return overlaps, reason


# ── CLI test ───────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    samples = [
        "Compensation: $120,000 - $150,000 per year",
        "Salary: £60,000 - £80,000 annually",
        "Pay: ₹18L - ₹25L per annum",
        "Stipend: $45/hr",
        "CTC: 12-18 LPA",
        "Monthly salary: SGD 5,000 - 8,000",
        "We offer competitive compensation",   # no salary
    ]
    for s in samples:
        low, high = extract_salary_inr(s)
        if low:
            print(f"{s[:50]:50}  →  ₹{low/100_000:.1f}L – ₹{high/100_000:.1f}L")
        else:
            print(f"{s[:50]:50}  →  not found")