import asyncio
import logging
import os
from pathlib import Path

import disnake
from disnake.errors import ClientException, ConnectionClosed

from config import DEFAULT_VOICE_CHANNEL_ID
from utils.voice_audio import create_audio_source

_log = logging.getLogger(__name__)

# Discord may keep a dead voice session briefly; wait before reconnecting after 4006.
VOICE_SESSION_COOLDOWN_SECONDS = 2.0
MAX_VOICE_CONNECT_ATTEMPTS = 3


class VoicePlaybackError(RuntimeError):
    pass


def _is_invalid_voice_session_error(exc: BaseException) -> bool:
    if isinstance(exc, ConnectionClosed) and exc.code == 4006:
        return True
    message = str(exc).lower()
    return "4006" in message or "session no longer valid" in message or "session is no longer valid" in message


def _resolve_voice_channel(guild: disnake.Guild, channel_id: int, bot: disnake.Client) -> disnake.VoiceChannel:
    channel = guild.get_channel(channel_id)
    if channel is None:
        channel = bot.get_channel(channel_id)
    if channel is None:
        raise VoicePlaybackError(f"Voice channel `{channel_id}` was not found.")
    if not isinstance(channel, disnake.VoiceChannel):
        raise VoicePlaybackError(f"Channel `{channel_id}` is not a voice channel.")
    return channel


class VoicePlayer:
    """Serialize voice playback per guild."""

    def __init__(self, bot: disnake.Client):
        self.bot = bot
        self._locks: dict[int, asyncio.Lock] = {}
        self._connecting_guilds: set[int] = set()
        self._voice_channels: dict[int, int] = {}

    def _lock_for(self, guild_id: int) -> asyncio.Lock:
        if guild_id not in self._locks:
            self._locks[guild_id] = asyncio.Lock()
        return self._locks[guild_id]

    def remember_channel(self, guild_id: int, channel_id: int) -> None:
        self._voice_channels[guild_id] = channel_id

    def forget_channel(self, guild_id: int) -> None:
        self._voice_channels.pop(guild_id, None)

    def target_channel_id(self, guild: disnake.Guild) -> int:
        if guild.id in self._voice_channels:
            return self._voice_channels[guild.id]
        if guild.me and guild.me.voice and guild.me.voice.channel:
            return guild.me.voice.channel.id
        return DEFAULT_VOICE_CHANNEL_ID

    def is_voice_ready(self, guild: disnake.Guild) -> bool:
        voice_client = guild.voice_client
        return bool(
            voice_client
            and voice_client.is_connected()
            and voice_client.channel is not None
        )

    async def _force_disconnect(self, voice_client: disnake.VoiceClient | None) -> None:
        """Remove a live or stale voice client so a new connect can succeed."""
        if not voice_client:
            return
        try:
            await voice_client.disconnect(force=True)
        except Exception:
            pass

    async def _purge_guild_voice(self, guild: disnake.Guild) -> None:
        """Disconnect every voice client for this guild and clear cached sessions."""
        clients = [vc for vc in self.bot.voice_clients if vc.guild and vc.guild.id == guild.id]
        if guild.voice_client and guild.voice_client not in clients:
            clients.append(guild.voice_client)

        for voice_client in clients:
            await self._force_disconnect(voice_client)

        if clients:
            await asyncio.sleep(VOICE_SESSION_COOLDOWN_SECONDS)

    async def disconnect(self, guild: disnake.Guild) -> bool:
        """Disconnect from voice if connected or stale. Returns True if a client existed."""
        had_client = bool(guild.voice_client or self.bot.voice_clients)
        await self._purge_guild_voice(guild)
        self.forget_channel(guild.id)
        return had_client

    async def _wait_until_connected(
        self,
        voice_client: disnake.VoiceClient,
        *,
        timeout: float = 20.0,
    ) -> disnake.VoiceClient:
        """Wait until the voice websocket handshake finishes."""
        elapsed = 0.0
        interval = 0.2
        while elapsed < timeout:
            if voice_client.is_connected():
                return voice_client
            await asyncio.sleep(interval)
            elapsed += interval
        raise VoicePlaybackError("Timed out while connecting to the voice channel.")

    async def _connect_once(self, channel: disnake.VoiceChannel) -> disnake.VoiceClient:
        guild = channel.guild
        voice_client = guild.voice_client

        if voice_client and voice_client.is_connected():
            if voice_client.channel and voice_client.channel.id == channel.id:
                return voice_client
            await voice_client.move_to(channel)
            return await self._wait_until_connected(guild.voice_client)

        try:
            voice_client = await channel.connect(timeout=30.0, reconnect=False)
        except ClientException as exc:
            if "Already connected" not in str(exc):
                raise
            await self._purge_guild_voice(guild)
            voice_client = await channel.connect(timeout=30.0, reconnect=False)

        return await self._wait_until_connected(voice_client)

    async def connect(self, channel: disnake.VoiceChannel) -> disnake.VoiceClient:
        guild = channel.guild
        guild_id = guild.id

        if guild_id in self._connecting_guilds:
            raise VoicePlaybackError("Already connecting to a voice channel. Please wait.")

        self._connecting_guilds.add(guild_id)
        last_error: Exception | None = None

        try:
            for attempt in range(1, MAX_VOICE_CONNECT_ATTEMPTS + 1):
                try:
                    if attempt > 1 or guild.voice_client:
                        await self._purge_guild_voice(guild)

                    voice_client = await self._connect_once(channel)
                    self.remember_channel(guild_id, channel.id)
                    return voice_client
                except (ConnectionClosed, ClientException, VoicePlaybackError, OSError) as exc:
                    last_error = exc
                    if not _is_invalid_voice_session_error(exc) and attempt == 1:
                        raise
                    _log.warning(
                        "Voice connect attempt %s/%s failed for guild %s: %s",
                        attempt,
                        MAX_VOICE_CONNECT_ATTEMPTS,
                        guild_id,
                        exc,
                    )
                    await self._purge_guild_voice(guild)
                    if attempt == MAX_VOICE_CONNECT_ATTEMPTS:
                        break
                    await asyncio.sleep(VOICE_SESSION_COOLDOWN_SECONDS * attempt)

            raise VoicePlaybackError(
                "Could not join voice channel. Discord rejected the voice session (4006). "
                "Run `/leave`, wait a few seconds, then `/join` again. "
                "If this keeps happening, restart the bot after upgrading dependencies: "
                "`pip install -U \"disnake[voice]>=2.10.2\"`"
            ) from last_error
        finally:
            self._connecting_guilds.discard(guild_id)

    async def ensure_connected(self, guild: disnake.Guild) -> disnake.VoiceClient:
        """Return a live voice client, reconnecting to the last channel if needed."""
        voice_client = guild.voice_client
        if voice_client and voice_client.is_connected():
            if voice_client.channel:
                self.remember_channel(guild.id, voice_client.channel.id)
            return voice_client

        channel_id = self.target_channel_id(guild)
        channel = _resolve_voice_channel(guild, channel_id, self.bot)
        return await self.connect(channel)

    async def play_files(self, guild: disnake.Guild, paths: list[str | Path]) -> None:
        async with self._lock_for(guild.id):
            voice_client = await self.ensure_connected(guild)
            for path in paths:
                if not voice_client.is_connected():
                    voice_client = await self.ensure_connected(guild)
                path_str = str(path)
                if not os.path.isfile(path_str):
                    raise VoicePlaybackError(f"Audio file not found: {path_str}")
                await self._play_one(voice_client, path_str)

    async def _play_one(self, voice_client: disnake.VoiceClient, path: str) -> None:
        while voice_client.is_playing():
            await asyncio.sleep(0.15)

        if not voice_client.is_connected():
            raise VoicePlaybackError("Lost voice connection before playback.")

        finished = asyncio.Event()
        playback_error: Exception | None = None

        def after_playback(error):
            nonlocal playback_error
            if error:
                playback_error = error
                _log.error("Voice playback error for %s: %s", path, error)
            finished.set()

        try:
            source = create_audio_source(path)
        except (RuntimeError, FileNotFoundError) as exc:
            raise VoicePlaybackError(str(exc)) from exc

        try:
            voice_client.play(source, after=after_playback)
            await asyncio.sleep(0.35)
            if not voice_client.is_playing():
                raise VoicePlaybackError(
                    "Audio failed to start. Check that FFmpeg is installed and supports libopus "
                    "(run `ffmpeg -codecs` and look for libopus)."
                )
            await finished.wait()
            if playback_error:
                raise VoicePlaybackError(f"Playback stopped with an error: {playback_error}")
        finally:
            source.cleanup()
