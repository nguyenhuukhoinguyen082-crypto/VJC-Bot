import asyncio
import uuid
from pathlib import Path

from config import GTTS_LANG
from utils.voice_paths import TTS_CACHE_DIR


class TTSGenerationError(RuntimeError):
    pass


def _ensure_cache_dir() -> Path:
    cache = Path(TTS_CACHE_DIR)
    cache.mkdir(parents=True, exist_ok=True)
    return cache


def _synthesize_sync(text: str, output_path: Path, lang: str) -> None:
    try:
        from gtts import gTTS
    except ImportError as exc:
        raise TTSGenerationError(
            "gTTS is not installed. Run: pip install gTTS"
        ) from exc

    try:
        tts = gTTS(text=text, lang=lang)
        tts.save(str(output_path))
    except Exception as exc:
        raise TTSGenerationError(f"gTTS failed: {exc}") from exc


async def synthesize_speech(text: str) -> Path:
    """Generate an MP3 file from text using Google Text-to-Speech (gTTS)."""
    if not text.strip():
        raise ValueError("TTS text cannot be empty.")

    cache_dir = _ensure_cache_dir()
    output_path = cache_dir / f"tts_{uuid.uuid4().hex}.mp3"
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, _synthesize_sync, text, output_path, GTTS_LANG)
    return output_path
