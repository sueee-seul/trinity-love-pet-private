# Chatbot context-resolution test harness (Ollama + mock data)

Tests the design in `Tropical_Chatbox_refined.docx`, Section 3 ("Context
Resolution Rules") against a real local LLM via [Ollama](https://ollama.com),
using mock pet/booking data instead of the real database. No cloud calls,
no real user data.

## Files

- `mock_data.py`: two mock pets (Max, Luna) under one owner; Max has two
  bookings so the booking/stay disambiguation case (Section 3e) is testable.
- `context_stack.py`: the conversation-state object from Section 3c / the
  Architecture Layer 1 (fixed user, referenced entities, current entity,
  recent topics).
- `ollama_client.py`: thin wrapper over Ollama's `/api/chat`, with JSON-mode
  parsing and one retry on malformed JSON.
- `resolver.py`: the two LLM calls (context resolver, answer generator)
  plus `resolve_booking()`, a **code-level guardrail**: the model can name a
  pet and a booking hint, but Python (not the model) decides which actual
  booking/stay to use, falling back to a clarifying question rather than
  guessing when it's genuinely ambiguous.
- `test_chatbot_ollama.py`: the runnable harness: scripted scenarios lifted
  straight from the document's own examples, plus an interactive mode.

## Setup

```bash
# 1. Install Ollama: https://ollama.com/download
# 2. Pull a model (llama3.1 is the default; any reasonably capable
#    instruction-following model works)
ollama pull llama3.1

# 3. Make sure the Ollama server is running (usually auto-starts)
ollama serve

# 4. Install the one Python dependency
pip install requests
```

## Run it

```bash
# Run the scripted scenarios (recommended first run)
python test_chatbot_ollama.py

# Chat manually instead
python test_chatbot_ollama.py --interactive

# Use a different model or a remote Ollama host
python test_chatbot_ollama.py --model qwen2.5
python test_chatbot_ollama.py --host http://192.168.1.50:11434
```

## What the scripted scenarios check

| Scenario                                   | Document section | What it proves                                                                                                                                                                                    |
| ------------------------------------------ | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clear / clear-switch / ambiguous / invalid | 3d               | Pets resolve per question; switching pets doesn't need a new conversation; an ambiguous pronoun after a switch gets asked about, not guessed; an unknown pet name is declined instead of queried. |
| Booking/stay disambiguation & inheritance  | 3e               | A pet with two bookings triggers a clarifying question when nothing disambiguates it; once a stay is named, later follow-ups on the same pet inherit it.                                          |
| Comparing two pets                         | 3f               | One conversation can pull records for two pets and compare them, instead of forcing separate chats.                                                                                               |
| The one remaining hard trigger             | 3g               | Asking to start a new booking (a different business workflow) is still treated as a hard switch, distinct from every entity-level case above.                                                     |

## Notes / limitations

This is a **design-validation harness**, not production code:

- The mock DB is a handful of Python dicts. Swap `mock_data.py` for real
  queries when this graduates past testing.
- `resolve_booking()`'s hint-matching is intentionally simple string
  matching. It's there to prove the _guardrail pattern_ (never trust the
  model alone for the "which booking" decision). The matching logic itself
  should get more robust before this touches real data.
- Read the printed transcript critically: if the model resolves something
  it shouldn't have (e.g. guesses a pet on an ambiguous pronoun instead of
  asking), that's exactly the kind of prompt-tuning signal this harness is
  meant to surface. Try tightening `RESOLVER_SYSTEM_PROMPT` in `resolver.py`
  and re-running.
