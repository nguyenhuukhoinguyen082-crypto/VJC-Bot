import disnake
from disnake.ext import commands

from config import ELEVATED_ROLE_IDS


def has_elevated_role(member: disnake.Member) -> bool:
    """Return True when a member has one of the configured staff role IDs."""
    if not isinstance(member, disnake.Member):
        return False
    member_role_ids = {role.id for role in member.roles}
    return bool(member_role_ids & ELEVATED_ROLE_IDS)


def require_elevated_role():
    """
    Disnake check for staff-only commands.
    Must be applied to each subcommand — parent group handlers do not run for subcommands.
    """
    async def predicate(inter: disnake.ApplicationCommandInteraction) -> bool:
        if has_elevated_role(inter.author):
            return True

        await inter.response.send_message(
            "You don't have permission to use this command. "
            "A staff role is required.",
            ephemeral=True,
        )
        return False

    return commands.check(predicate)


def require_manage_channels():
    """Staff role or Discord Manage Channels permission (for lock/unlock)."""
    async def predicate(inter: disnake.ApplicationCommandInteraction) -> bool:
        if has_elevated_role(inter.author) or inter.author.guild_permissions.manage_channels:
            return True

        await inter.response.send_message(
            "You need a staff role or **Manage Channels** permission to use this command.",
            ephemeral=True,
        )
        return False

    return commands.check(predicate)
