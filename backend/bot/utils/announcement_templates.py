import random
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Literal

Venue = Literal["airport", "plane"]
PlaybackKind = Literal["tts", "safety_audio"]


@dataclass(frozen=True)
class AnnouncementTemplate:
    key: str
    label: str
    category: str
    category_label: str
    venue: Venue
    kind: PlaybackKind = "tts"
    text: str | None = None
    variants: tuple[str, ...] = ()

    def pick_text(self) -> str | None:
        pool = self.variants if self.variants else ((self.text,) if self.text else ())
        if not pool:
            return None
        return random.choice(pool)


def parse_hour_from_local_time(local_time: str) -> int | None:
    """Parse hour from values like 14:35, 2:30 PM, or 14:35:00."""
    value = (local_time or "").strip()
    if not value:
        return None

    match = re.match(r"^(\d{1,2}):(\d{2})", value)
    if match:
        return int(match.group(1)) % 24

    match = re.match(r"^(\d{1,2})\s*(AM|PM)\b", value, re.IGNORECASE)
    if match:
        hour = int(match.group(1)) % 12
        if match.group(2).upper() == "PM":
            hour += 12
        return hour

    return None


def time_greeting_for_hour(hour: int) -> str:
    if 5 <= hour < 12:
        return "Good morning"
    if 12 <= hour < 17:
        return "Good afternoon"
    if 17 <= hour < 22:
        return "Good evening"
    return "Good night"


def time_greeting_from_local_time(local_time: str) -> str:
    hour = parse_hour_from_local_time(local_time)
    if hour is None:
        hour = datetime.now().hour
    return time_greeting_for_hour(hour)


def _tts(
    key: str,
    label: str,
    category: str,
    venue: Venue,
    *variants: str,
) -> AnnouncementTemplate:
    return AnnouncementTemplate(
        key=key,
        label=label,
        category=category,
        category_label=ANNOUNCEMENT_CATEGORIES[category],
        venue=venue,
        variants=variants,
    )


ANNOUNCEMENT_CATEGORIES: dict[str, str] = {
    "boarding": "1. Boarding Announcement (airport)",
    "gate_delay": "2. Gate / Delay Announcement (airport)",
    "onboard": "3. Onboard announcement (plane)",
    "turbulence": "4. Turbulence announcement (plane)",
    "service": "5. Service announcement (plane)",
    "landing": "6. Landing announcement (plane)",
    "operational": "7. Operational announcement (plane)",
}

ANNOUNCEMENT_TEMPLATES: list[AnnouncementTemplate] = [
    _tts(
        "boarding_general",
        "General boarding",
        "boarding",
        "airport",
        (
            "Ladies and gentlemen, we are now boarding flight {flight} to {arrival}. "
            "All passengers please proceed to gate {gate}."
        ),
        (
            "Boarding is now in progress for flight {flight} to {arrival}. "
            "Passengers with boarding passes for gate {gate}, please make your way to the gate now."
        ),
        (
            "This is the boarding announcement for flight {flight}, service to {arrival}. "
            "Please proceed to gate {gate} at your earliest convenience."
        ),
    ),
    _tts(
        "boarding_priority",
        "Priority boarding",
        "boarding",
        "airport",
        (
            "We would like to invite passengers requiring special assistance, families with young children, "
            "and Business Class passengers to board first."
        ),
        (
            "Priority boarding is now open. We invite passengers needing assistance, families with infants, "
            "and premium cabin guests to board at this time."
        ),
    ),
    _tts(
        "boarding_final",
        "Boarding",
        "boarding",
        "airport",
        (
            "Final boarding call for passengers traveling on flight {flight} to {destination}. "
            "Please proceed immediately to gate {gate}. The gate will close in 5 minutes."
        ),
        (
            "This is the final call for flight {flight} to {destination}. "
            "If you are at gate {gate}, please board now. The gate is closing shortly."
        ),
        (
            "Last call for boarding: flight {flight} to {destination}, gate {gate}. "
            "Passengers not yet onboard must board immediately."
        ),
    ),
    _tts(
        "gate_delay",
        "Delay",
        "gate_delay",
        "airport",
        (
            "Attention passengers of flight {flight} to {destination}. Departure has been delayed due to "
            "operational reasons. We apologize for the inconvenience and will provide updates shortly."
        ),
        (
            "Ladies and gentlemen, flight {flight} to {destination} is experiencing a departure delay. "
            "We regret the inconvenience and appreciate your patience."
        ),
        (
            "Please be advised that flight {flight} to {destination} will depart later than scheduled. "
            "Further information will be announced as soon as it is available."
        ),
    ),
    _tts(
        "gate_change",
        "Gate change",
        "gate_delay",
        "airport",
        (
            "Attention please. Flight {flight} to {destination} will now depart from gate {gate}."
        ),
        (
            "Important gate change: flight {flight} to {destination} has moved to gate {gate}. "
            "Please proceed to the new gate immediately."
        ),
        (
            "Passengers for flight {flight} to {destination}, please note your departure gate is now {gate}."
        ),
    ),
    _tts(
        "gate_security",
        "Security reminders",
        "gate_delay",
        "airport",
        (
            "Please do not leave your baggage unattended at any time. "
            "Unattended baggage may be removed by airport security."
        ),
        (
            "For your safety, keep your personal belongings with you at all times. "
            "Unattended items may be confiscated by security personnel."
        ),
    ),
    _tts(
        "onboard_welcome",
        "Welcome",
        "onboard",
        "plane",
        (
            "{time_greeting}, ladies and gentlemen. This is your captain speaking. "
            "Welcome aboard today's flight to {destination}. "
            "Our flight time will be approximately {hours} hours and {minutes} minutes."
        ),
        (
            "{time_greeting} and welcome aboard. This is your captain. "
            "We are pleased to have you on flight {flight} to {destination}. "
            "Estimated time en route is {hours} hours and {minutes} minutes."
        ),
        (
            "{time_greeting}, everyone. From the flight deck, welcome aboard. "
            "We are bound for {destination} with a planned flight time of "
            "{hours} hours and {minutes} minutes."
        ),
        (
            "{time_greeting}, ladies and gentlemen. Welcome aboard {airline_name} flight {flight} "
            "to {destination}. We expect to be airborne for about {hours} hours and {minutes} minutes."
        ),
    ),
    AnnouncementTemplate(
        key="onboard_safety",
        label="Safety",
        category="onboard",
        category_label=ANNOUNCEMENT_CATEGORIES["onboard"],
        venue="plane",
        kind="safety_audio",
    ),
    _tts(
        "onboard_cabin_secure",
        "Cabin secure for Takeoff",
        "onboard",
        "plane",
        "Cabin crew, prepare for departure cross-check.",
        "Cabin crew, please complete the pre-departure cabin secure check.",
        "Flight attendants, prepare the cabin for departure cross-check.",
    ),
    _tts(
        "onboard_before_takeoff",
        "Before Takeoff",
        "onboard",
        "plane",
        (
            "Please ensure your seatbelt is securely fastened, your tray table is stowed, "
            "and all electronic devices are switched to airplane mode."
        ),
        (
            "Kindly fasten your seatbelt, return your seatback to the upright position, "
            "stow your tray table, and switch portable electronic devices to airplane mode."
        ),
        (
            "For takeoff, seatbelts must be fastened, seatbacks upright, tray tables stowed, "
            "and all devices set to airplane mode."
        ),
    ),
    _tts(
        "turbulence_mild",
        "Mild Turbulence",
        "turbulence",
        "plane",
        (
            "Ladies and gentlemen, we are expecting some turbulence shortly. "
            "Please return to your seats and fasten your seatbelts."
        ),
        (
            "The captain has turned on the seatbelt sign due to expected turbulence. "
            "Please take your seats and secure your seatbelt."
        ),
        (
            "We anticipate light turbulence ahead. Please remain seated with your seatbelt fastened."
        ),
    ),
    _tts(
        "turbulence_severe",
        "Severe Turbulence",
        "turbulence",
        "plane",
        "Cabin crew, take your seats immediately.",
        "Flight attendants, be seated at once.",
        "Cabin crew, secure yourselves immediately.",
    ),
    _tts(
        "service_meal",
        "Meal service",
        "service",
        "plane",
        (
            "We will shortly begin our meal service. Please check our website for the menu."
        ),
        (
            "Our cabin crew will begin meal service shortly. Menu details are available on our website."
        ),
        (
            "Inflight dining will begin in a few moments. Please refer to our website for today's menu."
        ),
    ),
    _tts(
        "service_duty_free",
        "Duty free",
        "service",
        "plane",
        (
            "Our inflight duty-free service is now available. Please refer to the catalog on our website."
        ),
        (
            "Duty-free sales are now open. Please see the catalog on our website for available items."
        ),
        (
            "You may now browse our inflight duty-free selection on our website."
        ),
    ),
    _tts(
        "landing_descent",
        "Descent",
        "landing",
        "plane",
        (
            "We have begun our descent into {destination}. Please ensure your seatbelt is fastened "
            "and your seatback is in the upright position."
        ),
        (
            "Ladies and gentlemen, we are now descending toward {destination}. "
            "Please return to your seat, fasten your seatbelt, and place your seatback upright."
        ),
        (
            "We are on final approach to {destination}. Kindly secure your seatbelt and prepare for landing."
        ),
    ),
    _tts(
        "landing_arrival",
        "Arrival",
        "landing",
        "plane",
        (
            "Welcome to {arrival}. Local time is {local_time} and the outside temperature is "
            "{local_temperature} degrees Celsius."
        ),
        (
            "Ladies and gentlemen, welcome to {arrival}. The local time is {local_time}, "
            "and the temperature on the ground is {local_temperature} degrees Celsius."
        ),
        (
            "We have arrived at {arrival}. Local time is {local_time}, "
            "with an outside temperature of {local_temperature} degrees Celsius."
        ),
    ),
    _tts(
        "operational_deplaning",
        "Deplaning delay",
        "operational",
        "plane",
        (
            "Please remain seated with your seatbelt fastened until the aircraft has come to a complete stop "
            "and the seatbelt sign has been switched off."
        ),
        (
            "For your safety, remain seated with seatbelts fastened until we reach the gate "
            "and the seatbelt sign is turned off."
        ),
    ),
    _tts(
        "operational_go_around",
        "Go around",
        "operational",
        "plane",
        (
            "Ladies and gentlemen, due to traffic congestion at the airport, "
            "we will be circling briefly before landing."
        ),
        (
            "We are making an additional approach due to air traffic at the airport. "
            "Please remain seated with your seatbelt fastened."
        ),
        (
            "The airport is temporarily congested, so we will hold briefly before our next landing attempt."
        ),
    ),
    _tts(
        "operational_medical",
        "Medical Assistance Request",
        "operational",
        "plane",
        (
            "If there is a doctor or medical professional onboard, "
            "please identify yourself to a cabin crew member immediately."
        ),
        (
            "We require medical assistance. If you are a qualified healthcare professional, "
            "please contact any cabin crew member at once."
        ),
        (
            "Attention onboard medical personnel: please make yourself known to the cabin crew immediately."
        ),
    ),
]

TEMPLATES_BY_KEY = {template.key: template for template in ANNOUNCEMENT_TEMPLATES}
TEMPLATES_BY_CATEGORY: dict[str, list[AnnouncementTemplate]] = {}
for template in ANNOUNCEMENT_TEMPLATES:
    TEMPLATES_BY_CATEGORY.setdefault(template.category, []).append(template)
