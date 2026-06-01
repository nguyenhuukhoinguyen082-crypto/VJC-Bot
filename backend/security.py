"""Security helpers: config validation, user sanitization, field allowlists."""

from datetime import datetime
from typing import Any, Dict

from config import settings

# Fields never exposed in API responses
SENSITIVE_USER_FIELDS = frozenset({"pwdh", "ip_address", "moderation"})

USER_SELF_EDITABLE_FIELDS = frozenset({"nickname", "email", "achievement"})

ADMIN_USER_EDITABLE_FIELDS = frozenset(
    {
        "nickname",
        "email",
        "money",
        "flightmiles",
        "miles",
        "verified",
        "banned",
        "group",
        "achievement",
    }
)

ADMIN_GROUPS = frozenset({"dev", "director", "staff"})
PANEL_GROUPS = frozenset({"dev", "director", "staff"})


def validate_settings() -> None:
    """Fail fast when required secrets are missing or too weak."""
    missing = []
    if not settings.api_key or len(settings.api_key) < 16:
        missing.append("API_KEY (min 16 characters)")
    if not settings.secret_key or len(settings.secret_key) < 32:
        missing.append("SECRET_KEY (min 32 characters)")
    if missing:
        raise RuntimeError(
            "Missing or weak required environment variables: "
            + ", ".join(missing)
            + ". Copy backend/.env.example to backend/.env and set strong values."
        )


def sanitize_user(user_id: str, user_data: Dict[str, Any]) -> Dict[str, Any]:
    """Return a copy of user data safe for API responses."""
    if not isinstance(user_data, dict):
        return {}
    safe = {k: v for k, v in user_data.items() if k not in SENSITIVE_USER_FIELDS}
    safe["user_id"] = user_id
    return safe


def sanitize_users_map(users: Dict[str, Any]) -> Dict[str, Any]:
    """Sanitize a users dict keyed by user id."""
    result = {}
    for uid, data in users.items():
        if uid == "blacklist":
            continue
        if isinstance(data, dict):
            result[uid] = sanitize_user(uid, data)
    return result


def filter_user_updates(
    updates: Dict[str, Any],
    *,
    is_self: bool,
    is_dev: bool,
) -> Dict[str, Any]:
    """Return only fields the caller is allowed to change."""
    if is_dev:
        allowed = ADMIN_USER_EDITABLE_FIELDS
    elif is_self:
        allowed = USER_SELF_EDITABLE_FIELDS
    else:
        allowed = ADMIN_USER_EDITABLE_FIELDS - {"group", "banned", "verified"}

    return {k: v for k, v in updates.items() if k in allowed}


def is_user_banned(user_data: Dict[str, Any]) -> bool:
    if not user_data.get("banned"):
        return False
    ban = user_data.get("moderation", {}).get("ban", {})
    expires_at = ban.get("expires_at")
    if expires_at is None:
        return True
    return int(datetime.utcnow().timestamp()) < expires_at


def auth_cookie_kwargs() -> Dict[str, Any]:
    return {
        "httponly": True,
        "secure": settings.cookie_secure,
        "samesite": settings.cookie_samesite,
        "path": "/",
    }
