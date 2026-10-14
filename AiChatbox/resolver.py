"""
The two LLM calls from the design doc's Section 4 flow:

  1. resolve_turn()   -- "Context Resolver": classify the message as
                          clear / ambiguous / invalid / compare, and pull out
                          intent (qa vs. new_workflow), per Section 3d + 3g.
  2. generate_answer() -- answer strictly from the retrieved mock-DB records.

A code-level guardrail sits between the two calls: even if the model picks a
pet confidently, `resolve_booking` decides which *booking/stay* to use by
checking the mock DB and the context stack (Section 3e) rather than trusting
the model to track that itself.

NOT CANONICAL -- this is a prototyping sandbox for fast prompt iteration
against a local Ollama model, not production code. Once the resolver/answer
logic is ported to TypeScript (Backend/src/services/, alongside
llm.service.ts and the real Postgres/Mongo repositories), THAT copy is the
source of truth. Tweak prompts here freely, but port any change that sticks
over to the TS side -- do not let the two drift into separately-maintained
versions of the same prompt.
"""

import mock_data

RESOLVER_SYSTEM_PROMPT = """You are the context resolver for a pet-boarding chatbot.

The signed-in user's actual pets and bookings are:
{pets_block}

You will be given the running context stack for this conversation and the
user's latest message. Decide how to handle it and respond with ONLY a JSON
object (no prose, no markdown fences) with exactly these fields:

{{
  "intent": "qa" | "new_workflow",
  "outcome": "clear" | "ambiguous" | "invalid" | "compare" | "unsupported" | null,
  "pet": "<pet name or null>",
  "pets_compare": ["<pet name>", ...] or null,
  "activity": "feeding" | "medication" | "behavior_and_health" | "special_notes" | "boarding_details" | "services" | "booking_info" | null,
  "booking_hint": "<any stay/date/booking-id text the user used to identify WHICH booking, e.g. 'Sep 1-5', 'his upcoming stay', 'B123' -- or null if they didn't say>",
  "candidates": ["<pet name>", ...],
  "invalid_name": "<name the user mentioned that is NOT one of their pets, or null>",
  "message": "<clarifying question, decline message, or workflow-switch message, or null>"
}}

Rules (this is the actual design spec, so follow it exactly):
- "intent": "new_workflow" ONLY if the user is trying to do something other
  than ask a question about an existing stay -- e.g. "I want to make a new
  booking." Everything else is "qa". When intent is "new_workflow", set
  "outcome" to null, leave pet/activity null, and put a short message in
  "message" offering to start a new conversation for that workflow.
- "activity" -- pick the one the question is actually about:
  - "feeding": their feeding routine/schedule.
  - "medication": medication instructions.
  - "behavior_and_health": temperament, sleep habits, vaccination-adjacent
    health notes -- anything from the general behavior/health notes.
  - "special_notes": any other special instruction the owner left (escape
    risk, what to do if X happens, who to call, etc.).
  - "boarding_details": yes/no logistics -- first-time boarding, crate
    trained, allowed to socialize, fully vaccinated.
  - "services": what's booked -- the boarding rate, food arrangement,
    add-ons, or payment/booking status.
  - "booking_info": the booking/stay itself -- its booking id, dates, or
    whether it's the current/upcoming/past stay -- rather than any of the
    above.
- If intent is "qa": resolve which pet the question is about.
  - "clear": pet is named explicitly, OR a pronoun/ambiguous reference can be
    resolved unambiguously from the current entity in the context stack
    (only when exactly one pet was the current entity going into this turn).
    If the user's message identifies which stay/booking they mean (a date
    range, "current"/"upcoming", or a booking id), put that text in
    "booking_hint" even when it's part of the same sentence as the pet name.
  - "ambiguous": a pronoun ("he"/"she"/"they"), a vague reference ("the
    other one"), OR a generic possessive that doesn't name a specific pet
    ("my pet", "my dog", "my cat") could plausibly point to more than one
    pet given the recent topics / referenced entities. This includes a
    generic reference on the very first turn, before anything is anchored,
    whenever the user has more than one pet -- there is nothing to resolve
    it from, so it is ambiguous by default, NOT a guess at the first pet in
    the list. Do NOT guess. Set "candidates" to the plausible pets and put
    a clarifying question in "message".
  - "invalid": the user names a pet that is not in the pets list above. Put
    that name in "invalid_name" and a polite decline in "message".
  - "compare": the user is asking to compare two or more of their own pets
    (e.g. "which one ate more?"). Put the relevant pets in "pets_compare".
  - "unsupported": the message isn't a recognizable pet-care or booking
    question at all -- gibberish, abuse, small talk, or anything else
    unrelated to a pet/booking. This is different from "invalid", which is
    specifically for naming a pet that isn't the user's. Leave "pet" null
    and put a brief, polite decline in "message".
- Never guess when uncertain -- prefer "ambiguous" over a wrong guess.
- Output strictly valid JSON. No trailing commas. No commentary.
"""


def _pets_block():
    lines = []
    for pet in mock_data.OWNER["pets"]:
        bookings = mock_data.get_bookings(pet)
        stays = ", ".join(f"{b['booking_id']} ({b['stay']})" for b in bookings)
        lines.append(f"- {pet}: bookings = {stays}")
    return "\n".join(lines)


def resolve_turn(client, context, user_message):
    system_prompt = RESOLVER_SYSTEM_PROMPT.format(pets_block=_pets_block())
    context_block = (
        "Current context stack:\n" + context.as_prompt_block() +
        "\n\nUser's latest message:\n" + user_message
    )
    messages = [{"role": "system", "content": system_prompt}]
    # A little conversation history helps the model resolve pronouns.
    messages.extend(context.history[-6:])
    messages.append({"role": "user", "content": context_block})
    return client.chat_json(messages)


def resolve_booking(context, pet, booking_hint=None):
    """
    Code-level guardrail for Section 3e: don't trust the model to track which
    booking/stay is meant on its own -- only trust it to *extract a hint* the
    user actually stated. Priority:
      1. An explicit hint in this message that matches one of the pet's
         bookings (a date range, "current"/"upcoming", or a booking id).
      2. The pet has exactly one booking.
      3. We're already anchored on this pet from a previous turn -- inherit.
      4. Otherwise: don't guess, ask which stay.
    """
    bookings = mock_data.get_bookings(pet)

    matched = mock_data.match_booking(pet, booking_hint)
    if matched:
        return matched["booking_id"], matched["stay"], None

    if len(bookings) == 1:
        b = bookings[0]
        return b["booking_id"], b["stay"], None

    if context.current_entity.get("pet") == pet and context.current_entity.get("booking_id"):
        return context.current_entity["booking_id"], context.current_entity["stay"], None

    options = ", ".join(f"{b['stay']}" for b in bookings)
    clarification = f'Which stay are you referring to for {pet} -- {options}?'
    return None, None, clarification


ANSWER_SYSTEM_PROMPT = """You are the pet-boarding chatbot's answer generator.
Answer the user's question using ONLY the retrieved records below. Be warm
but concise (1-3 sentences). If a record says data isn't available, say so
plainly -- never invent details that aren't in the records.

Retrieved records:
{records}
"""


def generate_answer(client, user_message, records):
    system_prompt = ANSWER_SYSTEM_PROMPT.format(records=records)
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_message},
    ]
    return client.chat(messages, json_mode=False, temperature=0.3)
