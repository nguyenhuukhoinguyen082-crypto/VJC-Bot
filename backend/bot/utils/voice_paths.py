import os

BOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SFX_DIR = os.path.join(BOT_DIR, "sfx")
TTS_CACHE_DIR = os.path.join(BOT_DIR, "data", "tts_cache")

AIRPORT_SFX = os.path.join(SFX_DIR, "airportSFX.mp3")
INFLIGHT_SFX = os.path.join(SFX_DIR, "inflightSFX.mp3")
SAFETY_AUDIO = os.path.join(BOT_DIR, "safety.mp3")

VENUE_SFX = {
    "airport": AIRPORT_SFX,
    "plane": INFLIGHT_SFX,
}
