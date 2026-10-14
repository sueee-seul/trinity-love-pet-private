"""
Mock data for testing the pet-care chatbot's context-resolution design
(see Tropical_Chatbox_refined.docx, Section 3) against a local Ollama model.

Shaped like the real booking API response (nested customer/pet/booking,
UUIDs, per-pet caring info and services) rather than a simplified stand-in,
so the resolver is exercised against the data it will actually see.

Single owner (Paige Phan) with two pets, both on the same real booking --
plus one synthetic second booking for Biscuit so the "pet has more than
one stay" disambiguation case (Section 3e) still has something to test.
"""

import datetime

OWNER = {
    "customer_id": "488ade04-852a-4f36-86b3-2685dc1e12cf",
    "name": "Paige Phan",
    "pets": ["Biscuit", "Sato"],
}

# One row per pet-in-a-booking -- the same shape the real API returns
# (booking_pets_uuid / booking_id / pet / booking).
BOOKING_PETS = [
    {
        "booking_pets_uuid": "94032c33-b3bd-42e7-bf34-3d044229cd46",
        "booking_id": "99c71f3b-435a-4f58-a9d9-90adf58c7fb6",
        "pet": {
            "id": "6ddde21b-45c9-473a-a4a1-48c2783ef07c",
            "name": "Biscuit",
            "type": "dog",
            "details": {"breed": None, "age": None},
        },
        "booking": {
            "dates": {"check_in": "2026-09-08", "check_out": "2026-09-10"},
            "booking_caring_info": {
                "feeding_routine": "3 cup dry food at 7am, 2 cup wet food at 5pm and 3 cup dry food at 7pm",
                "medication_instructions": "none",
                "first_time_boarding": True,
                "crate_trained": True,
                "other_notes": "if you see him bark too long, call me",
                "allows_socialization": True,
                "fully_vaccinated": True,
                "behavior_and_health_notes": "he usually sleeps at 9pm and wakes up at 6am, after he wakes up, he can be quite noisy",
            },
            "services": {
                "boarding_rate": {"services_uuid": "40000000-0000-4000-8000-000000000001", "services_name": "Overnight boarding (dog)"},
                "food": {"services_uuid": "40000000-0000-4000-8000-000000000010", "services_name": "In-house food"},
                "addons": [
                    {"services_uuid": "40000000-0000-4000-8000-000000000004", "services_name": "Extra walk"},
                    {"services_uuid": "40000000-0000-4000-8000-000000000005", "services_name": "Supervised playgroup"},
                    {"services_uuid": "40000000-0000-4000-8000-000000000006", "services_name": "Full groom"},
                ],
            },
            "status": "paid",
        },
    },
    {
        "booking_pets_uuid": "a7eb560b-b6d6-4f3b-84ab-99aa5a80eaf4",
        "booking_id": "99c71f3b-435a-4f58-a9d9-90adf58c7fb6",
        "pet": {
            "id": "ade8d771-f57c-4848-b6f4-0b6c22978bce",
            "name": "Sato",
            "type": "cat",
            "details": {"breed": None, "age": None},
        },
        "booking": {
            "dates": {"check_in": "2026-09-08", "check_out": "2026-09-10"},
            "booking_caring_info": {
                "feeding_routine": "1 cup dry food at 6am, 1 cup wet food at 5pm",
                "medication_instructions": "she's taking pills to remove worms",
                "first_time_boarding": True,
                "crate_trained": True,
                "other_notes": "if she has a fight with another cat, please intervene and isolate her",
                "allows_socialization": True,
                "fully_vaccinated": True,
                "behavior_and_health_notes": "she wants cuddle a lot during the day",
            },
            "services": {
                "boarding_rate": {"services_uuid": "40000000-0000-4000-8000-000000000002", "services_name": "Overnight boarding (cat)"},
                "food": {"services_uuid": "40000000-0000-4000-8000-000000000011", "services_name": "Customer-provided food"},
                "addons": [
                    {"services_uuid": "40000000-0000-4000-8000-000000000007", "services_name": "Bath & brush"},
                    {"services_uuid": "40000000-0000-4000-8000-000000000008", "services_name": "Medication administration"},
                ],
            },
            "status": "paid",
        },
    },
    {
        "booking_pets_uuid": "b1000000-0000-4000-8000-000000000099",
        "booking_id": "b2000000-0000-4000-8000-000000000099",
        "pet": {
            "id": "6ddde21b-45c9-473a-a4a1-48c2783ef07c",
            "name": "Biscuit",
            "type": "dog",
            "details": {"breed": None, "age": None},
        },
        "booking": {
            "dates": {"check_in": "2026-12-10", "check_out": "2026-12-15"},
            "booking_caring_info": {
                "feeding_routine": None,
                "medication_instructions": None,
                "first_time_boarding": False,
                "crate_trained": True,
                "other_notes": None,
                "allows_socialization": True,
                "fully_vaccinated": True,
                "behavior_and_health_notes": None,
            },
            "services": {
                "boarding_rate": {"services_uuid": "40000000-0000-4000-8000-000000000001", "services_name": "Overnight boarding (dog)"},
                "food": None,
                "addons": [],
            },
            "status": "confirmed",
        },
    },
]

# Derived flat table -- {pet_name: {"pet_id": ..., "species": ...}} -- kept
# as a convenience lookup the same shape the old simplified mock exposed.
PETS = {
    row["pet"]["name"]: {"pet_id": row["pet"]["id"], "species": row["pet"]["type"]}
    for row in BOOKING_PETS
}

CARING_INFO_FIELDS = {
    "feeding": "feeding_routine",
    "medication": "medication_instructions",
    "behavior_and_health": "behavior_and_health_notes",
    "special_notes": "other_notes",
}


def _fmt_date(iso_date):
    d = datetime.date.fromisoformat(iso_date)
    return f"{d.strftime('%b')} {d.day}"


def _stay_label(dates):
    today = datetime.date.today()
    check_in = datetime.date.fromisoformat(dates["check_in"])
    check_out = datetime.date.fromisoformat(dates["check_out"])
    if today < check_in:
        tag = "upcoming"
    elif today > check_out:
        tag = "past"
    else:
        tag = "current"
    if check_in.month == check_out.month:
        span = f"{_fmt_date(dates['check_in'])}-{check_out.day}"
    else:
        span = f"{_fmt_date(dates['check_in'])} - {_fmt_date(dates['check_out'])}"
    return f"{span} ({tag})"


def get_bookings(pet):
    return [
        {"booking_id": row["booking_id"], "stay": _stay_label(row["booking"]["dates"])}
        for row in BOOKING_PETS
        if row["pet"]["name"] == pet
    ]


def get_current_booking_id(pet):
    """Default booking when a pet has exactly one, or as a last-resort fallback."""
    bookings = get_bookings(pet)
    return bookings[0]["booking_id"] if bookings else None


def match_booking(pet, hint):
    """
    Loosely match a free-text hint (a date range, 'current'/'upcoming', or a
    booking id) against this pet's bookings. Returns a booking dict or None.
    """
    if not hint:
        return None
    hint_low = hint.lower()
    for b in get_bookings(pet):
        if b["booking_id"].lower() in hint_low:
            return b
        stay_low = b["stay"].lower()
        stay_core = stay_low.split(" (")[0]
        if stay_core in hint_low or hint_low in stay_low:
            return b
        if "(current)" in stay_low and "current" in hint_low:
            return b
        if "(upcoming)" in stay_low and "upcoming" in hint_low:
            return b
        if "(past)" in stay_low and "past" in hint_low:
            return b
    return None


def _booking_row(pet, booking_id):
    for row in BOOKING_PETS:
        if row["pet"]["name"] == pet and row["booking_id"] == booking_id:
            return row
    return None


def retrieve(pet, booking_id, activity):
    """Mock DB lookup: the only data the answer-generation call is allowed to see."""
    row = _booking_row(pet, booking_id)
    if row is None:
        return {"note": f"no booking found for {pet} with booking id {booking_id}"}
    booking = row["booking"]
    caring_info = booking["booking_caring_info"]

    if activity in CARING_INFO_FIELDS:
        field = CARING_INFO_FIELDS[activity]
        value = caring_info.get(field)
        if value is None:
            return {"note": f"no {activity} information has been provided for {pet} on this booking"}
        return {field: value}

    if activity == "boarding_details":
        return {
            "first_time_boarding": caring_info.get("first_time_boarding"),
            "crate_trained": caring_info.get("crate_trained"),
            "allows_socialization": caring_info.get("allows_socialization"),
            "fully_vaccinated": caring_info.get("fully_vaccinated"),
        }

    if activity == "services":
        services = booking["services"]
        addons = [a["services_name"] for a in (services.get("addons") or [])]
        return {
            "boarding_rate": (services.get("boarding_rate") or {}).get("services_name"),
            "food": (services.get("food") or {}).get("services_name") or "not specified",
            "addons": addons or "none",
            "status": booking.get("status"),
        }

    return {"note": f"no {activity} records found for {pet} on booking {booking_id}"}
