"""
config.py — loads .env and exposes typed config values.
Import this everywhere instead of calling os.getenv() directly.
"""
import os
from dotenv import load_dotenv

# Load .env file from project root (works regardless of where you run from)
load_dotenv()


def _require(key: str) -> str:
    """Get an env var or raise a clear error if missing."""
    val = os.getenv(key)
    if not val:
        raise EnvironmentError(
            f"\n\n  Missing environment variable: {key}\n"
            f"  → Copy .env.example to .env and fill in your values.\n"
        )
    return val


# ── LLM ───────────────────────────────────────────────────────────────────────
GEMINI_API_KEY: str = _require("GEMINI_API_KEY")
GEMINI_MODEL:   str = _require("GEMINI_MODEL")

# ── Scraping behaviour ─────────────────────────────────────────────────────────
REQUEST_TIMEOUT:    int   = int(os.getenv("REQUEST_TIMEOUT", "12"))
RETRY_ATTEMPTS:     int   = int(os.getenv("RETRY_ATTEMPTS",  "2"))
DELAY_BETWEEN_REQS: float = float(os.getenv("DELAY_BETWEEN_REQS", "0.5"))

# ── Paths ─────────────────────────────────────────────────────────────────────
ROOT_DIR  = os.path.dirname(os.path.abspath(__file__))
DATA_DIR  = os.path.join(ROOT_DIR, "data")
LOGS_DIR  = os.path.join(ROOT_DIR, "logs")
JOBS_FILE    = os.path.join(DATA_DIR, "jobs.json")
UPLOADS_DIR  = os.path.join(ROOT_DIR, "uploads")

# Make sure directories exist
os.makedirs(DATA_DIR,    exist_ok=True)
os.makedirs(LOGS_DIR,    exist_ok=True)
os.makedirs(UPLOADS_DIR, exist_ok=True)


def profile_path(user_id: str) -> str:
    """Return the profile.json path for a given user."""
    user_dir = os.path.join(DATA_DIR, "users", user_id)
    os.makedirs(user_dir, exist_ok=True)
    return os.path.join(user_dir, "profile.json")
