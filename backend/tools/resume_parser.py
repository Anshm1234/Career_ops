"""
tools/resume_parser.py — parses an uploaded resume (PDF or DOCX) and
produces a structured profile.json using a single Gemini call.

Usage:
    from tools.resume_parser import parse_resume
    profile = parse_resume("path/to/resume.pdf")   # or .docx
    # profile is a dict — also written to data/profile.json
"""

import copy
import json
import logging
from pathlib import Path

import google.generativeai as genai

from config import GEMINI_API_KEY, GEMINI_MODEL, profile_path

log = logging.getLogger(__name__)
genai.configure(api_key=GEMINI_API_KEY)

# ── Default profile template (null = not found in resume) ────────────────────

DEFAULT_PROFILE: dict = {
    "name": None,
    "email": None,
    "phone": None,
    "location": None,

    # Skills — plain list of strings
    "skills": [],

    # Experience in years per technology/domain, e.g. {"python": 3, "aws": 2}
    "experience_years": {},

    # Highest degree + field, e.g. "B.Tech Computer Science"
    "education": None,

    # List of certification names
    "certifications": [],

    # Short descriptions of notable projects (used to judge depth vs. job reqs)
    "projects": [],

    # Job titles the candidate is targeting, e.g. ["backend engineer", "ML engineer"]
    "preferred_roles": [],

    # Candidate's expected salary range in USD/year (null if not on resume)
    "salary_min": None,
    "salary_max": None,

    # Location preferences, e.g. ["remote", "San Francisco", "Bangalore"]
    "location_preferences": [],

    # Total years of professional experience (inferred)
    "total_experience_years": None,

    # Top keywords to use when querying job APIs (auto-derived from skills + roles)
    "search_keywords": [],
}


# ── Text extraction ────────────────────────────────────────────────────────────

def _extract_text_pdf(path: str) -> str:
    """Extract text from a PDF resume using pdfplumber."""
    try:
        import pdfplumber
    except ImportError:
        raise RuntimeError("pdfplumber not installed. Run: pip install pdfplumber")

    text_parts = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text(x_tolerance=2, y_tolerance=3)
            if page_text:
                text_parts.append(page_text)

    full_text = "\n".join(text_parts)
    if not full_text.strip():
        raise ValueError(
            f"No text extracted from {path}. "
            "The PDF may be scanned/image-based. "
            "Please provide a text-based PDF or convert to DOCX."
        )
    return full_text


def _extract_text_docx(path: str) -> str:
    """Extract text from a DOCX resume using python-docx."""
    try:
        from docx import Document
    except ImportError:
        raise RuntimeError("python-docx not installed. Run: pip install python-docx")

    doc = Document(path)
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]

    # Also pull text from tables (some resumes use tables for layout)
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                cell_text = cell.text.strip()
                if cell_text and cell_text not in paragraphs:
                    paragraphs.append(cell_text)

    return "\n".join(paragraphs)


def extract_text(path: str) -> str:
    """
    Dispatch to the right extractor based on file extension.
    Returns raw resume text.
    """
    suffix = Path(path).suffix.lower()
    if suffix == ".pdf":
        return _extract_text_pdf(path)
    elif suffix in (".docx", ".doc"):
        return _extract_text_docx(path)
    elif suffix in (".txt", ".md"):
        return Path(path).read_text(encoding="utf-8")
    else:
        raise ValueError(f"Unsupported resume format: {suffix}. Use PDF or DOCX.")


# ── Gemini extraction ─────────────────────────────────────────────────────────

_SYSTEM_PROMPT = """\
You are a resume parser. Extract structured information from the resume text below.
Return ONLY a valid JSON object — no markdown, no backticks, no explanation.

The JSON must use exactly these keys (use null for missing values, [] for empty lists):

{
  "name": string or null,
  "email": string or null,
  "phone": string or null,
  "location": string or null,
  "skills": [list of skill strings],
  "experience_years": {technology_or_domain: years_as_number},
  "education": string or null,
  "certifications": [list of certification name strings],
  "projects": [
    {
      "name": string,
      "description": string (1-2 sentences summarising what was built and tech used),
      "technologies": [list of tech strings]
    }
  ],
  "preferred_roles": [list of job title strings the candidate is targeting],
  "salary_min": number or null,
  "salary_max": number or null,
  "location_preferences": [list of location preference strings],
  "total_experience_years": number or null,
  "search_keywords": [top 8-12 keywords for job search APIs, derived from skills + roles]
}

Rules:
- For experience_years, infer years per technology from job dates + project mentions.
  If someone worked 2018-2021 as a Python developer, that's 3 years of Python.
- For projects, include only substantial ones (not trivial examples).
- search_keywords must be specific and job-searchable: "python", "machine learning",
  "backend engineer" — not generic words like "software" or "developer".
- Salary values should be annual USD. If the resume mentions a different currency,
  convert approximately. If no salary is mentioned, use null.
- Do not use double quotes inside string values — use single quotes or rephrase instead.
  e.g. write Grad-CAM not "Grad-CAM", write CNN not "CNN".
- For skills: include skills explicitly mentioned AND obvious ones clearly demonstrated
  by projects or job responsibilities (e.g. if they built REST APIs, include REST API).
"""

_USER_TEMPLATE = """\
Resume text:
---
{resume_text}
---

Return the JSON profile now.
"""


def _repair_json(raw: str) -> dict:
    """
    Attempt to fix common Gemini JSON issues before giving up.
    Tries json-repair library first, then truncates at last valid closing brace.
    """
    # Try json-repair if available
    try:
        from json_repair import repair_json
        repaired = repair_json(raw)
        return json.loads(repaired)
    except Exception:
        pass

    # Fallback: truncate at last } and re-parse
    last_brace = raw.rfind("}")
    if last_brace != -1:
        truncated = raw[:last_brace + 1]
        try:
            return json.loads(truncated)
        except json.JSONDecodeError:
            pass

    raise ValueError("Could not repair JSON")


def _call_gemini(resume_text: str) -> dict:
    """Send resume text to Gemini, get back a parsed profile dict."""
    model = genai.GenerativeModel(
        model_name=GEMINI_MODEL,
        system_instruction=_SYSTEM_PROMPT,
        generation_config={"response_mime_type": "application/json"},
    )

    # Truncate resume text if extremely long (>8000 chars) to stay within token limits
    truncated = resume_text[:8000]
    if len(resume_text) > 8000:
        log.warning("Resume text truncated from %d to 8000 chars for Gemini.", len(resume_text))

    response = model.generate_content(_USER_TEMPLATE.format(resume_text=truncated))
    raw = response.text.strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        log.warning("Gemini JSON malformed (%s) — attempting repair...", e)
        try:
            return _repair_json(raw)
        except ValueError:
            log.error("Could not repair Gemini JSON:\n%s", raw)
            raise ValueError(f"Gemini did not return valid JSON: {e}\nRaw output:\n{raw[:500]}")


# ── Merge with default template ───────────────────────────────────────────────

def _merge_with_defaults(gemini_profile: dict) -> dict:
    """
    Start from DEFAULT_PROFILE so all keys are always present,
    then overwrite with whatever Gemini actually found.
    Lists and dicts are replaced, not merged.
    """
    profile = copy.deepcopy(DEFAULT_PROFILE)
    for key, value in gemini_profile.items():
        if key in profile:
            # Only overwrite if the value is not None (empty lists/dicts are valid)
            if value is not None:
                profile[key] = value
    return profile


# ── Public API ─────────────────────────────────────────────────────────────────

def parse_resume(resume_path: str, user_id: str) -> dict:
    """
    Parse a resume file and return a structured profile dict.

    Steps:
      1. Extract plain text from PDF or DOCX.
      2. Send to Gemini with a tight JSON-only prompt.
      3. Merge result with the default template (ensures all keys exist).
      4. Save to data/profile.json.

    Args:
        resume_path: Path to the resume file (PDF, DOCX, or TXT).

    Returns:
        Profile dict with all DEFAULT_PROFILE keys guaranteed to exist.
    """
    resume_path = str(resume_path)
    log.info("Parsing resume: %s", resume_path)
    print(f"  → Extracting text from {Path(resume_path).name}...")

    # Step 1: Extract text
    raw_text = extract_text(resume_path)
    char_count = len(raw_text)
    print(f"  → Extracted {char_count:,} characters of text.")

    if char_count < 100:
        raise ValueError(
            "Extracted text is too short to be a valid resume. "
            "Check that the file is not blank or image-only."
        )

    # Step 2: Gemini parse
    print("  → Sending to Gemini for structured extraction (1 API call)...")
    gemini_profile = _call_gemini(raw_text)

    # Step 3: Merge with defaults
    profile = _merge_with_defaults(gemini_profile)

    # Step 4: Save
    out_path = profile_path(user_id)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(profile, f, indent=2, ensure_ascii=False)

    name_str = profile.get("name") or "Unknown"
    skills_count = len(profile.get("skills", []))
    keywords_count = len(profile.get("search_keywords", []))
    print(f"  ✓ Profile built for: {name_str}")
    print(f"    Skills found    : {skills_count}")
    print(f"    Search keywords : {keywords_count}")
    print(f"    Saved to        : {out_path}")

    log.info("Profile saved: %s", out_path)
    return profile


# ── CLI helper (run directly to test) ─────────────────────────────────────────

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 3:
        print("Usage: python -m tools.resume_parser path/to/resume.pdf <user_id>")
        sys.exit(1)

    import logging
    logging.basicConfig(level=logging.INFO)

    result = parse_resume(sys.argv[1], user_id=sys.argv[2])
    print("\nExtracted profile:")
    print(json.dumps(result, indent=2))
