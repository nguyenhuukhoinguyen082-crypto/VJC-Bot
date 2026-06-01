import disnake
from utils.branding import LOGO_URL, AIRLINE_NAME, BRAND_ORANGE, BRAND_GREEN, BRAND_RED, BRAND_YELLOW, BRAND_BLUE, base_embed
from disnake.ext import commands
from datetime import datetime, timedelta
from db import get_sync_db, User, Blacklist, model_to_dict
from utils.permissions import require_elevated_role, require_manage_channels

def parse_duration(duration: str, allowed_units: dict) -> int | None:
    """Parse a duration string like '1h', '7d' into seconds. Returns None on failure."""
    unit = duration[-1]
    if unit not in allowed_units:
        return None
    try:
        return int(duration[:-1]) * allowed_units[unit]
    except ValueError:
        return None


def format_ts(ts: int) -> str:
    """Return a Discord relative timestamp string."""
    return disnake.utils.format_dt(datetime.fromtimestamp(ts), style="R")


class Moderation(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    async def get_user_id_from_discord(self, discord_id: str) -> str:
        with get_sync_db() as db:
            user = db.query(User).filter(User.discordID == int(discord_id)).first()
            return user.id if user else None

    # ── /mod ─────────────────────────────────────────────────────────────────
    @commands.slash_command(name="mod", contexts=disnake.InteractionContextTypes(guild=True, private_channel=True))
    async def mod_group(self, inter: disnake.ApplicationCommandInteraction):
        pass

    # ── /mod ban ──────────────────────────────────────────────────────────────
    @mod_group.sub_command(name="ban", description="Ban a user from the server")
    @require_elevated_role()
    async def ban(
        self,
        inter: disnake.ApplicationCommandInteraction,
        user: disnake.Member = commands.Param(description="The user to ban"),
        reason: str = commands.Param(description="The reason for banning"),
        purge_duration: int = commands.Param(description="Purge message duration in days (0-7)", default=0, ge=0, le=7)
    ):
        await user.ban(reason=reason, delete_message_days=purge_duration)

        with get_sync_db() as db:
            u = db.query(User).filter(User.discordID == user.id).first()
            if u:
                mod_data = dict(u.moderation) if u.moderation else {}
                mod_data["ban"] = {
                    "reason": reason,
                    "banned_at": int(datetime.now().timestamp()),
                    "banned_by": str(inter.author.id),
                    "type": "permanent"
                }
                u.moderation = mod_data
                u.banned = True
                db.commit()

        try:
            await user.send(
                f"You have been **permanently banned** from the {AIRLINE_NAME} server.\n"
                f"**Reason:** {reason}"
            )
        except Exception:
            pass

        embed = base_embed(title="🔨  User Banned", color=BRAND_RED)
        embed.set_thumbnail(url=user.display_avatar.url)
        embed.set_author(name="Moderation  •  Ban", icon_url=LOGO_URL)
        embed.add_field(name="👤  User",        value=f"{user.mention} `{user.id}`", inline=False)
        embed.add_field(name="📝  Reason",      value=reason,                        inline=False)
        embed.add_field(name="🗑️  Msgs Purged", value=f"`{purge_duration}d`",        inline=True)
        embed.add_field(name="🛡️  Moderator",   value=inter.author.mention,          inline=True)
        embed.add_field(name="⏳  Duration",    value="`Permanent`",                  inline=True)
        await inter.response.send_message(embed=embed)

    # ── /mod tempban ──────────────────────────────────────────────────────────
    @mod_group.sub_command(name="tempban", description="Temporarily ban a user")
    @require_elevated_role()
    async def tempban(
        self,
        inter: disnake.ApplicationCommandInteraction,
        user: disnake.Member = commands.Param(description="The user to tempban"),
        reason: str = commands.Param(description="The reason for tempbanning"),
        duration: str = commands.Param(description="Duration (e.g., 1h, 1d, 1w)")
    ):
        seconds = parse_duration(duration, {"h": 3600, "d": 86400, "w": 604800})
        if seconds is None:
            embed = base_embed(
                title="❌  Invalid Duration",
                description="Use `h` (hours), `d` (days), or `w` (weeks). Example: `3d`",
                color=BRAND_RED,
            )
            await inter.response.send_message(embed=embed, ephemeral=True)
            return

        await user.ban(reason=reason)

        now = int(datetime.now().timestamp())
        with get_sync_db() as db:
            u = db.query(User).filter(User.discordID == user.id).first()
            if u:
                mod_data = dict(u.moderation) if u.moderation else {}
                mod_data["ban"] = {
                    "reason": reason,
                    "banned_at": now,
                    "banned_by": str(inter.author.id),
                    "expires_at": now + seconds,
                    "type": "tempban"
                }
                u.moderation = mod_data
                u.banned = True
                db.commit()

        try:
            await user.send(
                f"You have been **temporarily banned** from {AIRLINE_NAME} server for `{duration}`.\n"
                f"**Reason:** {reason}"
            )
        except Exception:
            pass

        embed = base_embed(title="⏱️  User Temp-Banned", color=BRAND_ORANGE)
        embed.set_thumbnail(url=user.display_avatar.url)
        embed.set_author(name="Moderation  •  Temp Ban", icon_url=LOGO_URL)
        embed.add_field(name="👤  User",       value=f"{user.mention} `{user.id}`", inline=False)
        embed.add_field(name="📝  Reason",     value=reason,                        inline=False)
        embed.add_field(name="⏳  Duration",   value=f"`{duration}`",               inline=True)
        embed.add_field(name="🔓  Expires",    value=format_ts(now + seconds),      inline=True)
        embed.add_field(name="🛡️  Moderator",  value=inter.author.mention,          inline=True)
        await inter.response.send_message(embed=embed)

    # ── /mod kick ─────────────────────────────────────────────────────────────
    @mod_group.sub_command(name="kick", description="Kick a user from the server")
    @require_elevated_role()
    async def kick(
        self,
        inter: disnake.ApplicationCommandInteraction,
        user: disnake.Member = commands.Param(description="The user to kick"),
        reason: str = commands.Param(description="The reason for kicking"),
        purge_duration: int = commands.Param(description="Purge message duration in days (0-7)", default=0, ge=0, le=7)
    ):
        await user.kick(reason=reason)

        kick_count = 0
        with get_sync_db() as db:
            u = db.query(User).filter(User.discordID == user.id).first()
            if u:
                mod_data = dict(u.moderation) if u.moderation else {}
                kicks = mod_data.get("kicks", [])
                kicks.append({
                    "reason": reason,
                    "kicked_at": int(datetime.now().timestamp()),
                    "kicked_by": str(inter.author.id)
                })
                mod_data["kicks"] = kicks
                u.moderation = mod_data
                kick_count = len(kicks)
                db.commit()

        try:
            await user.send(
                f"You have been **kicked** from {AIRLINE_NAME} server.\n"
                f"**Reason:** {reason}"
            )
        except Exception:
            pass

        embed = base_embed(title="👢  User Kicked", color=BRAND_ORANGE)
        embed.set_thumbnail(url=user.display_avatar.url)
        embed.set_author(name="Moderation  •  Kick", icon_url=LOGO_URL)
        embed.add_field(name="👤  User",        value=f"{user.mention} `{user.id}`",   inline=False)
        embed.add_field(name="📝  Reason",      value=reason,                           inline=False)
        embed.add_field(name="🛡️  Moderator",   value=inter.author.mention,             inline=True)
        embed.add_field(name="📊  Total Kicks", value=f"`{kick_count}`",                inline=True)
        await inter.response.send_message(embed=embed)

    # ── /mod warn ─────────────────────────────────────────────────────────────
    @mod_group.sub_command(name="warn", description="Warn a user")
    @require_elevated_role()
    async def warn(
        self,
        inter: disnake.ApplicationCommandInteraction,
        user: disnake.Member = commands.Param(description="The user to warn"),
        reason: str = commands.Param(description="The reason for warning"),
        expiry: str = commands.Param(description="Expiry duration (e.g., 1h, 1d, 1w)", default="7d")
    ):
        seconds = parse_duration(expiry, {"h": 3600, "d": 86400, "w": 604800})
        if seconds is None:
            embed = base_embed(
                title="❌  Invalid Duration",
                description="Use `h` (hours), `d` (days), or `w` (weeks). Example: `7d`",
                color=BRAND_RED,
            )
            await inter.response.send_message(embed=embed, ephemeral=True)
            return

        now              = int(datetime.now().timestamp())
        expiry_timestamp = now + seconds

        warn_count = 0
        with get_sync_db() as db:
            u = db.query(User).filter(User.discordID == user.id).first()
            if u:
                mod_data = dict(u.moderation) if u.moderation else {}
                warnings = mod_data.get("warnings", [])
                warnings.append({
                    "reason": reason,
                    "warned_at": now,
                    "warned_by": str(inter.author.id),
                    "expires_at": expiry_timestamp
                })
                mod_data["warnings"] = warnings
                u.moderation = mod_data
                warn_count = len(warnings)
                db.commit()

        try:
            await user.send(
                f"You have received a **warning** in the {AIRLINE_NAME} server.\n"
                f"**Reason:** {reason}\n"
                f"**Expires:** {expiry}"
            )
        except Exception:
            pass

        embed = base_embed(title="⚠️  User Warned", color=BRAND_YELLOW)
        embed.set_thumbnail(url=user.display_avatar.url)
        embed.set_author(name="Moderation  •  Warning", icon_url=LOGO_URL)
        embed.add_field(name="👤  User",          value=f"{user.mention} `{user.id}`", inline=False)
        embed.add_field(name="📝  Reason",        value=reason,                        inline=False)
        embed.add_field(name="⏳  Expires",       value=format_ts(expiry_timestamp),   inline=True)
        embed.add_field(name="🛡️  Moderator",     value=inter.author.mention,          inline=True)
        embed.add_field(name="📊  Total Warnings",value=f"`{warn_count}`",             inline=True)
        await inter.response.send_message(embed=embed)

    # ── /mod mute ─────────────────────────────────────────────────────────────
    # (mute command remains unchanged as it doesn't use the DB)

    # ── /mod unban ────────────────────────────────────────────────────────────
    @mod_group.sub_command(name="unban", description="Unban a user")
    @require_elevated_role()
    async def unban(
        self,
        inter: disnake.ApplicationCommandInteraction,
        user: str = commands.Param(description="The user ID or username to unban"),
        reason: str = commands.Param(description="The reason for unbanning")
    ):
        try:
            await inter.guild.unban(disnake.Object(user), reason=reason)
        except Exception:
            embed = base_embed(
                title="❌  Unban Failed",
                description="Could not unban this user from Discord. Check the ID and try again.",
                color=BRAND_RED,
            )
            await inter.response.send_message(embed=embed, ephemeral=True)
            return

        with get_sync_db() as db:
            u = db.query(User).filter(User.discordID == int(user)).first()
            if u:
                mod_data = dict(u.moderation) if u.moderation else {}
                ban_history = mod_data.get("ban_history", [])
                
                if "ban" in mod_data:
                    ban_history.append({
                        **mod_data["ban"],
                        "unbanned_at": int(datetime.now().timestamp()),
                        "unbanned_by": str(inter.author.id),
                        "unban_reason": reason
                    })
                    del mod_data["ban"]
                
                mod_data["ban_history"] = ban_history
                u.moderation = mod_data
                u.banned = False
                db.commit()

        embed = base_embed(title="✅  User Unbanned", color=BRAND_GREEN)
        embed.set_author(name="Moderation  •  Unban", icon_url=LOGO_URL)
        embed.add_field(name="🆔  User ID",    value=f"`{user}`",          inline=True)
        embed.add_field(name="📝  Reason",     value=reason,               inline=False)
        embed.add_field(name="🛡️  Moderator",  value=inter.author.mention, inline=True)
        await inter.response.send_message(embed=embed)

    # ── /mod info ─────────────────────────────────────────────────────────────
    @mod_group.sub_command(name="info", description="Show moderation info for a user")
    @require_elevated_role()
    async def modinfo(
        self,
        inter: disnake.ApplicationCommandInteraction,
        user: disnake.Member = commands.Param(description="The user to check")
    ):
        with get_sync_db() as db:
            u = db.query(User).filter(User.discordID == user.id).first()
            if not u:
                await inter.response.send_message("User not registered in the database.", ephemeral=True)
                return
            
            data = u.moderation or {}

        warnings    = data.get("warnings", [])
        kicks       = data.get("kicks", [])
        ban         = data.get("ban")
        blacklisted = data.get("blacklisted")
        suspicious  = data.get("suspicious", [])

        # Determine embed severity color
        if ban or blacklisted:
            color = BRAND_RED
        elif warnings or suspicious:
            color = BRAND_ORANGE
        else:
            color = BRAND_GREEN

        embed = base_embed(
            title=f"🛡️  Moderation Profile",
            color=color,
        )
        embed.set_thumbnail(url=user.display_avatar.url)
        embed.set_author(
            name=f"{user.display_name}  ·  {user.id}",
            icon_url=user.display_avatar.url,
        )

        # Summary row
        embed.add_field(name="⚠️  Warnings",   value=f"`{len(warnings)}`",  inline=True)
        embed.add_field(name="👢  Kicks",       value=f"`{len(kicks)}`",     inline=True)
        embed.add_field(name="🚩  Suspicious",  value=f"`{len(suspicious)}`",inline=True)

        # Active ban block
        if ban:
            ban_type  = ban.get("type", "ban").replace("ban", " Ban").title()
            ban_since = format_ts(ban.get("banned_at", 0))
            ban_val   = f"`{ban_type}`  since {ban_since}"
            if ban.get("expires_at"):
                ban_val += f"\nExpires {format_ts(ban['expires_at'])}"
            embed.add_field(name="🔨  Active Ban",  value=ban_val,         inline=False)
            embed.add_field(name="📝  Ban Reason",  value=ban.get("reason", "N/A"), inline=False)

        # Blacklist block
        if blacklisted:
            embed.add_field(
                name="⛔  Blacklisted",
                value=f"Since {format_ts(blacklisted.get('blacklisted_at', 0))}\n{blacklisted.get('reason', 'N/A')}",
                inline=False,
            )

        # Recent warnings
        if warnings:
            active_warns = [w for w in warnings if w.get("expires_at", 0) > datetime.now().timestamp()]
            recent = warnings[-3:]
            warn_lines = "\n".join(
                f"{format_ts(w['warned_at'])}  —  {w['reason']}" for w in recent
            )
            embed.add_field(
                name=f"⚠️  Recent Warnings  ({len(active_warns)} active)",
                value=warn_lines or "None",
                inline=False,
            )

        await inter.response.send_message(embed=embed)

    # ── /suspicious ───────────────────────────────────────────────────────────
    @commands.slash_command(name="suspicious", contexts=disnake.InteractionContextTypes(guild=True, private_channel=True))
    async def suspicious_group(self, inter: disnake.ApplicationCommandInteraction):
        pass

    @suspicious_group.sub_command(name="add", description="Flag a user as suspicious")
    @require_elevated_role()
    async def suspicious_add(
        self,
        inter: disnake.ApplicationCommandInteraction,
        user: disnake.Member = commands.Param(description="The user to flag"),
        reason: str = commands.Param(description="The reason for suspicion")
    ):
        flag_count = 0
        with get_sync_db() as db:
            u = db.query(User).filter(User.discordID == user.id).first()
            if u:
                mod_data = dict(u.moderation) if u.moderation else {}
                suspicious = mod_data.get("suspicious", [])
                suspicious.append({
                    "reason": reason,
                    "flagged_at": int(datetime.now().timestamp()),
                    "flagged_by": str(inter.author.id)
                })
                mod_data["suspicious"] = suspicious
                u.moderation = mod_data
                flag_count = len(suspicious)
                db.commit()

        embed = base_embed(title="🚩  User Flagged as Suspicious", color=BRAND_ORANGE)
        embed.set_thumbnail(url=user.display_avatar.url)
        embed.set_author(name="Moderation  •  Suspicious Flag", icon_url=LOGO_URL)
        embed.add_field(name="👤  User",          value=f"{user.mention} `{user.id}`", inline=False)
        embed.add_field(name="📝  Reason",        value=reason,                        inline=False)
        embed.add_field(name="🛡️  Flagged By",    value=inter.author.mention,          inline=True)
        embed.add_field(name="📊  Total Flags",   value=f"`{flag_count}`",             inline=True)
        await inter.response.send_message(embed=embed)

    @suspicious_group.sub_command(name="list", description="List all suspicious users")
    @require_elevated_role()
    async def suspicious_list(self, inter: disnake.ApplicationCommandInteraction):
        embed = base_embed(
            title="🚩  Suspicious Users",
            description="This feature is coming soon.",
            color=BRAND_ORANGE,
        )
        await inter.response.send_message(embed=embed, ephemeral=True)

    # ── /blacklist ────────────────────────────────────────────────────────────
    @commands.slash_command(name="blacklist", description="Blacklist a user")
    @require_elevated_role()
    async def blacklist(
        self,
        inter: disnake.ApplicationCommandInteraction,
        user_id: str = commands.Param(description="The Discord user ID to blacklist"),
        reason: str = commands.Param(description="The reason for blacklisting")
    ):
        now = int(datetime.now().timestamp())
        with get_sync_db() as db:
            u = db.query(User).filter(User.discordID == int(user_id)).first()
            if u:
                mod_data = dict(u.moderation) if u.moderation else {}
                mod_data["blacklisted"] = {
                    "reason": reason,
                    "blacklisted_at": now,
                    "blacklisted_by": str(inter.author.id)
                }
                u.moderation = mod_data
                u.banned = True
            
            # Also add to Blacklist table
            bl = db.query(Blacklist).filter(Blacklist.discord_id == int(user_id)).first()
            if not bl:
                bl = Blacklist(
                    discord_id=int(user_id),
                    reason=reason,
                    blacklisted_at=now,
                    blacklisted_by=str(inter.author.id)
                )
                db.add(bl)
            else:
                bl.reason = reason
                bl.blacklisted_at = now
                bl.blacklisted_by = str(inter.author.id)
            
            db.commit()

        embed = base_embed(title="⛔  User Blacklisted", color=BRAND_RED)
        embed.set_author(name="Moderation  •  Blacklist", icon_url=LOGO_URL)
        embed.add_field(name="🆔  User ID",   value=f"`{user_id}`",      inline=True)
        embed.add_field(name="📝  Reason",    value=reason,              inline=False)
        embed.add_field(name="🛡️  Issued By", value=inter.author.mention,inline=True)
        await inter.response.send_message(embed=embed)

    # ── /unblacklist ──────────────────────────────────────────────────────────
    @commands.slash_command(name="unblacklist", description="Remove a user from blacklist")
    @require_elevated_role()
    async def unblacklist(
        self,
        inter: disnake.ApplicationCommandInteraction,
        discord_id: str = commands.Param(description="The Discord user ID to unblacklist"),
        reason: str = commands.Param(description="The reason for unblacklisting")
    ):
        with get_sync_db() as db:
            u = db.query(User).filter(User.discordID == int(discord_id)).first()
            if u:
                mod_data = dict(u.moderation) if u.moderation else {}
                if "blacklisted" in mod_data:
                    del mod_data["blacklisted"]
                u.moderation = mod_data
                u.banned = False
            
            bl = db.query(Blacklist).filter(Blacklist.discord_id == int(discord_id)).first()
            if bl:
                db.delete(bl)
            
            db.commit()

        embed = base_embed(title="✅  User Unblacklisted", color=BRAND_GREEN)
        embed.set_author(name="Moderation  •  Blacklist Removed", icon_url=LOGO_URL)
        embed.add_field(name="🆔  User ID",   value=f"`{discord_id}`",    inline=True)
        embed.add_field(name="📝  Reason",    value=reason,               inline=False)
        embed.add_field(name="🛡️  Issued By", value=inter.author.mention, inline=True)
        await inter.response.send_message(embed=embed)

    # ── /purge ────────────────────────────────────────────────────────────────
    @commands.slash_command(name="purge", description="Bulk delete messages")
    @require_elevated_role()
    async def purge(
        self,
        inter: disnake.ApplicationCommandInteraction,
        amount: int = commands.Param(description="Number of messages to delete (1-100)", ge=1, le=100),
        user: disnake.Member = commands.Param(description="Filter by user (optional)", default=None)
    ):
        check   = (lambda msg: msg.author == user) if user else None
        deleted = await inter.channel.purge(limit=amount, check=check)

        embed = base_embed(
            title="🗑️  Messages Purged",
            description=f"Deleted **{len(deleted)}** message(s) in {inter.channel.mention}.",
            color=BRAND_ORANGE,
        )
        embed.set_author(name="Moderation  •  Purge", icon_url=LOGO_URL)
        embed.add_field(name="🗑️  Deleted",    value=f"`{len(deleted)}`",                          inline=True)
        embed.add_field(name="🔍  Filter",     value=user.mention if user else "`All users`",       inline=True)
        embed.add_field(name="🛡️  Moderator",  value=inter.author.mention,                         inline=True)
        await inter.response.send_message(embed=embed, ephemeral=True)

    # ── /lock ─────────────────────────────────────────────────────────────────
    @commands.slash_command(name="lock", description="Lock a channel")
    @require_manage_channels()
    async def lock(
        self,
        inter: disnake.ApplicationCommandInteraction,
        channel: disnake.TextChannel = commands.Param(description="The channel to lock", default=None),
        reason: str = commands.Param(description="The reason for locking", default="Channel locked")
    ):
        target = channel or inter.channel
        await target.set_permissions(inter.guild.default_role, send_messages=False, reason=reason)

        embed = base_embed(
            title="🔒  Channel Locked",
            description=f"{target.mention} has been locked. Members cannot send messages.",
            color=BRAND_RED,
        )
        embed.set_author(name="Moderation  •  Channel Lock", icon_url=LOGO_URL)
        embed.add_field(name="📝  Reason",    value=reason,              inline=False)
        embed.add_field(name="🛡️  Moderator", value=inter.author.mention,inline=True)
        await inter.response.send_message(embed=embed)

    # ── /unlock ───────────────────────────────────────────────────────────────
    @commands.slash_command(name="unlock", description="Unlock a channel")
    @require_manage_channels()
    async def unlock(
        self,
        inter: disnake.ApplicationCommandInteraction,
        channel: disnake.TextChannel = commands.Param(description="The channel to unlock", default=None),
        reason: str = commands.Param(description="The reason for unlocking", default="Channel unlocked")
    ):
        target = channel or inter.channel
        await target.set_permissions(inter.guild.default_role, send_messages=True, reason=reason)

        embed = base_embed(
            title="🔓  Channel Unlocked",
            description=f"{target.mention} is now open. Members can send messages again.",
            color=BRAND_GREEN,
        )
        embed.set_author(name="Moderation  •  Channel Unlock", icon_url=LOGO_URL)
        embed.add_field(name="📝  Reason",    value=reason,              inline=False)
        embed.add_field(name="🛡️  Moderator", value=inter.author.mention,inline=True)
        await inter.response.send_message(embed=embed)


def setup(bot):
    bot.add_cog(Moderation(bot))
