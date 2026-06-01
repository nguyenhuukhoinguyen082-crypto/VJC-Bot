import datetime
import disnake
from config import BRANDING

# ── Brand Constants ──────────────────────────────────────────────────────
_colors = BRANDING.get("colors", {}).get("bot", {})

BRAND_GREEN  = _colors.get("green", 0xA8D8A8)
BRAND_MINT   = _colors.get("mint", 0xC8F0C8)
BRAND_RED    = _colors.get("red", 0xF4A9A8)
BRAND_YELLOW = _colors.get("yellow", 0xFFE0A0)
BRAND_ORANGE = _colors.get("orange", 0xF5C4A0)
BRAND_BLUE   = _colors.get("blue", 0xA8C8E8)
BRAND_GOLD   = _colors.get("gold", 0xF5DFA0)
BRAND_PURPLE = _colors.get("purple", 0xD4B8E0)

LOGO_URL    = BRANDING.get("logos", {}).get("bot", "https://example.com/logo.png")
FOOTER_TEXT = BRANDING.get("bot", {}).get("footerText", "Airline Bot")
FOOTER_ICON = LOGO_URL
AIRLINE_NAME = BRANDING.get("airline", {}).get("name", "PTFS Airline")

def base_embed(title: str = "", description: str = "", color: int = BRAND_GREEN) -> disnake.Embed:
    """Return a pre-styled embed with branding."""
    embed = disnake.Embed(title=title, description=description, color=color)
    embed.set_footer(text=FOOTER_TEXT, icon_url=FOOTER_ICON)
    embed.timestamp = datetime.datetime.utcnow()
    return embed
