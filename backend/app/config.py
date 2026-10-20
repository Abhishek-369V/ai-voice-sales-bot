import os
from pathlib import Path
from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[1]
ENV_FILE = BACKEND_DIR / ".env"

# Load variables from this exact file.
load_dotenv(dotenv_path=ENV_FILE, override=False)

class Settings:
    gemini_api_key = (os.getenv("GEMINI_API_KEY") or "").strip()
    gemini_model = (os.getenv("GEMINI_MODEL") or "gemini-2.5-flash").strip()
    frontend_origin = (os.getenv("FRONTEND_ORIGIN") or "http://localhost:5173").strip()

settings = Settings()