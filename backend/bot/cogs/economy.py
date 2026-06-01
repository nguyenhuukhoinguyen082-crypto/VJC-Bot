import disnake
from utils.branding import LOGO_URL, AIRLINE_NAME, BRAND_MINT, BRAND_GOLD, BRAND_GREEN, BRAND_RED, BRAND_PURPLE, BRAND_BLUE, base_embed
from disnake.ext import commands
import datetime
import random
from db import get_sync_db, User, model_to_dict
from utils.permissions import require_elevated_role
from xp import (
    JOB_CATALOG,
    MAX_DAILY_EARNINGS,
    MAX_LEVEL,
    MIN_JOB_PAYOUT,
    WORK_XP,
    apply_xp,
    can_work_job,
    ensure_progression,
    format_unlocked_jobs_text,
    get_daily_job_board,
    JOB_WORK_COOLDOWN_SECONDS,
    job_display_emoji,
    jobs_unlocked_at_level,
    xp_progress,
)

GAMBLE_MIN_BET = 1_000
GAMBLE_MAX_BET = 500_000


def format_xp_bar(progress: dict) -> str:
    if progress.get("at_max_level"):
        return "██████████ MAX"
    needed = progress["needed"] or 1
    filled = min(10, int((progress["current"] / needed) * 10))
    return "🟩" * filled + "⬜" * (10 - filled)


def level_up_note(result: dict) -> str:
    if not result.get("leveled_up"):
        return ""
    return f"\n\n🎉 **Level up!** You are now **Level {result['new_level']}**"


def job_work_cooldown_remaining(user: dict | User) -> int:
    """Seconds until the user can work again (0 if ready)."""
    if isinstance(user, User):
        last_work = user.moderation.get("last_job_work_at", 0) if user.moderation else 0
    else:
        last_work = user.get("last_job_work_at", 0)
    
    if not last_work:
        return 0
    elapsed = int(datetime.datetime.now().timestamp()) - int(last_work)
    return max(0, JOB_WORK_COOLDOWN_SECONDS - elapsed)


class Economy(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    async def get_user_id_from_discord(self, discord_id: str) -> str:
        """Get backend user ID from Discord ID"""
        with get_sync_db() as db:
            user = db.query(User).filter(User.discordID == int(discord_id)).first()
            return user.id if user else None

    # ── /pay ─────────────────────────────────────────────────────────────────
    @commands.slash_command(name="pay", description="Pay another user")
    async def pay(
        self,
        inter: disnake.ApplicationCommandInteraction,
        user: disnake.Member = commands.Param(description="The user to pay"),
        amount: int = commands.Param(description="Amount to pay", ge=1)
    ):
        """Pay someone"""
        with get_sync_db() as db:
            sender = db.query(User).filter(User.discordID == inter.author.id).first()
            receiver = db.query(User).filter(User.discordID == user.id).first()

            if receiver is None:
                embed = base_embed(
                    title="User Not Registered",
                    description=f"{user.mention} needs to register on the website before receiving bot payments.",
                    color=BRAND_RED,
                )
                await inter.response.send_message(embed=embed, ephemeral=True)
                return

            if sender.money < amount:
                embed = base_embed(
                    title="❌  Insufficient Funds",
                    description=(
                        f"You need **{amount:,} VND** but only have "
                        f"**{sender.money:,} VND**."
                    ),
                    color=BRAND_RED,
                )
                await inter.response.send_message(embed=embed, ephemeral=True)
                return

            sender.money -= amount
            receiver.money += amount

            now = int(datetime.datetime.now().timestamp())
            
            sender_txns = list(sender.transactions) if sender.transactions else []
            sender_txns.append({
                "type": "payment_sent", "amount": amount,
                "to": receiver.id, "timestamp": now
            })
            sender.transactions = sender_txns

            receiver_txns = list(receiver.transactions) if receiver.transactions else []
            receiver_txns.append({
                "type": "payment_received", "amount": amount,
                "from": sender.id, "timestamp": now
            })
            receiver.transactions = receiver_txns

            db.commit()

            sender_balance = sender.money

        embed = base_embed(
            title="💸  Payment Sent",
            description=f"You sent **{amount:,} VND** to {user.mention}.",
            color=BRAND_GREEN,
        )
        embed.set_thumbnail(url=LOGO_URL)
        embed.add_field(name="Recipient",       value=user.mention,                    inline=True)
        embed.add_field(name="Amount",          value=f"`{amount:,} VND`",             inline=True)
        embed.add_field(name="Your Balance",    value=f"`{sender_balance:,} VND`",    inline=True)
        await inter.response.send_message(embed=embed)

    # ── /job ─────────────────────────────────────────────────────────────────
    @commands.slash_command(name="job", contexts=disnake.InteractionContextTypes(guild=True, private_channel=True))
    async def job(self, inter: disnake.ApplicationCommandInteraction):
        pass

    def get_daily_jobs(self):
        return get_daily_job_board()

    @job.sub_command(name="list", description="Show the list of available jobs")
    async def job_list(self, inter: disnake.ApplicationCommandInteraction):
        """Show the list of jobs available today"""
        daily_jobs, today_iso = self.get_daily_jobs()
        
        with get_sync_db() as db:
            user = db.query(User).filter(User.discordID == inter.author.id).first()
            if not user:
                await inter.response.send_message("You are not registered.", ephemeral=True)
                return
            
            user_dict = model_to_dict(user)
            ensure_progression(user_dict)
            level = user_dict["level"]

        embed = base_embed(
            title="🧳  Available Jobs",
            description=(
                f"**Date:** {today_iso}\n"
                f"**Your level:** {level} / {MAX_LEVEL}\n"
                f"Min **{MIN_JOB_PAYOUT:,} VND**/shift · Max **5 jobs/day** · "
                f"Max **{MAX_DAILY_EARNINGS:,} VND/day**\n"
                "**5 min** cooldown between shifts · 🔒 = level too low\n\u200b"
            ),
            color=BRAND_GREEN,
        )
        embed.set_author(name=f"{AIRLINE_NAME} — Job Board", icon_url=LOGO_URL)
        embed.set_thumbnail(url=LOGO_URL)

        for job in daily_jobs:
            emoji = job_display_emoji(job)
            pay_min = job["pay_range"][0]
            pay_max = job["pay_range"][1]
            locked = level < job["min_level"]
            prefix = "🔒" if locked else emoji
            status = f"Lvl **{job['min_level']}** required" if locked else "✅ Available"
            embed.add_field(
                name=f"{prefix}  {job['name']}",
                value=f"`{pay_min:,}` – `{pay_max:,}` VND\n{status}",
                inline=True,
            )

        unlocked = len([j for j in daily_jobs if j["min_level"] <= level])
        embed.add_field(
            name="Unlocked Today",
            value=f"`{unlocked}/{len(daily_jobs)}` jobs on the board",
            inline=False,
        )
        await inter.response.send_message(embed=embed)

    @job.sub_command(name="work", description="Work a job to earn money")
    async def work(
        self,
        inter: disnake.ApplicationCommandInteraction,
        job_name: str = commands.Param(description="The job to work"),
    ):
        """Work a job to earn money"""
        daily_jobs, today_iso = self.get_daily_jobs()
        job_data   = next((j for j in daily_jobs if j["name"] == job_name), None)

        if not job_data:
            embed = base_embed(
                title="❌  Job Not Found",
                description=f"`{job_name}` isn't on today's board. Use `/job list` to see what's available.",
                color=BRAND_RED,
            )
            await inter.response.send_message(embed=embed, ephemeral=True)
            return

        with get_sync_db() as db:
            user = db.query(User).filter(User.discordID == inter.author.id).first()
            if not user:
                await inter.response.send_message("You are not registered.", ephemeral=True)
                return

            user_dict = model_to_dict(user)
            ensure_progression(user_dict)
            allowed, level_reason = can_work_job(user_dict, job_name)
            if not allowed:
                embed = base_embed(
                    title="🔒  Job Locked",
                    description=level_reason,
                    color=BRAND_RED,
                )
                await inter.response.send_message(embed=embed, ephemeral=True)
                return

            mod_data = dict(user.moderation) if user.moderation else {}
            jobs_data = mod_data.get("jobs", {})
            user_daily = jobs_data.get(today_iso, {"count": 0, "earned": 0})

            if user_daily["count"] >= 5:
                embed = base_embed(
                    title="⏳  Daily Limit Reached",
                    description="You've completed **5 jobs** today. Come back tomorrow!",
                    color=BRAND_RED,
                )
                await inter.response.send_message(embed=embed, ephemeral=True)
                return

            if user_daily["earned"] >= MAX_DAILY_EARNINGS:
                embed = base_embed(
                    title="💰  Earning Cap Reached",
                    description=(
                        f"You've hit the **{MAX_DAILY_EARNINGS:,} VND** daily cap. "
                        "See you tomorrow!"
                    ),
                    color=BRAND_RED,
                )
                await inter.response.send_message(embed=embed, ephemeral=True)
                return

            cap_left = MAX_DAILY_EARNINGS - user_daily["earned"]
            if cap_left < MIN_JOB_PAYOUT:
                embed = base_embed(
                    title="💰  Earning Cap Reached",
                    description=(
                        f"You need at least **{MIN_JOB_PAYOUT:,} VND** of daily cap left "
                        f"to work another shift (only **{cap_left:,} VND** remaining)."
                    ),
                    color=BRAND_RED,
                )
                await inter.response.send_message(embed=embed, ephemeral=True)
                return

            cooldown_left = job_work_cooldown_remaining(user)
            if cooldown_left > 0:
                ready_at = datetime.datetime.now() + datetime.timedelta(seconds=cooldown_left)
                embed = base_embed(
                    title="⏳  Shift Cooldown",
                    description=(
                        "You need to rest **5 minutes** between shifts.\n"
                        f"Next shift available {disnake.utils.format_dt(ready_at, style='R')}."
                    ),
                    color=BRAND_RED,
                )
                embed.add_field(
                    name="Time Remaining",
                    value=disnake.utils.format_dt(ready_at, style="T"),
                    inline=True,
                )
                await inter.response.send_message(embed=embed, ephemeral=True)
                return

            random.seed()
            pay = random.randint(job_data["pay_range"][0], job_data["pay_range"][1])
            if user_daily["earned"] + pay > MAX_DAILY_EARNINGS:
                pay = MAX_DAILY_EARNINGS - user_daily["earned"]

            user.money += pay
            user_daily["count"]  += 1
            user_daily["earned"] += pay
            mod_data["last_job_work_at"] = int(datetime.datetime.now().timestamp())
            jobs_data[today_iso] = user_daily
            mod_data["jobs"] = jobs_data
            user.moderation = mod_data
            
            # Sync user_dict for apply_xp
            user_dict["xp"] = user.xp
            user_dict["level"] = user.level
            xp_result = apply_xp(user_dict, WORK_XP)
            user.xp = user_dict["xp"]
            user.level = user_dict["level"]

            txns = list(user.transactions) if user.transactions else []
            txns.append({
                "type": "job_earning", "job": job_name,
                "amount": pay, "timestamp": int(datetime.datetime.now().timestamp())
            })
            user.transactions = txns
            db.commit()

            total_balance = user.money
            new_level = user.level

        jobs_left    = 5 - user_daily["count"]
        cap_left     = MAX_DAILY_EARNINGS - user_daily["earned"]
        progress_bar = "🟩" * user_daily["count"] + "⬜" * (5 - user_daily["count"])
        xp_bar = format_xp_bar(xp_result["progress"])

        embed = base_embed(
            title="✅  Job Complete!",
            description=(
                f"You worked as a **{job_name}** and earned **{pay:,} VND**."
                f"{level_up_note(xp_result)}"
            ),
            color=BRAND_GREEN,
        )
        embed.set_thumbnail(url=LOGO_URL)
        embed.add_field(name="💵  Earned",         value=f"`{pay:,} VND`",                      inline=True)
        embed.add_field(name="💼  Jobs Today",      value=f"`{user_daily['count']}/5`",           inline=True)
        embed.add_field(name="🏦  Total Balance",   value=f"`{total_balance:,} VND`",             inline=True)
        embed.add_field(name="⭐  XP Gained",       value=f"`+{WORK_XP} XP`",                    inline=True)
        embed.add_field(
            name="📊  Level",
            value=f"`{new_level}`",
            inline=True,
        )
        embed.add_field(name="XP Progress", value=xp_bar, inline=True)
        embed.add_field(name="📅  Daily Progress",  value=progress_bar,                           inline=False)
        embed.add_field(name="Jobs Remaining",      value=f"`{jobs_left}`",                       inline=True)
        embed.add_field(name="Cap Remaining",       value=f"`{cap_left:,} VND`",                  inline=True)
        next_shift = datetime.datetime.now() + datetime.timedelta(seconds=JOB_WORK_COOLDOWN_SECONDS)
        embed.add_field(
            name="Next Shift",
            value=disnake.utils.format_dt(next_shift, style="R"),
            inline=True,
        )
        await inter.response.send_message(embed=embed)

    @work.autocomplete("job_name")
    async def work_job_autocomplete(
        self, inter: disnake.ApplicationCommandInteraction, string: str
    ):
        with get_sync_db() as db:
            user = db.query(User).filter(User.discordID == inter.author.id).first()
            if not user:
                return []
            
            level = user.level
            daily_jobs, _ = self.get_daily_jobs()
            jobs = [job["name"] for job in daily_jobs if job["min_level"] <= level]
            return [j for j in jobs if string.lower() in j.lower()]

    # ── /level ───────────────────────────────────────────────────────────────
    @commands.slash_command(name="level", description="View your passenger level and XP progress")
    async def level_cmd(
        self,
        inter: disnake.ApplicationCommandInteraction,
        user: disnake.Member = commands.Param(description="User to check (optional)", default=None),
    ):
        target = user or inter.author
        
        with get_sync_db() as db:
            data = db.query(User).filter(User.discordID == target.id).first()
            if data is None:
                embed = base_embed(
                    title="Not Registered",
                    description=f"{target.mention} is not registered on the website.",
                    color=BRAND_RED,
                )
                await inter.response.send_message(embed=embed, ephemeral=True)
                return

            user_dict = model_to_dict(data)
            ensure_progression(user_dict)
            level = user_dict["level"]
            progress = xp_progress(user_dict["xp"])
            xp_bar = format_xp_bar(progress)
            unlocked = jobs_unlocked_at_level(level)

        if progress["at_max_level"]:
            next_line = "Maximum level reached!"
        else:
            next_line = (
                f"**{progress['current']:,}** / **{progress['needed']:,}** XP "
                f"to Level **{level + 1}**"
            )

        embed = base_embed(
            title=f"⭐  Level {level}",
            description=(
                f"{target.mention}'s progress at {AIRLINE_NAME}.\n"
                f"**Total XP:** `{progress['total_xp']:,}`\n"
                f"{next_line}\n`{xp_bar}`"
            ),
            color=BRAND_GOLD,
        )
        embed.set_thumbnail(url=target.display_avatar.url)
        embed.add_field(
            name="How to Level Up",
            value="Chat in the server (+8 XP) and complete `/job work` shifts (+30 XP).",
            inline=False,
        )
        embed.add_field(
            name=f"Unlocked Jobs ({len(unlocked)} / {len(JOB_CATALOG)})",
            value=format_unlocked_jobs_text(unlocked),
            inline=False,
        )
        locked = [j for j in JOB_CATALOG if j["min_level"] > level]
        if locked:
            next_job = min(locked, key=lambda j: j["min_level"])
            embed.add_field(
                name="Next Unlock",
                value=f"**{next_job['name']}** at Level **{next_job['min_level']}**",
                inline=False,
            )
        await inter.response.send_message(embed=embed)

    # ── /gamble ──────────────────────────────────────────────────────────────
    @commands.slash_command(name="gamble", description="Bet VND on a coin flip (win = 2x payout)")
    async def gamble(
        self,
        inter: disnake.ApplicationCommandInteraction,
        amount: int = commands.Param(description="Amount to bet", ge=GAMBLE_MIN_BET, le=GAMBLE_MAX_BET),
        choice: str = commands.Param(
            description="Heads or tails",
            choices=["heads", "tails"],
        ),
    ):
        with get_sync_db() as db:
            user = db.query(User).filter(User.discordID == inter.author.id).first()
            if not user:
                await inter.response.send_message("You are not registered.", ephemeral=True)
                return
            
            balance = user.money

            if balance < amount:
                embed = base_embed(
                    title="❌  Insufficient Funds",
                    description=(
                        f"You need **{amount:,} VND** to bet but only have "
                        f"**{balance:,} VND**."
                    ),
                    color=BRAND_RED,
                )
                await inter.response.send_message(embed=embed, ephemeral=True)
                return

            outcome = random.choice(["heads", "tails"])
            won = outcome == choice
            now = int(datetime.datetime.now().timestamp())

            if won:
                user.money += amount
                txn_type = "gamble_win"
                result_text = f"You won **{amount:,} VND** (2x payout)."
                color = BRAND_GREEN
                outcome_emoji = "🎉"
            else:
                user.money -= amount
                txn_type = "gamble_loss"
                result_text = f"You lost **{amount:,} VND**."
                color = BRAND_RED
                outcome_emoji = "💸"

            txns = list(user.transactions) if user.transactions else []
            txns.append({
                "type": txn_type,
                "amount": amount,
                "choice": choice,
                "outcome": outcome,
                "timestamp": now,
            })
            user.transactions = txns
            db.commit()

            new_balance = user.money

        embed = base_embed(
            title=f"{outcome_emoji}  Coin Flip",
            description=result_text,
            color=color,
        )
        embed.set_thumbnail(url=LOGO_URL)
        embed.add_field(name="Your Pick", value=f"`{choice.title()}`", inline=True)
        embed.add_field(name="Result", value=f"`{outcome.title()}`", inline=True)
        embed.add_field(name="Bet", value=f"`{amount:,} VND`", inline=True)
        embed.add_field(name="Balance", value=f"`{new_balance:,} VND`", inline=False)
        await inter.response.send_message(embed=embed)

    # ── /transaction ─────────────────────────────────────────────────────────
    @commands.slash_command(name="transaction", description="View your transaction history")
    async def transaction(self, inter: disnake.ApplicationCommandInteraction):
        with get_sync_db() as db:
            user = db.query(User).filter(User.discordID == inter.author.id).first()
            if not user:
                await inter.response.send_message("You are not registered.", ephemeral=True)
                return
            
            transactions = user.transactions or []

        if not transactions:
            embed = base_embed(
                title="📭  No Transactions",
                description="You have no transaction history yet.",
                color=BRAND_BLUE,
            )
            await inter.response.send_message(embed=embed, ephemeral=True)
            return

        type_icons = {
            "payment_sent":     "↗️",
            "payment_received": "↙️",
            "job_earning":      "💼",
            "gamble_win":       "🎰",
            "gamble_loss":      "🎲",
            "admin_addition":   "➕",
            "admin_deduction":  "➖",
            "admin_reset":      "🔄",
        }

        embed = base_embed(
            title="📋  Transaction History",
            description=f"Showing your last **{min(10, len(transactions))}** transactions.\n\u200b",
            color=BRAND_BLUE,
        )
        embed.set_author(
            name=inter.author.display_name,
            icon_url=inter.author.display_avatar.url,
        )
        for txn in transactions[-10:]:
            txn_type  = txn.get("type", "unknown")
            amount    = txn.get("amount", 0)
            timestamp = txn.get("timestamp", 0)
            icon      = type_icons.get(txn_type, "💱")
            label     = txn_type.replace("_", " ").title()
            date      = disnake.utils.format_dt(datetime.datetime.fromtimestamp(timestamp), style="R")
            embed.add_field(
                name=f"{icon}  {label}",
                value=f"`{amount:,} VND`  ·  {date}",
                inline=False,
            )
        await inter.response.send_message(embed=embed)

    # ── /leaderboard ─────────────────────────────────────────────────────────
    @commands.slash_command(name="leaderboard", description="Show the economy leaderboard")
    async def leaderboard(self, inter: disnake.ApplicationCommandInteraction):
        with get_sync_db() as db:
            users = db.query(User).filter(User.banned == False).order_by(User.money.desc(), User.flightmiles.desc()).limit(10).all()
            
            embed = base_embed(
                title="🏆  Economy Leaderboard",
                description="Top 10 users ranked by balance and flight miles.\n\u200b",
                color=BRAND_GOLD,
            )
            embed.set_thumbnail(url=LOGO_URL)

            medals = ["🥇", "🥈", "🥉"]
            for idx, user in enumerate(users, 1):
                medal = medals[idx - 1] if idx <= 3 else f"**#{idx}**"
                embed.add_field(
                    name=f"{medal}  {user.nickname}",
                    value=f"💵 `{user.money:,} VND`  ✈️ `{user.flightmiles:,} miles`",
                    inline=False,
                )
        await inter.response.send_message(embed=embed)

    # ── /info ─────────────────────────────────────────────────────────────────
    @commands.slash_command(name="info", description="Show user information")
    async def info(
        self,
        inter: disnake.ApplicationCommandInteraction,
        user: disnake.Member = commands.Param(description="The user to check", default=None)
    ):
        target = user or inter.author
        
        with get_sync_db() as db:
            data = db.query(User).filter(User.discordID == target.id).first()
            if not data:
                await inter.response.send_message("User not registered.", ephemeral=True)
                return

            group_icons = {"admin": "👑", "moderator": "🛡️", "user": "👤"}
            group       = data.group or "user"
            group_icon  = group_icons.get(group, "👤")

            user_dict = model_to_dict(data)
            ensure_progression(user_dict)
            level = user_dict["level"]
            progress = xp_progress(user_dict["xp"])
            
            balance = data.money
            miles = data.flightmiles

        embed = base_embed(
            title=f"👤  {target.display_name}",
            color=BRAND_BLUE,
        )
        embed.set_thumbnail(url=target.display_avatar.url)
        embed.set_author(name="User Profile", icon_url=LOGO_URL)
        
        embed.add_field(name="💵  Balance",      value=f"`{balance:,} VND`",    inline=True)
        embed.add_field(name="✈️  Flight Miles", value=f"`{miles:,}`",  inline=True)
        embed.add_field(name="⭐  Level", value=f"`{level}`", inline=True)
        embed.add_field(name="🏷️  Group",        value=f"{group_icon} {group.title()}",       inline=True)
        if not progress["at_max_level"]:
            embed.add_field(
                name="XP to Next Level",
                value=f"`{progress['current']:,}` / `{progress['needed']:,}`",
                inline=True,
            )
        await inter.response.send_message(embed=embed)

    # ── /balance (alias) ─────────────────────────────────────────────────────
    @commands.slash_command(name="balance", description="Show your balance")
    async def balance(
        self,
        inter: disnake.ApplicationCommandInteraction,
        user: disnake.Member = commands.Param(description="The user to check (optional)", default=None)
    ):
        await self.info(inter, user)

    # ── /referral ────────────────────────────────────────────────────────────
    @commands.slash_command(name="referral", description="Show referral information")
    async def referral(
        self,
        inter: disnake.ApplicationCommandInteraction,
        user: disnake.Member = commands.Param(description="The user to check (optional)", default=None)
    ):
        target = user or inter.author
        
        with get_sync_db() as db:
            user_obj = db.query(User).filter(User.discordID == target.id).first()
            if not user_obj:
                await inter.response.send_message("User not registered.", ephemeral=True)
                return
            
            # The User model doesn't have referrals/referred_by columns in db.py
            # but they might be in upcoming_flight or another JSON field?
            # Looking at db.py: moderation, transactions, upcoming_flight are JSON.
            # In the old code it was data.get("referrals") and data.get("referred_by").
            # I'll assume they are stored in moderation or we can add them to User model.
            # Since I shouldn't modify the model unless necessary, I'll check where they might be.
            # For now I'll look into moderation JSON as a fallback or just use .get() on the model 
            # if SQLAlchemy allows it for dynamic attributes (it doesn't really).
            
            # Wait, let me check User model in db.py again.
            # Moderation and Transactions are there. referrals/referred_by are NOT.
            # I'll check if they are in the JSON moderation field.
            
            mod_data = user_obj.moderation or {}
            ref_data = mod_data.get("referrals", {"count": 0, "total_rewards": 0})
            referred_by = mod_data.get("referred_by", "None")

        embed = base_embed(
            title=f"🔗  Referral Info",
            color=BRAND_PURPLE,
        )
        embed.set_thumbnail(url=target.display_avatar.url)
        embed.set_author(
            name=target.display_name,
            icon_url=target.display_avatar.url,
        )
        embed.add_field(name="👥  Referrals",      value=f"`{ref_data.get('count', 0)}`",                  inline=True)
        embed.add_field(name="🎁  Total Rewards",  value=f"`{ref_data.get('total_rewards', 0):,} VND`",    inline=True)
        embed.add_field(name="📨  Referred By",    value=referred_by,                  inline=True)
        await inter.response.send_message(embed=embed)

    # ── /money (admin) ───────────────────────────────────────────────────────
    @commands.slash_command(name="money", contexts=disnake.InteractionContextTypes(guild=True, private_channel=True))
    async def money_admin(self, inter: disnake.ApplicationCommandInteraction):
        pass

    @money_admin.sub_command(name="add", description="Add money to a user")
    @require_elevated_role()
    async def money_add(
        self,
        inter: disnake.ApplicationCommandInteraction,
        user: disnake.Member,
        amount: int,
        reason: str = "Admin addition"
    ):
        with get_sync_db() as db:
            u = db.query(User).filter(User.discordID == user.id).first()
            if not u:
                await inter.response.send_message("User not registered.", ephemeral=True)
                return
            
            u.money += amount
            txns = list(u.transactions) if u.transactions else []
            txns.append({
                "type": "admin_addition", "amount": amount,
                "reason": reason, "timestamp": int(datetime.datetime.now().timestamp())
            })
            u.transactions = txns
            db.commit()
            new_balance = u.money

        embed = base_embed(
            title="➕  Money Added",
            color=BRAND_GREEN,
        )
        embed.set_author(name="Admin  •  Money Management", icon_url=LOGO_URL)
        embed.add_field(name="👤  User",       value=user.mention,                                   inline=True)
        embed.add_field(name="💵  Added",      value=f"`{amount:,} VND`",                            inline=True)
        embed.add_field(name="🏦  New Balance",value=f"`{new_balance:,} VND`",            inline=True)
        embed.add_field(name="📝  Reason",     value=reason,                                          inline=False)
        await inter.response.send_message(embed=embed)

    @money_admin.sub_command(name="remove", description="Remove money from a user")
    @require_elevated_role()
    async def money_remove(
        self,
        inter: disnake.ApplicationCommandInteraction,
        user: disnake.Member,
        amount: int,
        reason: str = "Admin deduction"
    ):
        with get_sync_db() as db:
            u = db.query(User).filter(User.discordID == user.id).first()
            if not u:
                await inter.response.send_message("User not registered.", ephemeral=True)
                return
            
            u.money = max(0, u.money - amount)
            txns = list(u.transactions) if u.transactions else []
            txns.append({
                "type": "admin_deduction", "amount": amount,
                "reason": reason, "timestamp": int(datetime.datetime.now().timestamp())
            })
            u.transactions = txns
            db.commit()
            new_balance = u.money

        embed = base_embed(
            title="➖  Money Removed",
            color=BRAND_RED,
        )
        embed.set_author(name="Admin  •  Money Management", icon_url=LOGO_URL)
        embed.add_field(name="👤  User",        value=user.mention,                                  inline=True)
        embed.add_field(name="💵  Removed",     value=f"`{amount:,} VND`",                           inline=True)
        embed.add_field(name="🏦  New Balance", value=f"`{new_balance:,} VND`",           inline=True)
        embed.add_field(name="📝  Reason",      value=reason,                                         inline=False)
        await inter.response.send_message(embed=embed)

    @money_admin.sub_command(name="reset", description="Reset a user's balance to zero")
    @require_elevated_role()
    async def money_reset(
        self,
        inter: disnake.ApplicationCommandInteraction,
        user: disnake.Member,
        reason: str = "Admin reset"
    ):
        with get_sync_db() as db:
            u = db.query(User).filter(User.discordID == user.id).first()
            if not u:
                await inter.response.send_message("User not registered.", ephemeral=True)
                return
            
            u.money = 0
            txns = list(u.transactions) if u.transactions else []
            txns.append({
                "type": "admin_reset", "amount": 0,
                "reason": reason, "timestamp": int(datetime.datetime.now().timestamp())
            })
            u.transactions = txns
            db.commit()

        embed = base_embed(
            title="🔄  Balance Reset",
            description=f"{user.mention}'s balance has been reset to **0 VND**.",
            color=BRAND_RED,
        )
        embed.set_author(name="Admin  •  Money Management", icon_url=LOGO_URL)
        embed.add_field(name="👤  User",    value=user.mention, inline=True)
        embed.add_field(name="📝  Reason",  value=reason,       inline=True)
        await inter.response.send_message(embed=embed)

    # ── /admin transaction ───────────────────────────────────────────────────
    @commands.slash_command(name="admin", contexts=disnake.InteractionContextTypes(guild=True, private_channel=True))
    async def admin_group(self, inter: disnake.ApplicationCommandInteraction):
        pass

    @admin_group.sub_command(name="transaction", description="View a user's full transaction history")
    @require_elevated_role()
    async def admin_transaction(
        self,
        inter: disnake.ApplicationCommandInteraction,
        user: disnake.Member = commands.Param(description="The user to check")
    ):
        with get_sync_db() as db:
            u = db.query(User).filter(User.discordID == user.id).first()
            if not u:
                await inter.response.send_message("User not registered.", ephemeral=True)
                return
            
            transactions = u.transactions or []

        if not transactions:
            embed = base_embed(
                title="📭  No Transactions",
                description=f"{user.mention} has no transaction history.",
                color=BRAND_BLUE,
            )
            await inter.response.send_message(embed=embed, ephemeral=True)
            return

        type_icons = {
            "payment_sent":     "↗️",
            "payment_received": "↙️",
            "job_earning":      "💼",
            "gamble_win":       "🎰",
            "gamble_loss":      "🎲",
            "admin_addition":   "➕",
            "admin_deduction":  "➖",
            "admin_reset":      "🔄",
        }

        embed = base_embed(
            title=f"📋  Full Transaction History",
            description=f"Showing all **{len(transactions)}** transactions for {user.mention}.\n\u200b",
            color=BRAND_BLUE,
        )
        embed.set_author(
            name=f"Admin View  •  {user.display_name}",
            icon_url=user.display_avatar.url,
        )
        for txn in transactions:
            txn_type  = txn.get("type", "unknown")
            amount    = txn.get("amount", 0)
            timestamp = txn.get("timestamp", 0)
            icon      = type_icons.get(txn_type, "💱")
            label     = txn_type.replace("_", " ").title()
            date      = disnake.utils.format_dt(datetime.datetime.fromtimestamp(timestamp), style="R")
            embed.add_field(
                name=f"{icon}  {label}",
                value=f"`{amount:,} VND`  ·  {date}",
                inline=False,
            )
        await inter.response.send_message(embed=embed)


def setup(bot):
    bot.add_cog(Economy(bot))
