import datetime
import logging
import os
from dataclasses import dataclass
from pathlib import Path

_log = logging.getLogger(__name__)

import disnake
from utils.branding import LOGO_URL, BRAND_GREEN, AIRLINE_NAME, base_embed
from disnake.ext import commands

from config import DEFAULT_VOICE_CHANNEL_ID
from utils.announcement_templates import (
    ANNOUNCEMENT_CATEGORIES,
    TEMPLATES_BY_CATEGORY,
    TEMPLATES_BY_KEY,
    AnnouncementTemplate,
    time_greeting_from_local_time,
)
from utils.permissions import has_elevated_role, require_elevated_role
from utils.gtts_tts import TTSGenerationError, synthesize_speech
from utils.voice_paths import SAFETY_AUDIO, VENUE_SFX
from utils.voice_audio import check_voice_dependencies
from utils.voice_player import VoicePlaybackError, VoicePlayer

VIEW_TIMEOUT = 900


@dataclass
class FlightContext:
    gate: str
    flight: str
    departure: str
    arrival: str
    eta_hours: int
    eta_minutes: int
    local_time: str
    local_temperature: int

    def format_text(self, template: str) -> str:
        return template.format(
            gate=self.gate,
            flight=self.flight,
            departure=self.departure,
            arrival=self.arrival,
            destination=self.arrival,
            hours=self.eta_hours,
            minutes=self.eta_minutes,
            local_time=self.local_time,
            local_temperature=self.local_temperature,
            time_greeting=time_greeting_from_local_time(self.local_time),
            airline_name=AIRLINE_NAME,
        )


def flight_summary_embed(ctx: FlightContext) -> disnake.Embed:
    embed = base_embed(
        title="📢  Voice Announcement Console",
        description="Select a category, then choose a template to play in the voice channel.",
    )
    embed.add_field(name="Flight", value=f"`{ctx.flight}`", inline=True)
    embed.add_field(name="Gate", value=f"`{ctx.gate}`", inline=True)
    embed.add_field(name="Route", value=f"`{ctx.departure}` → `{ctx.arrival}`", inline=True)
    embed.add_field(
        name="ETA",
        value=f"`{ctx.eta_hours}` hr `{ctx.eta_minutes}` min",
        inline=True,
    )
    embed.add_field(name="Local time", value=f"`{ctx.local_time}`", inline=True)
    embed.add_field(name="Temperature", value=f"`{ctx.local_temperature}` °C", inline=True)
    return embed


class VoiceCog:
    def __init__(self, bot: commands.Bot):
        self.bot = bot
        self.player = VoicePlayer(bot)
        self._sessions: dict[int, FlightContext] = {}

    def set_session(self, user_id: int, ctx: FlightContext) -> None:
        self._sessions[user_id] = ctx

    def get_session(self, user_id: int) -> FlightContext | None:
        return self._sessions.get(user_id)

    async def play_announcement(
        self,
        guild: disnake.Guild,
        flight_ctx: FlightContext,
        template: AnnouncementTemplate,
    ) -> None:
        queue: list[str | Path] = [VENUE_SFX[template.venue]]
        speech_file: Path | None = None

        try:
            if template.kind == "safety_audio":
                queue.append(SAFETY_AUDIO)
            else:
                line = template.pick_text()
                if not line:
                    raise VoicePlaybackError("This announcement has no spoken text.")
                spoken = flight_ctx.format_text(line)
                speech_file = await synthesize_speech(spoken)
                queue.append(speech_file)

            await self.player.play_files(guild, queue)
        finally:
            if speech_file and speech_file.exists():
                try:
                    os.remove(speech_file)
                except OSError:
                    pass

    async def play_custom_tts(self, guild: disnake.Guild, text: str) -> None:
        speech_file = await synthesize_speech(text)
        try:
            await self.player.play_files(guild, [speech_file])
        finally:
            if speech_file.exists():
                try:
                    os.remove(speech_file)
                except OSError:
                    pass


class CategoryButton(disnake.ui.Button):
    def __init__(self, cog: VoiceCog, category_key: str, label: str, row: int):
        super().__init__(
            label=label,
            style=disnake.ButtonStyle.primary,
            custom_id=f"vc_cat:{category_key}",
            row=row,
        )
        self.cog = cog
        self.category_key = category_key

    async def callback(self, inter: disnake.MessageInteraction):
        if not has_elevated_role(inter.author):
            await inter.response.send_message("Staff role required.", ephemeral=True)
            return

        flight_ctx = self.cog.get_session(inter.author.id)
        if not flight_ctx:
            await inter.response.send_message(
                "Session expired. Run `/vc announcement` again.",
                ephemeral=True,
            )
            return

        category_label = ANNOUNCEMENT_CATEGORIES[self.category_key]
        templates = TEMPLATES_BY_CATEGORY[self.category_key]
        embed = flight_summary_embed(flight_ctx)
        embed.description = f"**{category_label}**\nChoose a template to play."

        view = TemplateView(self.cog, self.category_key)
        await inter.response.edit_message(embed=embed, view=view)


class TemplateButton(disnake.ui.Button):
    def __init__(self, cog: VoiceCog, template_key: str, label: str, row: int):
        super().__init__(
            label=label,
            style=disnake.ButtonStyle.secondary,
            custom_id=f"vc_tpl:{template_key}",
            row=row,
        )
        self.cog = cog
        self.template_key = template_key

    async def callback(self, inter: disnake.MessageInteraction):
        if not has_elevated_role(inter.author):
            await inter.response.send_message("Staff role required.", ephemeral=True)
            return

        flight_ctx = self.cog.get_session(inter.author.id)
        if not flight_ctx:
            await inter.response.send_message(
                "Session expired. Run `/vc announcement` again.",
                ephemeral=True,
            )
            return

        template = TEMPLATES_BY_KEY.get(self.template_key)
        if not template:
            await inter.response.send_message("Unknown template.", ephemeral=True)
            return

        await inter.response.defer(ephemeral=True)

        try:
            await self.cog.player.ensure_connected(inter.guild)
            await self.cog.play_announcement(inter.guild, flight_ctx, template)
        except TTSGenerationError as exc:
            await inter.edit_original_response(content=str(exc))
            return
        except VoicePlaybackError as exc:
            await inter.edit_original_response(content=str(exc))
            return
        except Exception:
            await inter.edit_original_response(
                content="Failed to play the announcement. Check bot logs."
            )
            return

        channel = inter.guild.voice_client.channel if inter.guild.voice_client else None
        where = channel.mention if channel else "voice"
        await inter.edit_original_response(content=f"Played **{template.label}** in {where}.")


class BackButton(disnake.ui.Button):
    def __init__(self, cog: VoiceCog):
        super().__init__(
            label="← Categories",
            style=disnake.ButtonStyle.secondary,
            custom_id="vc_back",
            row=4,
        )
        self.cog = cog

    async def callback(self, inter: disnake.MessageInteraction):
        if not has_elevated_role(inter.author):
            await inter.response.send_message("Staff role required.", ephemeral=True)
            return

        flight_ctx = self.cog.get_session(inter.author.id)
        if not flight_ctx:
            await inter.response.send_message(
                "Session expired. Run `/vc announcement` again.",
                ephemeral=True,
            )
            return

        embed = flight_summary_embed(flight_ctx)
        view = CategoryView(self.cog)
        await inter.response.edit_message(embed=embed, view=view)


class CategoryView(disnake.ui.View):
    def __init__(self, cog: VoiceCog):
        super().__init__(timeout=VIEW_TIMEOUT)
        self.cog = cog
        labels = [
            ("boarding", "Boarding"),
            ("gate_delay", "Gate / Delay"),
            ("onboard", "Onboard"),
            ("turbulence", "Turbulence"),
            ("service", "Service"),
            ("landing", "Landing"),
            ("operational", "Operational"),
        ]
        for index, (key, label) in enumerate(labels):
            self.add_item(CategoryButton(cog, key, label, row=index // 3))


class TemplateView(disnake.ui.View):
    def __init__(self, cog: VoiceCog, category_key: str):
        super().__init__(timeout=VIEW_TIMEOUT)
        self.cog = cog
        templates = TEMPLATES_BY_CATEGORY[category_key]
        for index, template in enumerate(templates):
            self.add_item(
                TemplateButton(cog, template.key, template.label, row=index // 3)
            )
        self.add_item(BackButton(cog))


class Voice(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot
        self.cog = VoiceCog(bot)

    async def cog_load(self):
        issues = check_voice_dependencies()
        for issue in issues:
            _log.warning("Voice dependency issue: %s", issue)

    @commands.Cog.listener()
    async def on_voice_state_update(
        self,
        member: disnake.Member,
        before: disnake.VoiceState,
        after: disnake.VoiceState,
    ):
        if member.id != self.bot.user.id:
            return
        if before.channel == after.channel:
            return
        vc = member.guild.voice_client
        _log.info(
            "Bot voice: %s -> %s | voice_client=%s connected=%s",
            getattr(before.channel, "name", None),
            getattr(after.channel, "name", None),
            bool(vc),
            vc.is_connected() if vc else None,
        )
        if after.channel:
            self.cog.player.remember_channel(member.guild.id, after.channel.id)
        elif before.channel and not after.channel:
            self.cog.player.forget_channel(member.guild.id)

    @commands.slash_command(name="join", description="Join a voice channel for announcements")
    async def join(
        self,
        inter: disnake.ApplicationCommandInteraction,
        channel_id: str = commands.Param(
            default=None,
            description=f"Voice channel ID (default: {DEFAULT_VOICE_CHANNEL_ID})",
        ),
    ):
        if inter.guild is None:
            await inter.response.send_message("This command can only be used in a server.", ephemeral=True)
            return

        target_id = int(channel_id) if channel_id else DEFAULT_VOICE_CHANNEL_ID
        channel = inter.guild.get_channel(target_id)

        if channel is None:
            channel = await self.bot.fetch_channel(target_id)

        if not isinstance(channel, disnake.VoiceChannel):
            await inter.response.send_message(
                f"Channel `{target_id}` is not a voice channel.",
                ephemeral=True,
            )
            return

        await inter.response.defer(ephemeral=True)

        try:
            await self.cog.player.connect(channel)
        except VoicePlaybackError as exc:
            await inter.edit_original_response(content=str(exc))
            return
        except Exception as exc:
            await inter.edit_original_response(
                content=f"Could not join voice channel: {exc}"
            )
            return

        await inter.edit_original_response(
            content=f"Joined **{channel.name}** (`{channel.id}`)."
        )

    @commands.slash_command(name="leave", description="Disconnect the bot from voice")
    async def leave(self, inter: disnake.ApplicationCommandInteraction):
        if inter.guild is None:
            await inter.response.send_message("This command can only be used in a server.", ephemeral=True)
            return

        if not inter.guild.voice_client and not (
            inter.guild.me and inter.guild.me.voice and inter.guild.me.voice.channel
        ):
            await inter.response.send_message(
                "I'm not in a voice channel.",
                ephemeral=True,
            )
            return

        await inter.response.defer(ephemeral=True)
        await self.cog.player.disconnect(inter.guild)
        await inter.edit_original_response(content="Left the voice channel.")

    @commands.slash_command(
        name="vc",
        contexts=disnake.InteractionContextTypes(guild=True, private_channel=True),
    )
    async def vc_group(self, inter: disnake.ApplicationCommandInteraction):
        pass

    @vc_group.sub_command(
        name="announcement",
        description="Open the PA announcement panel (staff only)",
    )
    @require_elevated_role()
    async def vc_announcement(
        self,
        inter: disnake.ApplicationCommandInteraction,
        gate: str = commands.Param(description="Gate number or name"),
        flight: str = commands.Param(description="Flight number"),
        departure: str = commands.Param(description="Departure airport/city"),
        arrival: str = commands.Param(description="Arrival airport/city"),
        eta_hours: int = commands.Param(description="Flight time — hours", ge=0, le=24),
        eta_minutes: int = commands.Param(description="Flight time — minutes", ge=0, le=59),
        local_time: str = commands.Param(
            description="Local time at airport (e.g. 14:35) — used for greetings and arrival"
        ),
        local_temperature: int = commands.Param(
            description="Local temperature in Celsius",
            ge=-60,
            le=60,
        ),
    ):
        if inter.guild is None:
            await inter.response.send_message("This command can only be used in a server.", ephemeral=True)
            return

        flight_ctx = FlightContext(
            gate=gate,
            flight=flight,
            departure=departure,
            arrival=arrival,
            eta_hours=eta_hours,
            eta_minutes=eta_minutes,
            local_time=local_time,
            local_temperature=local_temperature,
        )
        self.cog.set_session(inter.author.id, flight_ctx)

        embed = flight_summary_embed(flight_ctx)
        if self.cog.player.is_voice_ready(inter.guild):
            channel = inter.guild.voice_client.channel
            embed.add_field(
                name="🔊  Voice",
                value=f"Connected to {channel.mention}. Announcements will play there.",
                inline=False,
            )
        else:
            embed.add_field(
                name="⚠️  Voice",
                value=(
                    "Not connected yet — run `/join` first, or the bot will auto-join "
                    f"the default channel when you play an announcement."
                ),
                inline=False,
            )

        view = CategoryView(self.cog)
        await inter.response.send_message(embed=embed, view=view, ephemeral=True)

    @commands.slash_command(
        name="tts",
        description="Speak custom text in the voice channel (staff only)",
    )
    @require_elevated_role()
    async def tts(
        self,
        inter: disnake.ApplicationCommandInteraction,
        text: str = commands.Param(description="Text to speak"),
    ):
        if inter.guild is None:
            await inter.response.send_message("This command can only be used in a server.", ephemeral=True)
            return

        await inter.response.defer(ephemeral=True)

        try:
            await self.cog.player.ensure_connected(inter.guild)
            await self.cog.play_custom_tts(inter.guild, text)
        except TTSGenerationError as exc:
            await inter.edit_original_response(content=str(exc))
            return
        except VoicePlaybackError as exc:
            await inter.edit_original_response(content=str(exc))
            return
        except Exception:
            await inter.edit_original_response(
                content="Failed to play TTS. Check bot logs."
            )
            return

        await inter.edit_original_response(
            content=f"Played TTS in {inter.guild.voice_client.channel.mention}."
        )


def setup(bot: commands.Bot):
    bot.add_cog(Voice(bot))
