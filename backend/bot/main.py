import sys
import os

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import disnake
from disnake.ext import commands
from config import BOT_TOKEN, GUILD_ID, BRANDING
from utils.registration import is_registered_discord_user
from utils.branding import AIRLINE_NAME

intents = disnake.Intents.default()
intents.message_content = True

bot = commands.InteractionBot(
    intents=intents,
    test_guilds=[GUILD_ID] if GUILD_ID else None
)

import os

WEBSITE_URL = f"{BRANDING.get('links', {}).get('website', 'https://bamboo-airways.vercel.app')}/register"

@bot.slash_command_check
async def require_website_registration(inter: disnake.ApplicationCommandInteraction):
    discord_id = str(inter.author.id)

    if is_registered_discord_user(discord_id):
        return True

    if not inter.response.is_done():
        await inter.response.send_message(
            f"You need to register on the website before using bot commands.\n"
            f"👉 {WEBSITE_URL}\n\n"
            f"When registering, use your Discord ID: `{discord_id}`",
            ephemeral=True,
        )
    return False

# Load cogs
for filename in os.listdir(os.path.join(os.path.dirname(__file__), "cogs")):
    if filename.endswith(".py") and not filename.startswith("__"):
        bot.load_extension(f"cogs.{filename[:-3]}")

@bot.event
async def on_ready():

    activity = disnake.Activity(
        type=disnake.ActivityType.listening,
        name=AIRLINE_NAME
    )

    await bot.change_presence(
        status=disnake.Status.online,
        activity=activity
    )
    print(f"Logged in as {bot.user} (ID: {bot.user.id})")
    print("------")
    print(f"Bot is ready and commands are synced!")

@bot.event
async def on_slash_command_error(interaction: disnake.ApplicationCommandInteraction, error: Exception):
    if isinstance(error, commands.MissingPermissions):
        await interaction.response.send_message("You don't have permission to use this command.", ephemeral=True)
    elif isinstance(error, commands.CheckFailure):
        if not interaction.response.is_done():
            await interaction.response.send_message("You don't have permission to use this command.", ephemeral=True)
    elif isinstance(error, commands.CommandOnCooldown):
        await interaction.response.send_message(f"This command is on cooldown. Try again in {error.retry_after:.2f}s.", ephemeral=True)
    else:
        print(f"Error: {error}")
        if not interaction.response.is_done():
            await interaction.response.send_message("An error occurred while executing this command.", ephemeral=True)

if __name__ == "__main__":
    if not BOT_TOKEN:
        print("Error: DISCORD_BOT_TOKEN not found in environment variables.")
        print("Please create a .env file with your bot token.")
    else:
        bot.run(BOT_TOKEN)
