# Notes in the reader's language

**Audience:** engineers working on the pet parent pages.<br>
**Status:** as implemented on `rebuild_petparents_pages`.

Each pet parent page shows one language only. Notes people write themselves are translated so the rule holds:

| Page language | Note written in                                                                      | Shown as                                                      |
| ------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| Chinese       | English (staff care notes on Live care)                                              | Chinese translation, marked "Auto-translated" (in Chinese), original one tap away |
| English       | Chinese (the parent's own care answers, allergies, colour, diet and behaviour notes) | English translation, marked "Translated"                      |

If a translation fails, the page says so in its own language and never shows the other language. Names (pets, people, medicines) stay as written.

## English translation endpoint

`POST /api/petparent/translations/english`, signed-in pet parent only, 60 calls per 15 minutes.

```json
{ "texts": ["Kibble twice a day", "Likes to sleep in the day" (in Chinese)] }
```

```json
{ "translations": [null, "Likes to sleep during the day"] }
```

- 1 to 12 texts, each at most 1000 characters; otherwise 422 `VALIDATION_FAILED`.
- Only texts with Chinese characters go to the model; the others come back `null`.
- Translations are cached in memory (`care-note.translation.ts`).

On the frontend, `useParentWrittenText` (`features/pet-parent/i18n/parentWrittenText.ts`) asks for all Chinese notes on a page in one call and `ParentNoteText` shows each one.

## Local setup

Translation uses the backend's language model (`LLM_BASE_URL`, `LLM_MODEL`). With no `LLM_BASE_URL` set, the backend uses a local Ollama at `127.0.0.1:11434`; if that is not running, notes show "could not translate".
