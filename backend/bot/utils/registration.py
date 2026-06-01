from db import get_sync_db, User


def get_user_id_from_discord(discord_id: str) -> str | None:
    with get_sync_db() as db:
        user = db.query(User).filter(User.discordID == int(discord_id)).first()
        return user.id if user else None


def is_registered_discord_user(discord_id: str) -> bool:
    return get_user_id_from_discord(discord_id) is not None
