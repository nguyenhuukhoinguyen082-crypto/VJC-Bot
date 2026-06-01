import os
import json
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# ── Branding Configuration ───────────────────────────────────────────────
CONFIG_DIR = Path(__file__).resolve().parent.parent.parent / "config"
BRANDING_FILE = CONFIG_DIR / "branding.json"

def load_branding():
    if BRANDING_FILE.exists():
        try:
            with open(BRANDING_FILE, "r") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

BRANDING = load_branding()

BOT_TOKEN = os.getenv("DISCORD_BOT_TOKEN")
GUILD_ID = int(os.getenv("DISCORD_GUILD_ID", 0)) if os.getenv("DISCORD_GUILD_ID") else None

# Backend API configuration
BACKEND_API_URL = os.getenv("BACKEND_API_URL", "http://localhost:8000")
API_KEY = os.getenv("API_KEY", "")

# Comma-separated Discord role IDs for staff commands
_default_staff_roles = ",".join(map(str, BRANDING.get("bot", {}).get("staffRoles", [1503009616378724472, 1503009679662649485, 1503021381842108547, 1507391390059855882])))
_raw_role_ids = os.getenv("ELEVATED_ROLE_IDS", _default_staff_roles)
ELEVATED_ROLE_IDS: set[int] = {
    int(role_id.strip()) for role_id in _raw_role_ids.split(",") if role_id.strip()
}

# Discord user to alert on backend health issues
ALERT_USER_ID = int(os.getenv("ALERT_USER_ID", str(BRANDING.get("bot", {}).get("alertUserId", "1446868246455259289"))))

# Flight channel ID for posting flight updates
FLIGHT_CHANNEL_ID = int(os.getenv("FLIGHT_CHANNEL_ID", "0")) if os.getenv("FLIGHT_CHANNEL_ID") else None

# Voice announcements (gTTS + default PA channel)
DEFAULT_VOICE_CHANNEL_ID = int(
    os.getenv("DEFAULT_VOICE_CHANNEL_ID", str(BRANDING.get("bot", {}).get("defaultVoiceChannelId", "1503003631027486812")))
)
GTTS_LANG = os.getenv("GTTS_LANG", "en")

