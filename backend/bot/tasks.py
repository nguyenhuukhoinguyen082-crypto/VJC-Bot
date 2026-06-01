import asyncio
from datetime import datetime, timedelta
from config import ALERT_USER_ID, GUILD_ID
from db import get_sync_db, User, Blacklist

class ScheduledTasks:
    def __init__(self, bot):
        self.bot = bot
        self.tasks_running = False

    async def start_tasks(self):
        """Start all scheduled tasks"""
        if self.tasks_running:
            return
        
        self.tasks_running = True
        # Start background tasks
        asyncio.create_task(self.auto_unban_loop())
        asyncio.create_task(self.daily_reset_loop())
        print("Bot scheduled tasks started.")

    async def stop_tasks(self):
        """Stop all scheduled tasks"""
        self.tasks_running = False

    async def auto_unban_loop(self):
        """Automatically unban users when their ban expires"""
        while self.tasks_running:
            try:
                with get_sync_db() as db:
                    now = int(datetime.now().timestamp())
                    banned_users = db.query(User).filter(User.banned == True).all()
                    
                    for u in banned_users:
                        moderation = dict(u.moderation) if u.moderation else {}
                        ban_data = moderation.get("ban", {})
                        expires_at = ban_data.get("expires_at")
                        
                        if expires_at and now > expires_at:
                            discord_id = int(u.discordID)
                            
                            # Try to unban from Discord
                            guild = self.bot.get_guild(GUILD_ID)
                            if guild:
                                try:
                                    discord_user = await self.bot.fetch_user(discord_id)
                                    await guild.unban(discord_user, reason="Ban expired (automated)")
                                    print(f"Unbanned {discord_id} from Discord server.")
                                except Exception as e:
                                    print(f"Failed to unban {discord_id} from Discord: {e}")
                            
                            # Complete backend unban logic
                            if "ban_history" not in moderation: moderation["ban_history"] = []
                            moderation["ban_history"].append({
                                **ban_data,
                                "unbanned_at": now,
                                "unbanned_by": "system",
                                "unban_reason": "Ban expired (automated)"
                            })
                            if "ban" in moderation: del moderation["ban"]
                            u.moderation = moderation
                            u.banned = False
                    
                    db.commit()
                
                await asyncio.sleep(300)  # Check every 5 minutes
            except Exception as e:
                print(f"Error in auto unban loop: {e}")
                await asyncio.sleep(300)

    async def daily_reset_loop(self):
        """Daily reset tasks"""
        while self.tasks_running:
            try:
                now = datetime.now()
                tomorrow = now.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
                wait_seconds = (tomorrow - now).total_seconds()
                await asyncio.sleep(wait_seconds)
                print("Daily reset triggered")
            except Exception as e:
                print(f"Error in daily reset loop: {e}")
                await asyncio.sleep(3600)

    async def on_member_join(self, member):
        """Handle member join event for blacklist check"""
        try:
            with get_sync_db() as db:
                # Identify if member is blacklisted
                blacklisted_entry = db.query(Blacklist).filter(Blacklist.discord_id == member.id).first()
                
                if blacklisted_entry:
                    reason = blacklisted_entry.reason or "Blacklisted"
                    await member.kick(reason=f"Blacklisted: {reason}")
                    if ALERT_USER_ID:
                        user = self.bot.get_user(ALERT_USER_ID)
                        if user:
                            await user.send(f"⚠️ Blacklisted user {member.mention} tried to join and was kicked. Reason: {reason}")
        except Exception as e:
            print(f"Error in member join check: {e}")
