import logging
import os
import shutil
import subprocess

import disnake

_log = logging.getLogger(__name__)

FFMPEG_EXECUTABLE = os.getenv("FFMPEG_EXECUTABLE") or shutil.which("ffmpeg")
FFMPEG_BEFORE = "-nostdin"
FFMPEG_OPUS_BITRATE = 128


def check_voice_dependencies() -> list[str]:
    """Return human-readable issues that would prevent voice playback."""
    issues: list[str] = []

    if not FFMPEG_EXECUTABLE:
        issues.append(
            "FFmpeg was not found. Install FFmpeg and add it to PATH, "
            "or set FFMPEG_EXECUTABLE in .env."
        )
    else:
        try:
            result = subprocess.run(
                [FFMPEG_EXECUTABLE, "-version"],
                capture_output=True,
                text=True,
                timeout=10,
                check=False,
            )
            if result.returncode != 0:
                issues.append(f"FFmpeg at `{FFMPEG_EXECUTABLE}` did not run successfully.")
        except OSError as exc:
            issues.append(f"FFmpeg at `{FFMPEG_EXECUTABLE}` could not be executed: {exc}")

    try:
        import dave  # noqa: F401
    except ImportError:
        issues.append(
            "dave.py is not installed. Discord voice now requires it for audio encryption. "
            "Run: pip install -U \"disnake[voice]>=2.11\""
        )

    ensure_opus_loaded(warn_only=True)
    if not disnake.opus.is_loaded():
        _log.info("libopus is not loaded; using FFmpegOpusAudio for playback.")

    return issues


def ensure_opus_loaded(*, warn_only: bool = False) -> bool:
    """Try to load libopus for PCM-based sources."""
    if disnake.opus.is_loaded():
        return True

    candidates: list[str] = []
    if os.name == "nt":
        candidates.extend(
            [
                "libopus-0.dll",
                "libopus-0.x64.dll",
                "libopus-0.x86.dll",
            ]
        )

    for candidate in candidates:
        try:
            disnake.opus.load_opus(candidate)
            _log.info("Loaded libopus from %s", candidate)
            return True
        except disnake.OpusError:
            continue

    try:
        disnake.opus.load_opus()
        return disnake.opus.is_loaded()
    except Exception:
        if not warn_only:
            _log.warning("Could not auto-load libopus.")
        return False


def create_audio_source(path: str) -> disnake.AudioSource:
    """Build an audio source FFmpeg can stream to Discord."""
    if not FFMPEG_EXECUTABLE:
        raise RuntimeError(
            "FFmpeg was not found. Install FFmpeg and add it to PATH, "
            "or set FFMPEG_EXECUTABLE in .env."
        )
    if not os.path.isfile(path):
        raise FileNotFoundError(f"Audio file not found: {path}")
    if os.path.getsize(path) < 128:
        raise RuntimeError(f"Audio file is empty or too small: {path}")

    # Opus output avoids requiring Python libopus (FFmpegPCMAudio needs it).
    return disnake.FFmpegOpusAudio(
        path,
        executable=FFMPEG_EXECUTABLE,
        before_options=FFMPEG_BEFORE,
        bitrate=FFMPEG_OPUS_BITRATE,
    )
