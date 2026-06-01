"""XP and level progression shared by the API and Discord bot."""

from __future__ import annotations

import random
from datetime import date
from typing import Any

MAX_LEVEL = 30

CHAT_XP = 8
WORK_XP = 30
CHAT_XP_COOLDOWN_SECONDS = 60
MIN_CHAT_MESSAGE_LENGTH = 3
DAILY_BOARD_SIZE = 7
JOB_WORK_COOLDOWN_SECONDS = 5 * 60
MIN_JOB_PAYOUT = 30_000
MAX_DAILY_EARNINGS = 500_000


def _build_level_thresholds() -> list[int]:
    """Cumulative XP required to reach each level (index 0 = level 1)."""
    thresholds = [0]
    for level in range(2, MAX_LEVEL + 1):
        total = int(90 * (level - 1) ** 1.9 + 25 * (level - 1))
        thresholds.append(max(thresholds[-1] + 1, total))
    return thresholds


LEVEL_XP_THRESHOLDS = _build_level_thresholds()


def _pay(min_level: int) -> list[int]:
    lo = MIN_JOB_PAYOUT + (min_level - 1) * 2_500
    hi = lo + 15_000 + min_level * 3_500
    return [lo, min(hi, MAX_DAILY_EARNINGS)]


def _job(name: str, min_level: int, tier: str) -> dict[str, Any]:
    return {"name": name, "min_level": min_level, "pay_range": _pay(min_level), "tier": tier}


# min_level gates which jobs a user can work; pay scales with level.
JOB_CATALOG: list[dict[str, Any]] = [
    # Level 1–5 — entry
    _job("Sweeping Terminal Floors", 1, "entry"),
    _job("Emptying Trash Bins", 1, "entry"),
    _job("Wiping Handrails", 1, "entry"),
    _job("Picking Up Litter", 1, "entry"),
    _job("Cleaning Restrooms", 2, "entry"),
    _job("Restocking Vending Machines", 2, "entry"),
    _job("Refilling Paper Towels", 2, "entry"),
    _job("Washing Terminal Windows", 3, "entry"),
    _job("Polishing Waiting Area Benches", 3, "entry"),
    _job("Mopping Food Court Floors", 3, "entry"),
    _job("Pushing Wheelchairs", 4, "junior"),
    _job("Guiding Lost Travelers", 4, "junior"),
    _job("Collecting Abandoned Carts", 4, "junior"),
    _job("Operating Shuttle Bus", 5, "junior"),
    _job("Loading Baggage Carts", 5, "junior"),
    _job("Sorting Lost Items", 5, "junior"),
    # Level 6–10 — junior / mid
    _job("Manning Information Desk", 6, "junior"),
    _job("Answering Help Phones", 6, "junior"),
    _job("Resetting Self-Service Kiosks", 6, "junior"),
    _job("Managing Lost & Found", 7, "mid"),
    _job("Tagging Unclaimed Luggage", 7, "mid"),
    _job("Organizing Storage Closet", 7, "mid"),
    _job("Restocking Duty-Free Shelves", 8, "mid"),
    _job("Setting Up Queue Barriers", 8, "mid"),
    _job("Folding Promotional Banners", 8, "mid"),
    _job("Pressure-Washing Sidewalks", 9, "mid"),
    _job("Cleaning Parking Lot Lanes", 9, "mid"),
    _job("Maintaining Terminal Planters", 9, "mid"),
    _job("Supervising Cleanup Crew", 10, "mid"),
    _job("Checking Supply Inventory", 10, "mid"),
    _job("Training New Hires", 10, "mid"),
    # Level 11–15
    _job("Waxing Terminal Floors", 11, "mid"),
    _job("Deep-Cleaning Elevators", 11, "mid"),
    _job("Sanitizing Door Handles", 11, "mid"),
    _job("Delivering Catering Supplies", 12, "mid"),
    _job("Rotating Advertisement Screens", 12, "mid"),
    _job("Fixing Broken Waiting Seats", 12, "mid"),
    _job("Coordinating Taxi Queue", 13, "senior"),
    _job("Directing Pick-Up Traffic", 13, "senior"),
    _job("Monitoring Curb Lanes", 13, "senior"),
    _job("Inspecting Fire Extinguishers", 14, "senior"),
    _job("Testing Emergency Lights", 14, "senior"),
    _job("Replacing Ceiling Tiles", 14, "senior"),
    _job("Managing Storage Warehouse", 15, "senior"),
    _job("Driving Electric Tug Vehicle", 15, "senior"),
    _job("Hauling Heavy Trash Dumpsters", 15, "senior"),
    # Level 16–20
    _job("Overseeing Night Cleaning", 16, "senior"),
    _job("Locking Terminal Gates", 16, "senior"),
    _job("Alarm System Rounds", 16, "senior"),
    _job("Handling Complaint Desk", 17, "senior"),
    _job("Logging Passenger Feedback", 17, "senior"),
    _job("Issuing Service Vouchers", 17, "senior"),
    _job("Stocking Staff Break Room", 18, "senior"),
    _job("Ordering Cleaning Supplies", 18, "senior"),
    _job("Vendor Delivery Check-In", 18, "senior"),
    _job("Cleaning Jet Bridge Carpet", 19, "senior"),
    _job("Vacuuming VIP Lounge", 19, "senior"),
    _job("Refreshing Green Wall Plants", 19, "senior"),
    _job("Lead Custodial Shift", 20, "elite"),
    _job("Assigning Daily Task Sheets", 20, "elite"),
    _job("Quality Spot Checks", 20, "elite"),
    # Level 21–25
    _job("Operating Floor Scrubber", 21, "elite"),
    _job("Stripping Old Floor Wax", 21, "elite"),
    _job("Applying New Floor Finish", 21, "elite"),
    _job("Managing Recycling Program", 22, "elite"),
    _job("Sorting Cardboard Bales", 22, "elite"),
    _job("Coordinating Waste Haul-Off", 22, "elite"),
    _job("Parking Garage Patrol", 23, "elite"),
    _job("Reporting Broken Barriers", 23, "elite"),
    _job("Clearing Oil Spills", 23, "elite"),
    _job("Escalator Maintenance Helper", 24, "elite"),
    _job("Lubricating Escalator Steps", 24, "elite"),
    _job("Replacing Broken Step Panels", 24, "elite"),
    _job("Staff Entrance Badge Check", 25, "elite"),
    _job("Monitoring Service Doors", 25, "elite"),
    _job("Logging After-Hours Visitors", 25, "elite"),
    # Level 26–30
    _job("Facility Temperature Checks", 26, "elite"),
    _job("HVAC Filter Replacement", 26, "elite"),
    _job("Reporting Hot/Cold Zones", 26, "elite"),
    _job("Emergency Spill Response", 27, "elite"),
    _job("Placing Wet Floor Signs", 27, "elite"),
    _job("Dispatching Cleanup Teams", 27, "elite"),
    _job("Airport-Wide Supply Run", 28, "elite"),
    _job("Multi-Terminal Cart Delivery", 28, "elite"),
    _job("Cross-Building Supply Relay", 28, "elite"),
    _job("Acting Facilities Supervisor", 29, "elite"),
    _job("Approving Overtime Shifts", 29, "elite"),
    _job("End-of-Day Terminal Inspection", 29, "elite"),
    _job("Terminal Operations Coordinator", 30, "elite"),
    _job("Scheduling Ground Teams", 30, "elite"),
    _job("Monthly Safety Walkthrough", 30, "elite"),
]

JOB_BY_NAME = {job["name"]: job for job in JOB_CATALOG}
LEVEL_1_JOBS = [job for job in JOB_CATALOG if job["min_level"] == 1]

TIER_EMOJI = {
    "entry": "🧹",
    "junior": "🧽",
    "mid": "🔧",
    "senior": "📋",
    "elite": "⭐",
}


def job_display_emoji(job: dict[str, Any]) -> str:
    return TIER_EMOJI.get(job.get("tier", ""), "💼")


def ensure_progression(user: dict[str, Any]) -> None:
    user.setdefault("xp", 0)
    user["level"] = level_from_xp(int(user.get("xp", 0)))


def level_from_xp(xp: int) -> int:
    xp = max(0, int(xp))
    level = 1
    for idx, threshold in enumerate(LEVEL_XP_THRESHOLDS):
        if xp >= threshold:
            level = idx + 1
    return min(level, MAX_LEVEL)


def xp_progress(xp: int) -> dict[str, int | bool]:
    """XP progress within the current level toward the next."""
    level = level_from_xp(xp)
    current_floor = LEVEL_XP_THRESHOLDS[level - 1]
    if level >= MAX_LEVEL:
        return {
            "level": level,
            "current": xp - current_floor,
            "needed": 0,
            "total_xp": xp,
            "at_max_level": True,
        }
    next_threshold = LEVEL_XP_THRESHOLDS[level]
    return {
        "level": level,
        "current": xp - current_floor,
        "needed": next_threshold - current_floor,
        "total_xp": xp,
        "at_max_level": False,
    }


def apply_xp(user: dict[str, Any], amount: int) -> dict[str, Any]:
    ensure_progression(user)
    old_level = int(user.get("level", 1))
    user["xp"] = int(user.get("xp", 0)) + max(0, int(amount))
    new_level = level_from_xp(user["xp"])
    user["level"] = new_level
    progress = xp_progress(user["xp"])
    return {
        "xp_gained": amount,
        "total_xp": user["xp"],
        "old_level": old_level,
        "new_level": new_level,
        "leveled_up": new_level > old_level,
        "progress": progress,
    }


def get_job(name: str) -> dict[str, Any] | None:
    return JOB_BY_NAME.get(name)


def jobs_unlocked_at_level(level: int) -> list[dict[str, Any]]:
    return [job for job in JOB_CATALOG if job["min_level"] <= level]


def format_unlocked_jobs_text(
    jobs: list[dict[str, Any]],
    *,
    max_chars: int = 1000,
    max_lines: int = 25,
) -> str:
    """Format job list for Discord embeds with length limits."""
    lines = [
        f"• **{j['name']}** (Lvl {j['min_level']}) — "
        f"`{j['pay_range'][0]:,}`–`{j['pay_range'][1]:,}` VND"
        for j in jobs
    ]
    if not lines:
        return "None"
    shown: list[str] = []
    length = 0
    for line in lines:
        if len(shown) >= max_lines:
            break
        if shown and length + len(line) + 1 > max_chars:
            break
        shown.append(line)
        length += len(line) + 1
    text = "\n".join(shown)
    remaining = len(lines) - len(shown)
    if remaining > 0:
        text += f"\n*…and {remaining} more job(s). Use `/job list` for today's board.*"
    return text


def can_work_job(user: dict[str, Any], job_name: str) -> tuple[bool, str]:
    job = get_job(job_name)
    if not job:
        return False, "Job not found."
    ensure_progression(user)
    level = int(user.get("level", 1))
    if level < job["min_level"]:
        return (
            False,
            f"**{job_name}** requires **Level {job['min_level']}**. "
            f"You are **Level {level}**. Chat and work more to level up!",
        )
    return True, ""


def _serialize_board_jobs(jobs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "name": job["name"],
            "min_level": job["min_level"],
            "pay_range": job["pay_range"],
            "tier": job["tier"],
        }
        for job in jobs
    ]


def get_daily_job_board(day: date | None = None) -> tuple[list[dict[str, Any]], str]:
    """Return today's job board (same for all users) and ISO date string.

    Always includes at least one level-1 job so new players can work each day.
    """
    today = day or date.today()
    seed = int(today.strftime("%Y%m%d"))
    rng = random.Random(seed)

    guaranteed = rng.choice(LEVEL_1_JOBS)
    pool = [job for job in JOB_CATALOG if job["name"] != guaranteed["name"]]
    extra_count = min(DAILY_BOARD_SIZE - 1, len(pool))
    extras = rng.sample(pool, extra_count) if extra_count else []
    board = [guaranteed, *extras]
    rng.shuffle(board)

    return _serialize_board_jobs(board), today.isoformat()


def eligible_board_jobs(level: int, board: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [job for job in board if job["min_level"] <= level]
