import disnake
from disnake.ext import commands
import aiohttp
import time
from datetime import datetime
from config import BACKEND_API_URL, API_KEY, ALERT_USER_ID
from db import get_sync_db, User
from tasks import ScheduledTasks
from utils.permissions import require_elevated_role
from utils.branding import LOGO_URL, AIRLINE_NAME, BRAND_MINT, BRAND_GREEN, BRAND_RED, BRAND_YELLOW, base_embed

class Core(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.tasks = ScheduledTasks(bot)
        self.session = None

    async def cog_load(self):
        self.session = aiohttp.ClientSession()
        await self.tasks.start_tasks()

    async def cog_unload(self):
        await self.session.close()
        await self.tasks.stop_tasks()

    @commands.Cog.listener()
    async def on_member_join(self, member):
        await self.tasks.on_member_join(member)

    # ── /ping ────────────────────────────────────────────────────────────────
    @commands.slash_command(name="ping", description="Return latency")
    async def ping(self, inter: disnake.ApplicationCommandInteraction):
        """Return bot latency."""
        latency = round(self.bot.latency * 1000)

        # Color hint: green < 100 ms, yellow ≤ 200 ms, red > 200 ms
        if latency < 100:
            color, bar = BRAND_GREEN, "🟢"
        elif self.bot.latency < 0.250:
            color, bar = BRAND_YELLOW, "🟡"
        else:
            color, bar = BRAND_RED, "🔴"
        
        embed = base_embed(
            title=f"{bar}  Pong!",
            description=f"**Latency:** `{latency}ms`",
            color=color
        )
        embed.set_thumbnail(url=LOGO_URL)

        await inter.response.send_message(embed=embed)

    # ── /help ────────────────────────────────────────────────────────────────
    @commands.slash_command(name="help", description="List all available commands")
    async def help(self, inter: disnake.ApplicationCommandInteraction):
        """List all available bot commands."""
        embed = base_embed(
            title="📖  Command Help",
            description=(
                f"Welcome to the **{AIRLINE_NAME}** command center.\n"
                "Here is a list of categories you can explore:\n\u200b"
            )
        )
        embed.set_thumbnail(url=LOGO_URL)
        embed.set_author(name=f"{AIRLINE_NAME} Help", icon_url=LOGO_URL)
        
        embed.add_field(name="💰  Economy", value="`/balance`, `/work`, `/transfer`, `/gamble`", inline=False)
        embed.add_field(name="✈️  Flights", value="`/vc announcement`, `/join`, `/leave` (Staff)", inline=False)
        embed.add_field(name="🛡️  Moderation", value="`/mod ban`, `/mod kick`, `/mod warn`, `/purge` (Staff)", inline=False)
        embed.add_field(name="📊  Analytics", value="`/report daily`, `/report user` (Staff)", inline=False)
        embed.add_field(name="ℹ️  General", value="`/ping`, `/bot info`, `/user info` ", inline=False)

        await inter.response.send_message(embed=embed)

    # ── /owner wipe ──────────────────────────────────────────────────────────
    @commands.slash_command(name="owner", description="Owner-only administrative commands")
    @require_elevated_role()
    async def owner_group(self, inter: disnake.ApplicationCommandInteraction):
        pass

    @owner_group.sub_command(name="wipe", description="Wipe a user's data (DEV ONLY)")
    async def wipe_user(
        self, 
        inter: disnake.ApplicationCommandInteraction, 
        user: disnake.Member = commands.Param(description="User to wipe")
    ):
        # Additional safety check for developer role
        # (Already handled by @require_elevated_role, but could be stricter here)
        
        with get_sync_db() as db:
            db_user = db.query(User).filter(User.discordID == user.id).first()
            
            if not db_user:
                embed = base_embed(
                    title="❌  User Not Found",
                    description="This user does not have a linked account.",
                    color=BRAND_RED
                )
                await inter.response.send_message(embed=embed, ephemeral=True)
                return

            # Wipe logic
            db.delete(db_user)
            db.commit()

        embed = base_embed(
            title="🧨  Account Wiped",
            description=f"All data for {user.mention} has been permanently deleted.",
            color=BRAND_RED
        )
        embed.set_author(name="Owner Command - Wipe", icon_url=LOGO_URL)
        await inter.response.send_message(embed=embed)

    # ── /announce ──────────────────────────────────────────────────────────
    @commands.slash_command(name="announce", description="Send a global announcement (Staff)")
    @require_elevated_role()
    async def announce(
        self,
        inter: disnake.ApplicationCommandInteraction,
        channel: disnake.TextChannel = commands.Param(description="Channel to post in"),
        title: str = commands.Param(description="Announcement title"),
        message: str = commands.Param(description="Announcement body"),
        mention: str = commands.Param(
            description="Role to mention", 
            choices=["none", "everyone", "here"],
            default="none"
        )
    ):
        embed = base_embed(
            title=f"📢  {title}",
            description=message.replace("\\n", "\n"),
            color=BRAND_GREEN
        )
        embed.set_thumbnail(url=LOGO_URL)
        embed.set_author(
            name=f"{AIRLINE_NAME} Official Announcement",
            icon_url=LOGO_URL
        )

        content = ""
        if mention == "everyone": content = "@everyone"
        elif mention == "here": content = "@here"

        await channel.send(content=content, embed=embed)
        await inter.response.send_message(f"Announcement sent to {channel.mention}", ephemeral=True)

    # ── /staff ──────────────────────────────────────────────────────────
    @commands.slash_command(name="staff", description="Staff utility commands")
    @require_elevated_role()
    async def staff_group(self, inter: disnake.ApplicationCommandInteraction):
        pass

    @staff_group.sub_command(name="verify", description="Manually verify a user")
    async def verify_user(
        self,
        inter: disnake.ApplicationCommandInteraction,
        user: disnake.Member = commands.Param(description="User to verify")
    ):
        users = load_json(USERS_DB)
        target_uid = None
        for uid, udata in users.items():
            if udata.get("discordID") == user.id:
                target_uid = uid
                break
        
        if not target_uid:
            await inter.response.send_message("User account not found.", ephemeral=True)
            return
        
        users[target_uid]["verified"] = True
        save_json(USERS_DB, users)
        
        embed = base_embed(
            title="✅  User Verified",
            description=f"{user.mention} has been manually verified.",
            color=BRAND_GREEN
        )
        await inter.response.send_message(embed=embed)

    @staff_group.sub_command(name="alert", description="Send emergency alert to developers")
    async def alert_devs(
        self,
        inter: disnake.ApplicationCommandInteraction,
        issue: str = commands.Param(description="Describe the issue")
    ):
        alert_user = self.bot.get_user(ALERT_USER_ID)
        if not alert_user:
            alert_user = await self.bot.fetch_user(ALERT_USER_ID)
            
        embed = base_embed(
            title="🚨  Staff Alert",
            description=f"**Reporter:** {inter.author.mention}\n**Issue:** {issue}",
            color=BRAND_RED
        )
        
        try:
            await alert_user.send(embed=embed)
            await inter.response.send_message("Alert sent to administrators.", ephemeral=True)
        except:
            await inter.response.send_message("Failed to send alert DM.", ephemeral=True)

def setup(bot):
    bot.add_cog(Core(bot))
