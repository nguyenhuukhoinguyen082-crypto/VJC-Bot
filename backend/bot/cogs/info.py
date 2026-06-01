import disnake
from utils.branding import LOGO_URL, BRAND_GREEN, AIRLINE_NAME, base_embed
from disnake.ext import commands
from datetime import datetime

class Info(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @commands.slash_command(
        name="bot",
        contexts=disnake.InteractionContextTypes(guild=True, private_channel=True),
    )
    async def botinfo_group(self, inter: disnake.ApplicationCommandInteraction):
        pass

    @botinfo_group.sub_command(name="info", description="Get information about the bot")
    async def info(self, inter: disnake.ApplicationCommandInteraction):
        latency = round(self.bot.latency * 1000)

        if latency < 100:
            latency_icon = "🟢"
        elif latency <= 200:
            latency_icon = "🟡"
        else:
            latency_icon = "🔴"

        embed = base_embed(
            title=f"🤖  {AIRLINE_NAME} Bot",
            description=f"Your all-in-one assistant for the {AIRLINE_NAME} Discord server.\n\u200b",
        )
        embed.set_thumbnail(url=LOGO_URL)
        embed.set_author(name=AIRLINE_NAME, icon_url=LOGO_URL)
        embed.add_field(name="🌐  Servers",  value=f"`{len(self.bot.guilds)}`",              inline=True)
        embed.add_field(name="👥  Users",    value=f"`{len(self.bot.users)}`",               inline=True)
        embed.add_field(name=f"{latency_icon}  Latency", value=f"`{latency} ms`",           inline=True)
        embed.add_field(name="📨  Requested By", value=inter.author.mention,                inline=False)
        await inter.response.send_message(embed=embed)


def setup(bot: commands.Bot):
    bot.add_cog(Info(bot))