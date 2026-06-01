import datetime
import disnake
from disnake.ext import commands
from db import load_json, save_json, USERS_DB
from utils.registration import is_registered_discord_user
from xp import (
    CHAT_XP,
    CHAT_XP_COOLDOWN_SECONDS,
    MIN_CHAT_MESSAGE_LENGTH,
    apply_xp,
    ensure_progression,
)

class XpEvents(commands.Cog):
    """Award XP when registered members chat in the server."""

    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @commands.Cog.listener()
    async def on_message(self, message: disnake.Message):
        if message.author.bot or message.guild is None:
            return
        if len((message.content or "").strip()) < MIN_CHAT_MESSAGE_LENGTH:
            return

        discord_id = str(message.author.id)
        if not is_registered_discord_user(discord_id):
            return

        users = load_json(USERS_DB)
        user_id = None
        for uid, udata in users.items():
            if str(udata.get("discordID")) == discord_id:
                user_id = uid
                break
        if user_id is None:
            return

        user = users[user_id]
        ensure_progression(user)

        now = int(datetime.datetime.now().timestamp())
        last_chat_xp = int(user.get("last_chat_xp_at", 0))
        if last_chat_xp and now - last_chat_xp < CHAT_XP_COOLDOWN_SECONDS:
            return

        user["last_chat_xp_at"] = now
        apply_xp(user, CHAT_XP)
        save_json(USERS_DB, users)

def setup(bot: commands.Bot):
    bot.add_cog(XpEvents(bot))
