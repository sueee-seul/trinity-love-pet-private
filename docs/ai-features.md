# AI features

The pet intake assistant runs on the engine the product already had
(`Backend/src/services/llm.service.ts`, Ollama locally or OpenAI via `LLM_BASE_URL`). The newer
features run on Claude through Amazon Bedrock with the shared settings in
`Backend/src/config/bedrock.ts` (`BEDROCK_*`, falling back to `CONCIERGE_BEDROCK_*`); without
them each says it is not set up and the product works without it.

| Feature                   | Endpoint or job                                      | Who can call it | Doc                            |
| ------------------------- | ---------------------------------------------------- | --------------- | ------------------------------ |
| Pet intake assistant      | `POST /api/ai/pet-description`                       | Signed in       | below                          |
| Booking concierge         | `/api/concierge/*` (`CONCIERGE_AI_PROVIDER=bedrock`) | Anyone          | `docs/ai-booking-concierge.md` |
| Warm daily update wording | the daily summary pass (`daily-summary.writer.ts`)   | Job             | `docs/daily-updates.md`        |

## Pet intake assistant

An owner describes their animal (typed or spoken, in any language) and the pet form fills itself
in.

The form asks for seventeen things, and a long form is where people give up. That is exactly what
the "compulsory fields" work is up against. Measured against a real model:

> _"Mochi is a 4 year old desexed female border collie, 18kg, black and white. Allergic to chicken
> and beef. She takes one Apoquel tablet twice a day with food. Vet is Dr Lee at Swanson Vets,
> 09 123 4567. She is scared of thunder and needs her own space."_

fills name, species, breed, sex, desexed, weight, colour, both allergies, the behaviour note, the
vet and their phone, and the medication broken into dose / unit / schedule / with-food.

Four rules shape it:

1. **Nothing reaches the form until the owner confirms.** Reading produces a draft that is shown
   back and goes no further; `onDraft` fires on the confirm press, not on the read. Then the owner
   edits and presses Save as usual. This is their own record of their animal's medication and
   allergies; a model writing that unattended is not something to ship.
2. **Anything medical is confirmed separately.** See below.
3. **Medications are read but not applied.** They have their own records and their own editor, and a
   dose written into the wrong animal's chart is the one mistake here that could actually matter.
   The assistant lists what it found so the owner enters them deliberately.
4. **Absent beats guessed.** Only fields the description actually stated come back, so a field the
   model did not recognise keeps whatever the owner already typed. "4 year old" does **not** become
   a birth date, and a microchip number is never invented.

### Dictation

The microphone beside the box is the shared dictation module the feedback feature also uses
(`shared/dictation/`): `useDictation` streams the microphone to the Backend's `/api/speech/stream`
WebSocket, which cuts it into utterances, has the local Whisper service in `SpeechService/`
transcribe them, and returns the words live. Whisper finds the spoken language by itself. It writes into the same
textarea the owner can type in, so speaking and typing are one input rather than two modes.

Dictation needs a secure context. It works on `localhost`, and silently will not on a plain-HTTP LAN
address. This is worth knowing before demoing from another machine on the network.

### Any language in, English out

The owner writes or speaks in whatever they think in; every value that reaches the form is English.
Staff read this form to care for the animal, and an allergy noted in a script the closest handler
cannot read is worse than no note at all.

What is and is not translated:

| Translated                                                        | Left exactly as written         |
| ----------------------------------------------------------------- | ------------------------------- |
| Breed, colour, allergies, diet notes, behaviour notes, directions | Pet name, vet name, drug brands |

Names stay in their original script deliberately. Staff call the animal by its name, and a
translated one is a different animal to everyone involved; translating a drug name invents a drug.

The model also reports `sourceLanguage` alongside the draft. It is not a form field. It is split
off before the draft is merged, and it exists so the review panel can say _"Read in Chinese and
translated to English"_. A form that quietly rewrote someone's words in a language they cannot check
is worse than one that did not try.

When the page is in Chinese the request carries `locale: 'zh'`, and the model also returns
`readBack`: the breed, colour, notes, allergies and medication directions it wrote, in Simplified
Chinese. The review panel shows those, so an owner who does not read English can still check an
allergy or a dose before ticking the medical gate; the form still receives the English. Reading a
translation back in the source language is how medical translation is checked (back-translation).
`readBack` is null for English.

### The medical gate

Allergies and medications are pulled out of the review list into their own block, with their own
tick box, and the confirm button stays disabled until it is ticked. They are the two fields where a
misheard word or a loose translation could reach the animal; everything else is a typo.

`dietNotes` is deliberately outside the gate. It is usually a preference rather than a restriction,
and a gate that trips on "likes kibble" teaches people to tick without reading, which is the exact
failure the gate exists to prevent. An allergy stated as a diet note lands in `allergies` anyway.

A draft with nothing medical in it has no gate and confirms in one press.

### Required-but-nullable, not optional

OpenAI runs structured outputs in strict mode, which rejects any schema where a key in `properties`
is missing from `required`:

```
Invalid schema for response_format 'response': 'required' is required to be supplied
and to be an array including every key in properties. Missing 'name'.
```

Zod's `.optional()` and `.nullish()` produce exactly that, and the first version of this feature
failed on every input because of it. Every field is `.nullable()` instead: the model answers `null`
for anything unmentioned and the server strips it before it reaches the form. A test asserts the
shape so it is not "tidied" back.

## Budget

The endpoint had no ceiling when first written, and billable plus uncapped is how an API key gets
drained.

`rateLimit` (`common/middlewares/rate-limit.middleware.ts`) is in-memory and per process, keyed by
account when signed in and by address otherwise:

| Route                          | Budget      |
| ------------------------------ | ----------- |
| `POST /api/ai/pet-description` | 10 / minute |

Over budget returns `429` with `Retry-After`. Verified against the running server.

Per process means it resets on restart and does not span instances. That is enough for what it
defends against (one client hammering one server), and a shared store would be new infrastructure
for a class project. Worth knowing rather than pretending otherwise.

## Limits worth stating

- `temperature: 0` is set for the Ollama path, which this project defaults to. A reasoning model
  ignores it and logs a warning. That is the provider saying so, not a setting to delete.
- The feature does not write to the database.

## Removed: page translation

A page-translation feature (`POST /api/translate`, plus a language picker in the accessibility
toolbar) was built alongside this one and then removed. It translated the rendered DOM rather than a
message catalogue, which meant fighting React for ownership of every text node via a
`MutationObserver`, and it leaked into places it had no business touching, including the toolbar's
own controls. If page translation comes back it should be a message catalogue, not a DOM rewriter.

The multilingual handling in the intake assistant is a different thing and worth not confusing with
it: nothing on the page is rewritten. The owner's own words go to the model once, and the values
that come back are already English. There is no observer, no cache, no second pass, and the only
text that changes is text the owner is shown and asked to confirm.
