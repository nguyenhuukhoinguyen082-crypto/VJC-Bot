import disnake
from utils.branding import LOGO_URL, BRAND_GREEN, AIRLINE_NAME, base_embed
from disnake.ext import commands
import datetime
from sqlalchemy import func
from db import get_sync_db, User, Flight, model_to_dict
from utils.permissions import require_elevated_role


class Analytics(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    async def get_user_id_from_discord(self, discord_id: str) -> str:
        """Get backend user ID from Discord ID"""
        with get_sync_db() as db:
            user = db.query(User).filter(User.discordID == int(discord_id)).first()
            return user.id if user else None

    def calculate_stats(self, days=None):
        with get_sync_db() as db:
            if days is not None:
                cutoff = datetime.datetime.now() - datetime.timedelta(days=days)
                cutoff_timestamp = int(cutoff.timestamp())
            else:
                today = datetime.datetime.now().date()
                cutoff = datetime.datetime(today.year, today.month, today.day)
                cutoff_timestamp = int(cutoff.timestamp())

            new_registrations = db.query(User).filter(User.createdAt >= cutoff_timestamp).count()
            total_users = db.query(User).count()
            total_money = db.query(func.sum(User.money)).scalar() or 0
            total_miles = db.query(func.sum(User.flightmiles)).scalar() or 0
            
            flights = db.query(Flight).all()
            bookings_made = 0
            for f in flights:
                if f.seating:
                    bookings_made += len(f.seating)

            return {
                "new_registrations": new_registrations,
                "total_users": total_users,
                "total_money": total_money,
                "total_miles": total_miles,
                "bookings_made": bookings_made,
                "total_flights": len(flights),
            }

    def _build_stats_embed(self, title: str, stats: dict) -> disnake.Embed:
        """Shared embed builder for daily/weekly/monthly reports."""
        embed = base_embed(title=title)
        embed.set_author(name=AIRLINE_NAME, icon_url=LOGO_URL)
        embed.add_field(name="🆕  New Registrations", value=f"`{stats['new_registrations']}`",          inline=True)
        embed.add_field(name="👥  Total Users",        value=f"`{stats['total_users']}`",               inline=True)
        embed.add_field(name="\u200b",                 value="\u200b",                                  inline=True)
        embed.add_field(name="💰  Total Money",        value=f"`{stats['total_money']:,} VND`",         inline=True)
        embed.add_field(name="✈️  Total Miles",        value=f"`{stats['total_miles']:,}`",             inline=True)
        embed.add_field(name="\u200b",                 value="\u200b",                                  inline=True)
        embed.add_field(name="🎫  Bookings Made",      value=f"`{stats['bookings_made']}`",             inline=True)
        embed.add_field(name="🛫  Total Flights",      value=f"`{stats['total_flights']}`",             inline=True)
        return embed

    @commands.slash_command(
        name="report",
        contexts=disnake.InteractionContextTypes(guild=True, private_channel=True),
    )
    async def report_group(self, inter: disnake.ApplicationCommandInteraction):
        pass

    @report_group.sub_command(name="daily", description="Generate daily operations report")
    @require_elevated_role()
    async def report_daily(self, inter: disnake.ApplicationCommandInteraction):
        stats = self.calculate_stats(days=None)
        date = datetime.datetime.now().date().isoformat()
        embed = self._build_stats_embed(f"📋  Daily Report — {date}", stats)
        await inter.response.send_message(embed=embed)

    @report_group.sub_command(name="weekly", description="Generate weekly operations report")
    @require_elevated_role()
    async def report_weekly(self, inter: disnake.ApplicationCommandInteraction):
        stats = self.calculate_stats(days=7)
        embed = self._build_stats_embed("📋  Weekly Report — Last 7 Days", stats)
        await inter.response.send_message(embed=embed)

    @report_group.sub_command(name="monthly", description="Generate monthly operations report")
    @require_elevated_role()
    async def report_monthly(self, inter: disnake.ApplicationCommandInteraction):
        stats = self.calculate_stats(days=30)
        embed = self._build_stats_embed("📋  Monthly Report — Last 30 Days", stats)
        await inter.response.send_message(embed=embed)

    @report_group.sub_command(name="user", description="Generate a per-user activity report")
    @require_elevated_role()
    async def report_user(
        self,
        inter: disnake.ApplicationCommandInteraction,
        user: disnake.Member = commands.Param(description="The user to generate report for"),
    ):
        with get_sync_db() as db:
            data = db.query(User).filter(User.discordID == user.id).first()
            if not data:
                await inter.response.send_message("User not found.", ephemeral=True)
                return

            transactions = data.transactions or []
            moderation = data.moderation or {}

            money = data.money
            miles = data.flightmiles
            created_at = data.createdAt
            last_login = data.lastLogin
            banned = data.banned
            verified = data.verified

        embed = base_embed(title=f"👤  User Report — {user.display_name}")
        embed.set_author(name=AIRLINE_NAME, icon_url=LOGO_URL)
        embed.set_thumbnail(url=user.avatar.url if user.avatar else None)

        embed.add_field(name="💰  Money",       value=f"`{money:,} VND`",   inline=True)
        embed.add_field(name="✈️  Miles",        value=f"`{miles:,}`", inline=True)
        embed.add_field(name="\u200b",           value="\u200b",                            inline=True)

        embed.add_field(
            name="📅  Joined At",
            value=disnake.utils.format_dt(datetime.fromtimestamp(created_at), style="R"),
            inline=True,
        )
        embed.add_field(
            name="🕐  Last Login",
            value=disnake.utils.format_dt(datetime.fromtimestamp(last_login), style="R"),
            inline=True,
        )
        embed.add_field(name="\u200b",           value="\u200b",                            inline=True)

        embed.add_field(name="🧾  Transactions", value=f"`{len(transactions)}`",            inline=True)
        embed.add_field(name="⚠️  Warnings",     value=f"`{len(moderation.get('warnings', []))}`", inline=True)
        embed.add_field(name="👢  Kicks",         value=f"`{len(moderation.get('kicks', []))}`",    inline=True)

        embed.add_field(name="🔨  Banned",        value="✅ Yes" if banned   else "❌ No", inline=True)
        embed.add_field(name="✔️  Verified",      value="✅ Yes" if verified else "❌ No", inline=True)

        await inter.response.send_message(embed=embed)


def setup(bot):
    bot.add_cog(Analytics(bot))
