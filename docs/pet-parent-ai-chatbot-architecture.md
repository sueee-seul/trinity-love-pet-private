# Pet-Parent AI Chatbot: Architecture & Integration Plan

This document explains how the pet-parent AI chatbot is designed to work end to end, and what
remains to wire up. It separates what already exists in the codebase from what still needs to be
built. Read this before starting the implementation steps at the bottom.

Design source: `Tropical_Chatbox_refined.docx`, Section 3 ("Context Resolution Rules") and Section 4
(the two-call LLM flow). That design was validated against a local Ollama model in `AiChatbox/`
(see `AiChatbox/README.md`) before being described here for the real TypeScript integration.

## What this feature does

A pet parent opens the AI Chat panel/page and asks free-text questions about their pet's stay
("What's Biscuit's feeding routine?", "How long did he sleep?", "Which one eats more?"). The AI
must:

- Figure out **which pet** (and, if the pet has more than one booking, **which stay**) the question
  is about, without guessing when it's genuinely ambiguous.
- When the parent explicitly requests a comprehensive overview of all pets, summarize the available
  profile and stay records for every pet instead of asking them to pick one.
- When asking a parent with multiple pets to clarify which pet they mean, offer each pet and the
  "All my pets" overview option. Do not return the overview unless they explicitly request it or
  select that option.
- Answer **only** from the pet's real caring-info/booking records. Never invent details.
- Recognize when a question isn't answerable this way at all (a new booking request, gibberish, a
  pet that isn't the parent's) and hand off appropriately instead of forcing an answer.

## Current state: what's already built

Nothing described below needs to be invented from scratch; most of the plumbing exists.

### Backend (Express + TypeScript)

| Piece                            | File                                                                                                                         |
| :------------------------------- | :--------------------------------------------------------------------------------------------------------------------------- |
| Routes                           | `Backend/src/routes/conversation.routes.ts`                                                                                  |
| Controller                       | `Backend/src/controllers/conversation.controller.ts`                                                                         |
| Service (conversation lifecycle) | `Backend/src/services/conversation.service.ts`                                                                               |
| Conversation state model (Mongo) | `Backend/src/models/conversation.model.ts`                                                                                   |
| Message model (Mongo)            | `Backend/src/models/message.model.ts`                                                                                        |
| Repositories                     | `Backend/src/repositories/conversation.repository.ts`, `message.repository.ts`                                               |
| Live update push (SSE)           | `Backend/src/services/conversation.events.ts`                                                                                |
| LLM provider routing             | `Backend/src/services/llm.service.ts`                                                                                        |
| Real pet/booking data (Postgres) | `Backend/src/repositories/parent.profile.repository.ts`, `petparent.stays.repository.ts`, `petparent.livecare.repository.ts` |

The Mongo schema already mirrors the design's context-stack concept directly:

- `ConversationDocument.current_entity`: the most recently resolved `{ pet_uuid, booking_pets_uuid }`.
- `ConversationDocument.pending`: a pet/topic and original question held during clarification so a
  selected stay and its repeat-request cache entry stay connected.
- `ConversationDocument.referenced_pets_uuids` / `recent_topics`: conversation-scoped memory used
  for pronoun and ambiguity resolution.
- `MessageDocument.intent` / `outcome` / `resolver_metadata`: per-message classification and
  private stay-response cache metadata. Cache keys and source fingerprints are not returned to the
  frontend.

`llm.service.ts` already exposes a single `llmProvider` (and `createToolModel()`) that routes
between a local Ollama model and a hosted OpenAI-compatible model based on `LLM_BASE_URL`:

```text
LLM_BASE_URL contains "localhost" / "127.0.0.1" / "11434"
        │
        ├── yes → createLocalOllamaToolModel()   (local dev)
        └── no  → createOpenAIStandardToolModel() (production, e.g. gpt-5.6-luna)
```

Other services already call it via the Vercel AI SDK (`generateObject`/`generateText`).
`feedback.service.ts` and the Google review investigation services are working examples of the
exact pattern the resolver/answer calls below should follow.

### Frontend (React)

`Frontend/src/features/pet-parent/ai-chat/conversationApi.ts` posts the parent's message and maps
`sender_role: 'ai'` messages for the UI. `useAiChatLiveUpdates.ts` re-fetches the conversation when
the backend's SSE stream fires a `conversation-updated` event. For a pet or stay clarification, the
message DTO may also include `quick_replies`: registered pet names and, for broad plural questions,
the "All my pets" overview option; stay clarifications include available stay labels. The chat
renders these as buttons only on the latest AI message
while AI is handling the conversation; choosing one sends its label through the regular message
endpoint. When a pet has multiple stays and the question doesn't specify one, the choices include
each stay and **All stays**. Clarifications without a finite set of valid choices do not show
buttons.

An explicit all-pets overview request is resolved separately from pet selection. The answer model
receives every owned pet's available profile fields and each non-draft stay's dates, status, care
information, and booked services. It groups the response by pet and stay and states when records are
missing. The same records are persisted in the message's `resolver_metadata.pet_cards` and returned
as `pet_cards` on the message DTO. The parent chat renders one card per pet, with profile facts and
each stay's care and service information grouped inside it. This uses existing data sources and does
not add database columns.

Answers about one selected pet also return one card for that pet. The card shows the pet's profile
and the grounded answer text; stay overviews are included only for explicit all-pets requests.

### Prototype (not production)

`AiChatbox/` is a Python sandbox that validates the resolver/guardrail design quickly against a
local Ollama model, using mock data instead of the real database. `AiChatbox/resolver.py` is marked
**not canonical**. Once the logic below exists in TypeScript, that copy is the source of truth, and
the Python prompt should not be allowed to drift from it.

## The missing piece

`postPetOwnerMessage` in `Backend/src/services/conversation.service.ts` (around line 102) stores the
parent's message and stops. Nothing currently generates or persists the `sender_role: 'ai'` reply.
Everything below fills that gap.

## Target request flow

```text
Pet parent sends a message
        │
        ▼
POST /api/petparent/conversations/:id/messages
        │
        ├── persist the pet_owner message (already implemented)
        │
        ▼
[NEW] Stay-repeat cache: replay an unchanged exact-repeat clarification/answer from this conversation
        │   on a hit, skip both model calls; source records are checked for freshness first
        │
        ▼
[NEW] Context Resolver: one LLM call (generateObject, structured output)
        │   classifies: intent (qa | new_workflow)
        │               outcome (clear | ambiguous | invalid | compare | unsupported | all_pets)
        │               pet, activity, booking_hint, candidates, invalid_name, message
        │   input: conversation's stored current_entity / pending / referenced_pets_uuids /
        │          recent_topics + the real pet/booking list for this owner
        │
        ▼
[NEW] Code-level guardrails (never trust the model alone; see below)
        │
        ├── outcome = ambiguous / invalid / unsupported / new_workflow
        │       → store a clarifying/decline message as the `ai` reply, leave current_entity
        │         unchanged, done
        │
        ├── outcome = all_pets
        │       └── retrieve profile and stay records for every owned pet, then answer from those records
        └── outcome = clear / compare
                │
                ▼
                [NEW] resolve_booking(): decide which booking/stay from real Postgres data
        (an explicit stay hint > the pet's only booking > ask which stay or offer all stays)
                │
                ├── selected "All stays" → retrieve and answer for every stay, grouped by stay
                │
                └── selected one stay → retrieve that stay's records
                        │
                        ▼
        [NEW] Retrieve real caring-info / booking records from Postgres
                │
                ▼
        [NEW] Answer Generator: one LLM call (generateText), grounded ONLY in retrieved records
                │
                ▼
        Persist the reply as a Message with sender_role: 'ai'
        Update the conversation's current_entity / pending / referenced_pets_uuids / recent_topics
        │
        ▼
publishConversationEvent(conversationId)  (already implemented; pushes over SSE)
        │
        ▼
Frontend re-fetches the conversation, renders the new `ai` message (already implemented)
```

## Reply language

The message body carries `locale` (`en` or `zh`, default `en`), the language the parent reads the
page in. The resolver is told to write only its `message` field in Simplified Chinese, and the answer
generator to write its answer in Simplified Chinese, keeping pet names, people's names, booking
references and medicine names as stored, because the guardrails match those words against stored
data. The chat's fixed English questions ("Which pet are you asking about?") and its stay labels are
shown in Chinese by the page (`ai-chat/chatServerWords.ts`); quick replies are still sent in English.

## The guardrail rule (why two LLM calls, not one)

The model is trusted to **classify** and to **extract hints** from the user's text. It is never
trusted to **decide** which pet or booking record to actually use. That decision is made in
TypeScript against the real data, the same way `AiChatbox/chatbot_harness.py::run_turn` and
`AiChatbox/resolver.py::resolve_booking` do it against mock data:

- A vague phrase echoed back as the "pet" ("my pet", "the dog") is treated as no pet at all, not a
  wrong name.
- A pet named by the model that isn't actually on this account is corrected to `invalid`, even if
  the model said `clear`.
- A bare pronoun ("he"/"she"/"they") is only resolved via the conversation's anchored pet when
  exactly one pet has ever been referenced this conversation; once a second pet enters the
  conversation, the same pronoun becomes ambiguous again.
- Which booking/stay to use is resolved in this priority order: an explicit hint in the message that
  matches one of the pet's real bookings → the pet has exactly one booking → otherwise ask which
  stay, with an additional **All stays** quick reply. A previous stay anchor does not select a stay
  for a new question.
- Selecting **All stays** retrieves the requested information for every current stay and answers
  with each stay kept separate.

### Repeat-request cache

Before either model call, the service checks conversation messages for a matching stay clarification
or answer. The cache is scoped to that conversation and matches a normalized exact question plus the
pet and selected stay IDs. A clarification can be replayed with its stay buttons; after a parent
selects the same stay scope, a prior answer can be reused without either model call. The service
re-reads the selected stay records and hashes them before reuse. If the stays or their retrieved
information have changed, it falls back to the normal resolver and answer flow. The cache does not
reuse answers across conversations or across differently worded questions.

If the model resolves something it shouldn't (guesses a pet on an ambiguous pronoun instead of
asking), that's a prompt-tuning problem to fix in the resolver system prompt, not something the
guardrails should silently paper over by guessing along with it.

## Provider configuration

| Environment | `LLM_BASE_URL`                         | `LLM_MODEL`                    | `LLM_API_KEY`       |
| :---------- | :------------------------------------- | :----------------------------- | :------------------ |
| Local dev   | `http://127.0.0.1:11434/api` (default) | `qwen2.5-coder:14b` or similar | `ollama` (unused)   |
| Production  | `https://api.openai.com/v1`            | `gpt-5.6-luna`                 | real OpenAI API key |

Set the production values in `Backend/.env` (never `.env.example`, which stays placeholders).
`createToolModel()` needs no code change to switch providers, only the env vars.

**Unverified, check before relying on it:** GPT-5.6-Luna's reasoning-effort control (`low` /
`medium` / `high`) may need to be passed via the Vercel AI SDK's `providerOptions.openai` rather
than a plain field, and reasoning-tier models typically reject a custom `temperature`. Confirm the
actual request shape against the provider's docs. `AiChatbox/openai_client.py` hit the same
uncertainty and flags it explicitly in its own docstring.

## Implementation steps

1. **`Backend/src/services/conversation.resolver.ts`**: port `RESOLVER_SYSTEM_PROMPT` from
   `AiChatbox/resolver.py` into a zod schema + `generateObject({ model: llmProvider, schema, ... })`
   call, following the pattern in `feedback.service.ts:113`.
2. **Guardrails:** port the checks from `AiChatbox/chatbot_harness.py::run_turn` into the same
   file, operating on the conversation's stored Mongo fields instead of the Python `ContextStack`.
3. **Real data retrieval:** replace `AiChatbox/mock_data.py` lookups with Postgres queries via
   `parent.profile.repository.ts` / `petparent.stays.repository.ts` / `petparent.livecare.repository.ts`
   (add a caring-info-by-booking query alongside these if one doesn't already exist).
4. **Answer generator:** port `generate_answer()` as a `generateText({ model: llmProvider, system:
ANSWER_SYSTEM_PROMPT, ... })` call, grounded only in the retrieved records.
5. **Wire it in:** in `postPetOwnerMessage`, after the pet-owner message is created, run the
   pipeline above; add `createAiMessage` to `message.repository.ts`; add
   `current_entity`/`pending`/`referenced_pets_uuids`/`recent_topics` setters to
   `conversation.repository.ts`; call `publishConversationEvent(conversationId)` again once the `ai`
   message is persisted.
6. **Production env:** add real `LLM_BASE_URL` / `LLM_MODEL` / `LLM_API_KEY` to `Backend/.env`.
7. **Confirm the reasoning-effort/temperature request shape** for `gpt-5.6-luna` against actual
   provider docs (see Provider configuration above).
8. **Decide failure behavior:** the parent's message is already persisted by the time the LLM call
   could fail/time out, so a failure must not lose it. Likely: store a "still working on it"/apology
   `ai` message and/or set `support_status: 'support_requested'` so a human picks it up.

## Open questions to resolve during implementation

- Where does the caring-info-by-booking Postgres query belong: a new function on
  `petparent.livecare.repository.ts`, or a new `petparent.chatbot.repository.ts`?
- Should `resolve_booking`'s hint-matching (currently simple string matching in the Python
  prototype) get more robust before this touches real data, per the caveat already in
  `AiChatbox/README.md`?
- Should the resolver and answer calls run against different models/effort levels (e.g. cheaper/faster
  for classification, stronger for the final answer)?
