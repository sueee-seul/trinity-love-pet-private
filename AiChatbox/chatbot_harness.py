"""
Shared resolution logic and scripted scenarios for the context-resolution
design in Tropical_Chatbox_refined.docx (Section 3: "Context Resolution
Rules"), used by both test_chatbot_ollama.py (local Ollama) and
test_chatbot_openai.py (hosted OpenAI-compatible model). Neither entry
point duplicates this -- they just build a client and hand it to
run_scenarios() / run_interactive().

What this validates:
    - The context resolver correctly classifies each turn as
      clear / clear-switch / ambiguous / invalid / compare / new-workflow
      (Section 3d and 3g).
    - Pets are resolved per question, not locked to the conversation
      (Section 3a).
    - Ambiguous pronouns after a pet switch are caught, not guessed
      (Section 3b).
    - The context stack (Section 3c) updates the way the doc describes.
    - Booking/stay disambiguation and inheritance (Section 3e) works via the
      code-level guardrail in resolver.resolve_booking, not just the model.
    - The answer-generation step only uses retrieved mock-DB records (basic
      grounding / anti-hallucination check).

This is a design-validation harness, not production code: the mock DB is a
few dicts, there's no persistence, and error handling is intentionally
minimal.
"""

import re
import sys

import mock_data
from context_stack import ContextStack
from resolver import resolve_turn, resolve_booking, generate_answer


def hr(char="-", width=72):
    print(char * width)


def _names_pet(pet, text):
    """Exact name match (case-insensitive), not substring -- 'maxi' must not match 'Max'."""
    return re.search(rf"\b{re.escape(pet.lower())}\b", text.lower()) is not None


_GENERIC_PET_REFERENCES = {
    "my pet", "my dog", "my cat", "my animal",
    "the pet", "the dog", "the cat", "the animal",
    "our pet", "a pet", "that pet", "this pet",
}


def _is_generic_reference(pet):
    """
    True if 'pet' is a vague phrase the model echoed back rather than an
    actual name -- e.g. it resolved "what's the feeding routine of my pet?"
    by literally setting pet="my pet". That trivially "appears in the
    message" (it's circular) and isn't a real pet either, so it must be
    caught before either of those checks -- otherwise it reads as an
    attempted (wrong) name and gets declined as "invalid" instead of asked.
    """
    return pet.strip().lower() in _GENERIC_PET_REFERENCES


_PRONOUNS = re.compile(r"\b(he|him|his|she|her|hers|they|them|their|theirs|it|its)\b")


def _bare_pronoun_only(text, pets):
    """True if the message uses a 3rd-person pronoun but names no pet at all."""
    text_low = text.lower()
    if any(_names_pet(p, text_low) for p in pets):
        return False
    return _PRONOUNS.search(text_low) is not None


def run_turn(client, context, user_message, verbose=True):
    """Run one turn end-to-end and return a small result dict for assertions."""
    context.add_turn("user", user_message)

    try:
        resolution = resolve_turn(client, context, user_message)
    except RuntimeError as e:
        # Both OllamaError and OpenAIError subclass RuntimeError, so this
        # is backend-agnostic without importing either client here.
        print(f"[LLM ERROR] {e}")
        sys.exit(1)

    intent = resolution.get("intent")
    outcome = resolution.get("outcome")
    result = {"intent": intent, "outcome": outcome, "resolution": resolution}

    if verbose:
        print(f'User: "{user_message}"')
        print(f"  -> intent={intent} outcome={outcome}")

    # --- Section 3g: workflow switch is a hard boundary, handled first ---
    if intent == "new_workflow":
        msg = resolution.get("message") or "Sure! Let's start a new conversation for that."
        print(f"  AI: {msg}")
        print("  [conversation would end here -- a NEW conversation starts for the workflow]")
        context.add_turn("assistant", msg)
        result["answer"] = msg
        return result

    if outcome == "ambiguous":
        # The pet isn't known yet, but if the resolver did catch an
        # activity ("how long did my pet SLEEP") don't let it evaporate --
        # keep it so the eventual answer is still about sleep once the
        # user says which pet.
        if resolution.get("activity"):
            context.pending_activity = resolution.get("activity")
        msg = resolution.get("message") or f"Do you mean {' or '.join(resolution.get('candidates', []))}?"
        print(f"  AI: {msg}")
        print("  [current entity left unchanged -- never guess]")
        context.add_turn("assistant", msg)
        result["answer"] = msg
        return result

    if outcome == "invalid":
        msg = resolution.get("message") or (
            f"I don't have a pet named {resolution.get('invalid_name')} associated with your account."
        )
        print(f"  AI: {msg}")
        context.add_turn("assistant", msg)
        result["answer"] = msg
        return result

    if outcome == "unsupported":
        msg = resolution.get("message") or (
            "I can only help with questions about your pet's stay -- feeding, "
            "medication, behavior/health, special notes, boarding details, "
            "services, or the booking itself."
        )
        print(f"  AI: {msg}")
        print("  [not a recognizable pet/booking question -- context stack left unchanged]")
        context.add_turn("assistant", msg)
        result["answer"] = msg
        return result

    if outcome == "compare":
        pets = resolution.get("pets_compare") or []
        activity = resolution.get("activity") or "feeding"
        records = {}
        booking_hint = resolution.get("booking_hint")
        for pet in pets:
            booking_id, stay, clarify = resolve_booking(context, pet, booking_hint)
            if clarify:
                print(f"  AI: {clarify}")
                context.add_turn("assistant", clarify)
                result["answer"] = clarify
                return result
            records[pet] = mock_data.retrieve(pet, booking_id, activity)
            context.note_entity(pet, mock_data.PETS[pet]["pet_id"])
            context.note_topic(pet, activity)
        answer = generate_answer(client, user_message, records)
        print(f"  AI: {answer}")
        context.add_turn("assistant", answer)
        result["answer"] = answer
        result["records"] = records
        return result

    if outcome == "clear":
        pet = resolution.get("pet")
        activity = resolution.get("activity")

        # Code-level guardrail: a vague phrase echoed back as the "pet"
        # value ("my pet", "the dog", ...) is not a name attempt -- treat
        # it exactly like no pet was given at all, before any other check
        # gets a chance to misread it as one.
        if pet and _is_generic_reference(pet):
            pet = None

        # Code-level guardrail (same philosophy as resolve_booking below):
        # don't trust the model's pet pick just because it said "clear".
        # It's only justified if the pet was actually named in this
        # message, inherited from an already-anchored current entity, or
        # inherited from a pet this same turn already confirmed earlier
        # (e.g. we asked "which stay?" after the user already said "Max" --
        # a reply of "current stay" doesn't repeat "Max", but it's not a
        # guess either). Otherwise (e.g. "my pet" on a fresh conversation
        # with 2+ pets) the model is guessing the first pet in the list --
        # catch that here instead of relying on prompt wording alone.
        if (
            pet
            and not _names_pet(pet, user_message)
            and context.current_entity.get("pet") != pet
            and context.pending_pet != pet
            and len(mock_data.OWNER["pets"]) > 1
        ):
            pet = None

        if not pet:
            # Code-level guardrail: the resolver said "clear" but didn't
            # actually name a pet, which breaks its own contract. Don't
            # skip the turn silently -- ask, same as a real "ambiguous".
            msg = f"Which pet are you asking about -- {' or '.join(mock_data.OWNER['pets'])}?"
            print(f"  AI: {msg}")
            print("  [resolver said 'clear' but the pet wasn't named or anchored -- asking instead of guessing]")
            context.add_turn("assistant", msg)
            result["outcome"] = "ambiguous"
            result["answer"] = msg
            return result

        # Code-level guardrail: the resolver said "clear" and named a pet,
        # but that pet isn't actually on this account -- this is exactly
        # what the resolver's own "invalid" rule is supposed to catch, and
        # it missed. Don't hand a made-up pet to resolve_booking (which
        # would silently produce an empty "which stay -- ?" prompt); match
        # case-insensitively against the real pets and fall back to invalid.
        canonical = next((p for p in mock_data.OWNER["pets"] if p.lower() == pet.lower()), None)
        if canonical is None:
            msg = f"I don't have a pet named {pet} associated with your account."
            print(f"  AI: {msg}")
            print("  [resolver said 'clear' but named a pet not on this account -- treating as invalid]")
            context.add_turn("assistant", msg)
            result["outcome"] = "invalid"
            result["answer"] = msg
            return result
        pet = canonical

        # Code-level guardrail for Section 3b: a bare pronoun ("he"/"she"/
        # "they"/"it") with no pet actually named is only safe to resolve
        # via inheritance if there's just ONE pet this conversation has
        # ever referenced. Once a second pet has been discussed, the same
        # pronoun is genuinely ambiguous -- don't trust the model's (or the
        # anchor's) pick just because current_entity happens to be set.
        if (
            _bare_pronoun_only(user_message, mock_data.OWNER["pets"])
            and len(context.referenced_entities) > 1
        ):
            candidates = list(context.referenced_entities.keys())
            msg = f"Do you mean {' or '.join(candidates)}?"
            print(f"  AI: {msg}")
            print("  [bare pronoun after more than one pet referenced -- asking instead of guessing]")
            context.add_turn("assistant", msg)
            result["outcome"] = "ambiguous"
            result["answer"] = msg
            return result

        # A short reply that only confirms the pet (or only the stay) won't
        # restate the activity -- inherit it from this same disambiguation
        # rather than defaulting to "feeding" and answering the wrong thing.
        if not activity and context.pending_pet == pet:
            activity = context.pending_activity
        activity = activity or "feeding"
        context.pending_pet = pet
        context.pending_activity = activity

        # The pet's identity is confirmed even if the *booking* isn't yet --
        # record it as referenced now (Section 3c), not only after a full
        # resolution. Otherwise a pet whose first mention lands on a "which
        # stay?" clarify never shows up in the context stack, and a later
        # pronoun turn looks unambiguous to the model when it shouldn't.
        context.note_entity(pet, mock_data.PETS[pet]["pet_id"])

        was_switch = (
            context.current_entity.get("pet") is not None
            and context.current_entity.get("pet") != pet
        )
        booking_id, stay, clarify = resolve_booking(context, pet, resolution.get("booking_hint"))
        if clarify:
            # Code-level guardrail overriding the model: multiple bookings,
            # nothing in the context stack disambiguates them. pending_pet
            # / pending_activity stay set so the follow-up reply inherits
            # them instead of losing them.
            print(f"  AI: {clarify}")
            context.add_turn("assistant", clarify)
            result["outcome"] = "ambiguous"
            result["answer"] = clarify
            return result

        # Turn fully resolved -- nothing left pending.
        context.pending_pet = None
        context.pending_activity = None

        label = "clear-switch" if was_switch else "clear"
        if activity == "booking_info":
            # Known code-side already (from resolve_booking) -- answer
            # directly instead of routing it through the LLM and a mock
            # activity record that has nothing to do with the question.
            answer = f"{pet}'s booking id is {booking_id}, for the stay {stay}."
            records = None
        else:
            records = mock_data.retrieve(pet, booking_id, activity)
            answer = generate_answer(client, user_message, records)
        print(f"  ({label}) AI: {answer}")

        context.set_current(pet, booking_id, stay)
        context.note_topic(pet, activity)
        context.add_turn("assistant", answer)

        result["outcome_label"] = label
        result["answer"] = answer
        result["records"] = records
        return result

    print(f"  [unhandled outcome: {outcome!r} -- resolution was {resolution}]")
    return result


# ---------------------------------------------------------------------------
# Scripted test conversations, lifted directly from the document's own
# examples (Section 3a/b/d/e/f/g) so the harness doubles as a spec check.
# ---------------------------------------------------------------------------

SCENARIOS = [
    (
        "3d -- clear, clear-switch, ambiguous, invalid",
        [
            "What's Biscuit's feeding routine?",
            "What about Sato?",
            "How long did he sleep?",
            "How is Whiskers doing?",
        ],
    ),
    (
        "3e -- booking/stay disambiguation and inheritance",
        [
            "What's Biscuit's feeding routine?",
            "What about his medication during his Sep 8-10 stay?",
            "What about his sleep?",
        ],
    ),
    (
        "3f -- comparing two pets in one conversation",
        [
            "How is Sato eating?",
            "What about Biscuit's feeding during his Sep 8-10 stay?",
            "Which one eats more?",
        ],
    ),
    (
        "3g -- the one hard trigger left: a different workflow",
        [
            "How's Biscuit doing today?",
            "I want to make a new booking.",
        ],
    ),
]


def run_scenarios(client):
    for title, turns in SCENARIOS:
        hr("=")
        print(f"SCENARIO: {title}")
        hr("=")
        context = ContextStack(user_id=mock_data.OWNER["customer_id"])
        for turn in turns:
            run_turn(client, context, turn)
            print()
        print("Final context stack:")
        print(context.as_prompt_block())
        print()


def run_interactive(client):
    context = ContextStack(user_id=mock_data.OWNER["customer_id"])
    print("Interactive mode. Pets on this account:", ", ".join(mock_data.OWNER["pets"]))
    print("Type 'stack' to print the context stack, 'quit' to exit.\n")
    while True:
        try:
            msg = input("You: ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break
        if not msg:
            continue
        if msg.lower() in ("quit", "exit"):
            break
        if msg.lower() == "stack":
            print(context.as_prompt_block())
            continue
        run_turn(client, context, msg)
        print()
