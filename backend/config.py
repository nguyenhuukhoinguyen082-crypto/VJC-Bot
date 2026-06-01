import os
import json
from pathlib import Path
from dotenv import load_dotenv
from pydantic_settings import BaseSettings

load_dotenv()
load_dotenv(Path(__file__).resolve().parent / "bot" / ".env")

# ── Branding Configuration ───────────────────────────────────────────────
CONFIG_DIR = Path(__file__).resolve().parent.parent / "config"
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

class Settings(BaseSettings):
    api_key: str = os.getenv("API_KEY", "")
    secret_key: str = os.getenv("SECRET_KEY", "")
    database_url: str = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/airline_panel")
    algorithm: str = os.getenv("ALGORITHM", "HS256")
    access_token_expire_minutes: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
    rate_limit_per_minute: int = int(os.getenv("RATE_LIMIT_PER_MINUTE", "60"))
    csrf_secret_key: str = os.getenv("CSRF_SECRET_KEY", "")
    csrf_token_expire_minutes: int = int(os.getenv("CSRF_TOKEN_EXPIRE_MINUTES", "60"))
    discord_bot_token: str = os.getenv("DISCORD_BOT_TOKEN", "")
    cors_origins: str = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000,http://127.0.0.1:3001,"
        f"{BRANDING.get('links', {}).get('website', 'https://bamboo-airways.vercel.app')}",
    )
    csrf_cookie_secure: bool = os.getenv("CSRF_COOKIE_SECURE", "false").lower() == "true"
    csrf_cookie_samesite: str = os.getenv("CSRF_COOKIE_SAMESITE", "lax")

    @property
    def cors_origin_list(self) -> list[str]:
        origins = [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]
        # De-dupe while preserving order
        seen: set[str] = set()
        unique: list[str] = []
        for origin in origins:
            if origin not in seen:
                seen.add(origin)
                unique.append(origin)
        return unique

    @property
    def is_cross_origin_deployment(self) -> bool:
        """True when the API serves a remote HTTPS frontend (not localhost)."""
        return any(
            o.startswith("https://") and "localhost" not in o and "127.0.0.1" not in o
            for o in self.cors_origin_list
        )

    @property
    def cookie_secure(self) -> bool:
        if self.csrf_cookie_secure:
            return True
        return self.is_cross_origin_deployment

    @property
    def cookie_samesite(self) -> str:
        if self.csrf_cookie_samesite and self.csrf_cookie_samesite != "lax":
            return self.csrf_cookie_samesite
        if self.is_cross_origin_deployment:
            return "none"
        return "lax"

settings = Settings()

# Bot config constants
BOT_TOKEN = os.getenv("DISCORD_BOT_TOKEN")
GUILD_ID = int(os.getenv("DISCORD_GUILD_ID", 0)) if os.getenv("DISCORD_GUILD_ID") else None
DISCORD_INVITE_URL = os.getenv("DISCORD_INVITE_URL", BRANDING.get("links", {}).get("discord", "https://discord.gg/pFgPqSKwFp"))
BACKEND_API_URL = os.getenv("BACKEND_API_URL", "http://localhost:8000")
API_KEY = os.getenv("API_KEY", "")

# Discord user to alert on backend health issues
ALERT_USER_ID = int(os.getenv("ALERT_USER_ID", str(BRANDING.get("bot", {}).get("alertUserId", "1446868246455259289"))))
FLIGHT_CHANNEL_ID = int(os.getenv("FLIGHT_CHANNEL_ID", "0")) if os.getenv("FLIGHT_CHANNEL_ID") else None

# Comma-separated Discord role IDs that can bypass high-rank command permission checks.
_default_roles = ",".join(map(str, BRANDING.get("bot", {}).get("staffRoles", [1506916165858099310])))
_raw_role_ids = os.getenv("ELEVATED_ROLE_IDS", _default_roles)
ELEVATED_ROLE_IDS: set[int] = {
    int(role_id.strip()) for role_id in _raw_role_ids.split(",") if role_id.strip()
}

# Voice announcements (gTTS + default PA channel)
DEFAULT_VOICE_CHANNEL_ID = int(
    os.getenv("DEFAULT_VOICE_CHANNEL_ID", str(BRANDING.get("bot", {}).get("defaultVoiceChannelId", "1503003631027486812")))
)
GTTS_LANG = os.getenv("GTTS_LANG", "en")

