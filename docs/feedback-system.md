# Feedback System

This document describes the feedback system as it exists in the current codebase. It separates
implemented behavior from remaining integrations and behavior that has not
been verified in a live browser or provider environment.

Current scope is post-stay parent feedback and the staff/admin review surface. Login, general
notification UX, S3 storage, and provider-resolution workflows are outside the implemented feedback
boundary unless explicitly called out below.

## Summary

The current parent flow is:

```text
Parent ratings + category + raw answer
        │
        ├── optional MediaRecorder audio/webm
        ├── optional live dictation (local Whisper via the Backend) for the answer text
        │
        ▼
POST /api/feedback (multipart/form-data)
        │
        ├── validate payload
        ├── generate structured AI summary + insights
        ├── save raw audio to Backend/storage/feedback/ in development
        ├── insert feedback row and initial timeline event into PostgreSQL transactionally
        │
        ▼
Admin GET /api/admin/feedback or GET /api/admin/feedback/:id
        │
        ├── read feedback, names, JSON fields, and timeline from PostgreSQL
        ├── mark record-level is_read in a transaction when detail opens
        └── render card/table/detail views

Admin DELETE /api/admin/feedback/:id
        │
        ├── require an authenticated employee and trusted origin
        ├── delete linked notification rows and the feedback row in one transaction
        └── remove linked timeline rows through the existing feedback foreign-key cascade

Admin PATCH /api/admin/feedback/assignee
        │
        ├── validate selected feedback UUIDs and employee UUID
        ├── lock all selected feedback rows in one transaction
        ├── upsert the current `assigned` timeline event
        └── return the persisted assignee for the Frontend projection
```

The server-side assignment path and historical assignment projection remain available as
compatibility surfaces, but the current admin Feedback UI no longer exposes or calls this mutation.

## Google review AI path

Google reviews are a separate data and AI boundary from internal parent feedback. The public Maps
flow uses `/api/google-reviews` and writes `google_business_reviews` plus
`google_review_media_logs`. Its Google-specific AI result is stored under the linked
`external_feedback.ai_insights` JSONB field; it does not use `feedback.ai_insights`.

For a new human Google review, the runtime flow is:

```text
POST /api/google-reviews
        │
        ├── validate reviewer session and review payload
        ├── generate one complete summary plus triage type/confidence
        ├── save review photos in development
        └── one PostgreSQL transaction:
              google_business_reviews
              google_review_media_logs
              external_feedback.ai_insights
```

The stored Google AI shape is:

```json
{
  "summary": "One complete sentence based on the complete review.",
  "triageType": "issue | praise | suggestion | null",
  "triageConfidence": "high | medium | low"
}
```

`triageConfidence` describes evidence sufficiency for the classification, not whether a reviewer’s
claim is factually true. A material service failure takes precedence over praise or a proposed fix;
an explicit improvement request without a primary failure is a suggestion; insufficient evidence uses
`null` and `low` rather than guessing from the rating.

The public `GET /api/google-reviews` response intentionally remains free of staff-only AI fields.
The employee projection is exposed separately through
`GET /api/admin/google-reviews?placeSlug=PetHouse`. The simulator route
`POST /api/reviews/simulator` remains on `place_reviews` and does not invoke the Google review AI
service.

The server still supports assigning one or more Google reviews through
`PATCH /api/admin/google-reviews/assignee` as a compatibility surface. The current admin UI does not
expose or call this mutation. The route remains manager-only, requires an authenticated employee and
a trusted origin, and keeps the existing all-or-nothing persistence behavior. Assignment is persisted
in the linked `external_feedback` row: `assigned_employee_uuid` and `assigned_at` are the ownership
source of truth, while `updated_at` records the row update. This scope does not change
`current_status`, `is_read`, `ai_insights`, Google reply data, the database schema, or historical
assignment records.

The admin Google review list is role-scoped on the server. Managers receive all reviews for the
requested place. Staff receive only reviews whose linked `external_feedback.assigned_employee_uuid`
matches the authenticated `req.user.id`; unassigned reviews and reviews assigned to another staff
member are omitted. Managers may reply to any admin Google review, while staff may reply only to a
review assigned to their authenticated user. An unauthorized staff reply returns the same 404
not-found boundary as a missing review. These controls do not change the public Google review route
or its response shape.

The core feedback record is one PostgreSQL feedback row. Structured rating details and AI output
are JSONB fields on that row. Status history is a separate feedback_timeline_events table with an
event_payload JSONB field. Parent creation writes the feedback row and initial event transactionally.
Issue transitions update `current_status` and insert an event transactionally, while Suggestion
transitions insert the workflow event and payload transactionally. Assignment uses the same timeline
table with `step = 'assigned'`; reassignment updates that current row and does not keep a separate
assignment history. Staff reply status and timeline are persisted in PostgreSQL; email delivery remains
deferred.

Admin feedback database ownership is split by responsibility. The read repository owns list, detail,
snapshot, staff-option, and workflow-record reads. The workflow repository owns Issue and Suggestion
transitions plus persisted reply status/timeline changes. The mutation repository owns delete,
record-level read-state, and assignment mutations. The shared `admin.feedback.sql.ts` module owns
the detail/timeline SQL projection, and `Backend/src/common/utils/database-transaction.ts` owns the
transaction lifecycle. The `admin.feedback.repository.ts` module remains a compatibility facade that
re-exports these module functions and types; it does not execute the PostgreSQL operations itself.

## Current status at a glance

| Area                         | Current source of truth                                                                      | Status                                        |
| ---------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Parent category              | Parent-selected Issue, Suggestion, or Praise                                                 | Confirmed                                     |
| Parent rating                | Five integer ratings from 1 to 5                                                             | Confirmed                                     |
| Aggregate rating             | Average computed by calculateFeedbackRating                                                  | Confirmed                                     |
| Raw written answer           | feedback.raw_answer                                                                          | Confirmed                                     |
| Category prompt              | Frontend FEEDBACK_TYPE_PROMPTS; not stored as a question record                              | Confirmed                                     |
| AI summary and insights      | feedback.ai_insights JSONB                                                                   | Confirmed                                     |
| Raw audio                    | Local Backend/storage/feedback/ file plus feedback.audio_url in development                  | Confirmed                                     |
| Transcript                   | Frontend dictation text appended to the answer; database column exists but is not populated  | Partial                                       |
| Parent and pet names         | pet_owners and pets joins by UUID                                                            | Confirmed for admin reads                     |
| Feedback UUID                | PostgreSQL DEFAULT gen_random_uuid()                                                         | Confirmed                                     |
| Initial/current status       | feedback.current_status; Suggestion workflow status is read from its latest timeline event   | Confirmed                                     |
| Timeline history             | feedback_timeline_events stores initial, progress, Suggestion, and current-assignment events | Confirmed                                     |
| Admin list/detail reads      | admin.feedback.read.repository.ts plus shared admin.feedback.sql.ts                          | Confirmed                                     |
| Record-level read state      | feedback.is_read, updated by mutation repository through database-transaction.ts             | Confirmed                                     |
| Assignment                   | `feedback_timeline_events.step = 'assigned'` with `employees_uuid` as current owner          | Confirmed transactionally                     |
| Issue status mutation        | feedback.current_status plus feedback_timeline_events via workflow repository                | Confirmed transactionally                     |
| Suggestion workflow mutation | feedback_timeline_events.step plus event_payload via workflow repository                     | Confirmed transactionally                     |
| Staff reply                  | `feedback.current_status` plus `sent` timeline event in PostgreSQL                           | Status persisted / email integration deferred |
| Suggestion notification      | Mock internal email log                                                                      | Not persisted to notification table           |
| S3 audio                     | No implementation                                                                            | Planned                                       |

Evidence labels in this document mean:

- Confirmed: directly shown by current source, schema, tests, or a checked command.
- Partial: part of the path is implemented, but an important boundary is incomplete.
- Planned: an intended next behavior, not current runtime behavior.
- Unknown: the repository does not currently prove the behavior.

## One real parent submission

### 1. The parent fills the form

PetParentFeedbackPage.tsx keeps the form state for:

- five ratings: Professional, Service, Communication, Safety, and Cost;
- one parent-selected category: Issue, Suggestion, or Praise;
- one non-empty free-text answer;
- an optional audioBlob produced by the voice input hook.

Submission is blocked until every rating is non-zero, a category is selected, and the answer is
non-empty. The backend also requires an authenticated pet-parent session and verifies that the selected
pet belongs to the current user before running AI analysis or writing feedback. The parent sees “Your
feedback has been sent to the provider.” after the request succeeds when no parent callback overrides the
success path.

The frontend sends the selected pet UUID from
Frontend/src/features/pet-parent/data/mockParentFeedbackContext.ts. It does not send a trusted owner UUID;
the backend derives `pet_owners_uuid` from the authenticated session and joins `pets` to `pet_owners` to
verify ownership. The current fixture remains a fixed demo pet context; a pet selector is not part of this
feedback slice.

### 2. The category creates the prompt

Frontend/src/shared/types/feedback.ts owns the current prompts:

| Category   | Prompt                                              |
| ---------- | --------------------------------------------------- |
| Praise     | What did you appreciate most about your pet's stay? |
| Issue      | What concerned you about your pet's care?           |
| Suggestion | How could we improve your experience?               |

The prompt is a frontend presentation value. It is not sent as qna_list, question, or another
persisted feedback field. The submitted text is stored as raw_answer. The admin detail currently
labels the answer as Parent feedback because the original prompt is not part of the database record.

serviceType, parentName, and petName are also not parent form fields. Admin reads derive the parent
and pet display names by joining the submitted UUIDs to pet_owners and pets; the backend maps
serviceType to an empty string for this feedback contract.

### 3. Optional voice input has two outputs

The voice path is implemented by Frontend/src/shared/dictation/useDictation.ts, called from
FeedbackQuestionSection with `onAudioRecorded`. It requests microphone access only when the parent
presses the button, streams the audio to the Backend `/api/speech/stream` WebSocket (Amazon
Transcribe) for live text, appends the final transcript to the answer, and records the same stream
with MediaRecorder so the raw Blob is forwarded to the parent page on stop.

The transcript and raw recording are separate outputs:

```text
microphone stream
    ├── /api/speech/stream -> transcript text appended to raw_answer in the form
    └── MediaRecorder Blob -> parent submit -> multipart field audio -> local raw file storage
```

The current parent submission path does not put the dictated text into feedback.transcript; the
database transcript column remains available for a later explicit persistence decision. A voice-only
submission with no typed text still depends on dictation returning text, because the parent form
requires a non-empty answer before it submits.

### 4. The browser sends multipart feedback

submitPetParentFeedback in Frontend/src/features/pet-parent/api/feedbackApi.ts creates a FormData
request:

```text
POST http://localhost:3000/api/feedback
Content-Type: multipart/form-data

payload = {
  pet_uuid,
  category,
  rating_details,
  raw_answer
}
audio = optional feedback.webm
```

The parent controller uses Zod to validate the JSON payload and Multer memory storage to receive an
optional file. The authenticated session supplies `pet_owners_uuid` on the server; the browser does
not send a trusted owner UUID. The upload limit is 10 MB. The controller does not transcribe;
dictation is a separate live WebSocket path.

### 5. AI insights run before the database insert

createFeedback in Backend/src/services/parent.feedback.service.ts computes the average rating,
then calls generateFeedbackInsights in Backend/src/services/feedback.service.ts. The structured
output is:

```json
{
  "summary": "one concise sentence",
  "insights": ["up to five objective points"]
}
```

The Zod schema is strict and allows at most five insight strings. The parent-selected category is
passed to the model as context; the model is instructed not to infer or return a new feedback type.

The current Backend provider factory reads `LLM_BASE_URL`, `LLM_MODEL`, and `LLM_API_KEY`. It uses
the native Ollama-compatible adapter for the configured local endpoint and an OpenAI-compatible
adapter for other configured endpoints. The defaults are `http://127.0.0.1:11434/api`,
`qwen2.5-coder:14b`, and the local placeholder key `ollama`.

If insight generation fails, the parent service returns an unavailable error and does not continue
to the database insert. It does not fabricate a summary.

### 6. Raw audio is stored locally in development

Backend/src/services/feedback.audio.storage.ts writes the uploaded bytes to
Backend/storage/feedback/ under a generated UUID filename. The returned database value is a path
such as /uploads/feedback/<generated-name>.webm.

server.ts serves that directory at /uploads/feedback only when NODE_ENV is not production. The admin
AudioTranscript component resolves local paths against the backend origin before passing them to the
native audio element. External https sample URLs remain unchanged. S3 is not connected.

If the database insert fails after the file is written, the parent service removes the local file.

### 7. PostgreSQL creates the feedback UUID, core row, and initial timeline event

createFeedbackRecord in Backend/src/repositories/feedback.repository.ts omits uuid from the INSERT.
PostgreSQL generates it from the schema default and returns it with RETURNING uuid. The repository
writes:

- pet_uuid;
- pet_owners_uuid;
- category;
- current_status = submitted;
- aggregate rating;
- rating_details as JSONB;
- raw_answer;
- audio_url;
- ai_insights as JSONB.

The repository creates the feedback row and its initial timeline event in one transaction. Issue and
Praise use the `submitted` step. Suggestion uses the `captured` step and stores its initial workflow
payload in `event_payload`. The current insert does not write transcript.

### 8. Suggestion notification

For a Suggestion, the parent service calls `notifySuggestionManager` in
Backend/src/services/feedback.notification.service.ts. That function still logs a mock internal email;
it does not insert a row into the notification table. This is separate from the persisted feedback
reply status and is deferred to the later notification/email integration.

## Database model and ownership

The feedback schema is in Backend/src/data/First_version_schema.sql.

### feedback

| Column                 | Current role                                                                                                                            |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| uuid                   | Primary key, generated by PostgreSQL                                                                                                    |
| pet_uuid               | Foreign key to pets.uuid                                                                                                                |
| pet_owners_uuid        | Foreign key to pet_owners.users_uuid                                                                                                    |
| created_at, updated_at | Row timestamps                                                                                                                          |
| category               | Current API values are Issue, Suggestion, Praise; DB column remains free-text VARCHAR                                                   |
| transcript             | Nullable transcript column; current parent insert leaves it null                                                                        |
| is_read                | Global record-level read flag                                                                                                           |
| current_status         | Issue progress value; Suggestion keeps the shared row value at submitted while its workflow status comes from the latest timeline event |
| rating                 | Numeric aggregate constrained to 1.00 to 5.00                                                                                           |
| rating_details         | JSONB object containing the five source ratings                                                                                         |
| raw_answer             | Parent’s submitted free-text answer                                                                                                     |
| audio_url              | Local development path or existing external audio URL                                                                                   |
| ai_insights            | JSONB object containing summary and insights                                                                                            |

### feedback_timeline_events

The table stores feedback_uuid, step, optional employees_uuid, event_payload JSONB NOT NULL DEFAULT
`'{}'::jsonb`, and created_at. The `assigned` step uses employees_uuid as the current feedback
assignee; workflow steps continue to use their event payload/actor semantics.
Its primary key is (feedback_uuid, step), so one feedback cannot currently have two rows with the
same step. The admin feedback read repository reads these rows, event_payload, and the actor
username from users. The shared admin SQL module supplies the detail and timeline projection used
by both the single-detail and full-snapshot reads.
Issue events are mapped to the frontend timeline. Suggestion events use `captured`,
`under_review`, `decision_recorded`, and `closed`; the latest Suggestion event supplies the workflow
status and event_payload supplies its decision fields.

### Related tables used by the admin read path

- pets supplies pet_name.
- pet_owners supplies the parent first and last name.
- users supplies the timeline actor username when a workflow event has an employee UUID; the `assigned`
  event's employee UUID is projected as the current assignee.
- notification and pet_owners_notification exist in the schema and seed data, but the current
  feedback runtime does not persist its mock Suggestion notification through those tables.

The seed section contains five feedback rows, feedback timeline rows, and notification rows. Seed
data is fixture data for local/database setup; it does not prove that runtime mutations use the same
tables.

## Admin read path

### API routes

| Route                                             | Current behavior                                      | Backing                                                   |
| ------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------- |
| GET /api/admin/feedback                           | List feedback with filters and sort                   | admin.feedback.read.repository.ts                         |
| GET /api/admin/feedback/assignees                 | Return shared { id, name } employee options           | PostgreSQL users/employees                                |
| GET /api/admin/feedback/snapshot                  | Read-only full feedback snapshot for admin hydration  | admin.feedback.read.repository.ts + admin.feedback.sql.ts |
| PATCH /api/admin/feedback/assignee                | Legacy assignment mutation for compatibility          | PostgreSQL transaction                                    |
| PATCH /api/admin/feedback/read                    | Mark selected UUIDs read transactionally              | mutation repository + database-transaction.ts             |
| GET /api/admin/feedback/:id                       | Read detail and mark unread record read               | read + mutation repositories                              |
| DELETE /api/admin/feedback/:id                    | Permanently delete one feedback and linked rows       | mutation repository + database-transaction.ts             |
| PATCH /api/admin/feedback/:id/status              | Advance Issue progress and append a DB timeline event | workflow repository + database-transaction.ts             |
| PATCH /api/admin/feedback/:id/suggestion-workflow | Advance Suggestion workflow and persist event payload | workflow repository + database-transaction.ts             |
| POST /api/admin/feedback/:id/reply                | Persist `sent` status and timeline; email deferred    | workflow repository + database-transaction.ts             |

The route order keeps /assignees and /snapshot ahead of /:id, so the collections are not interpreted
as feedback UUIDs.

### List filters, search, and sort

listAdminFeedbackRecords in Backend/src/repositories/admin.feedback.read.repository.ts performs the
list query in PostgreSQL. The compatibility admin.feedback.repository.ts facade re-exports this
function for existing callers:

- search checks parent name, pet name, raw_answer, and ai_insights.summary with ILIKE;
- category filters by Issue, Suggestion, or Praise;
- status filters by global feedback.is_read;
- time filters support all time, the last 7 days, the last 30 days, or an inclusive custom Auckland
  calendar-date range; Frontend snapshot selectors use the same Auckland calendar-date semantics;
- rating filters are low (<= 2), medium (> 2 and < 4), and high (>= 4);
- sorting supports newest, oldest, highest rating, and lowest rating with UUID tie-breakers.

The controller rejects malformed filters and requires both dates for a custom range. The existing
list API remains available for compatibility and server-side consumers. The normal admin feedback
flow hydrates the full snapshot once, then applies these selectors in the frontend store instead of
requesting the database for each control change.

### List and detail UI

AdminFeedbackPage.tsx provides:

- table/card presentation modes;
- type, read-state, time, rating, and sort controls;
- database-backed list loading;
- one read-only snapshot load when the feedback section is entered;
- normalized feedback records in Zustand for list, sidebar, and detail rendering;
- Card selection mode for the bulk Mark reviewed action;
- card Mark reviewed action;
- card Delete action with explicit confirmation and server-confirmed removal;
- five-item Load More Feedback presentation pagination.

Card view is the reading surface with optional bulk Mark reviewed. Table view is the reading, status,
and reply/detail surface; it has no assignment selection or assignee column.
The Table keeps the first column compact, shows a separate Auckland-local `Submitted` date/time with
seconds, and does not render the AI summary. Card view keeps the AI summary and shows the same precise
submitted time. The category tag is derived from the DB category value; it is not a separate tag table.

FeedbackSidebarList.tsx reads the hydrated Zustand snapshot for sidebar search, category, time, and
rating filtering. Selecting a sidebar row changes /admin/feedback/:id; an already hydrated detail
does not issue another list or detail GET.

### Detail read and display mapping

getAdminFeedbackRecord in Backend/src/repositories/admin.feedback.read.repository.ts reads the
following through the shared detail SQL projection in Backend/src/repositories/admin.feedback.sql.ts:

- parent and pet names through joins;
- category, read flag, current status, aggregate rating;
- rating_details, raw_answer, transcript, audio URL, and AI JSON;
- timeline events, actor usernames, and the current persisted assignee UUID.

getDetail in Backend/src/services/admin.feedback.read.service.ts maps those fields to the frontend detail
contract. It derives questions: ['Parent feedback'] when raw_answer exists, because the original
category prompt is not persisted. It sets serviceType and walkId to empty compatibility values and
maps assigneeId from the persisted `assigned` timeline event, or null when no assignment exists.

Opening an unread detail calls `markFeedbackRecordsAsRead` in
Backend/src/repositories/admin.feedback.mutation.repository.ts through
Backend/src/common/utils/database-transaction.ts and returns the detail as read. This is one global
record-level flag; it is not a separate manager read receipt or staff task read state.

The detail page renders:

- AI summary and up to five insights;
- original ratings and raw answer;
- transcript when the database provides one;
- native raw-audio playback when audio_url exists;
- Issue progress tab when the category is Issue;
- Suggestion Review tab when the category is Suggestion.

The normal admin route reads detail records from the hydrated snapshot. The compatibility
`GET /api/admin/feedback/:id` path still reads PostgreSQL and marks an unread record as read. The
admin read service maps the latest Suggestion timeline events and their event_payload into
`suggestionWorkflow`. The
`20260825_backfill_legacy_suggestion_workflow_events.sql` migration restores the initial `captured`
event for legacy Suggestion records that do not have a workflow event. Until that migration is
applied to a legacy record, the detail page keeps the explicit unavailable/pending fallback instead
of claiming that a persisted decision record exists. The
`20260825_backfill_missing_submitted_feedback_events.sql` migration restores missing `submitted`
events for legacy Issue/Praise records using `feedback.created_at`, so the event remains anchored to
the parent submission time rather than a staff review action. It has been applied to the configured
2026-08-25 target and verified with zero remaining missing events. The progress renderer also derives
completion from the ordered current status while an affected legacy row is awaiting migration.

## Frontend projection state

feedbackStore.ts contains:

```text
feedbackByUuid: Record<feedbackUuid, AdminFeedback>
feedbackUuids: string[]
snapshotStatus: idle | loading | ready | error
```

The feedback section hydrates these fields from the read-only snapshot endpoint. List, sidebar, and
detail components select records by UUID. Mutation responses replace only the matching record, so card
switching does not reload the whole page. The API may still return historical `assigneeId` data for
compatibility, but the current Feedback UI does not render or update it.

Card deletion removes the feedback UUID from Zustand only after the Backend DELETE request succeeds. A
failed or rolled-back deletion leaves the Card visible.

The legacy server assignment mutation still accepts selected feedback UUIDs and one employee UUID.
The Backend validates the employee through `employees.users_uuid`, locks all requested feedback rows,
and upserts one `(feedback_uuid, 'assigned')` timeline row in the same transaction. The current
Frontend does not invoke this path.

This is intentionally separate from:

- feedback.is_read, which is currently persisted in PostgreSQL;
- feedback.current_status, which is persisted for Issue progress in PostgreSQL;
- Suggestion decision state, which is persisted in PostgreSQL timeline event_payload.

## Internal function checklist: expected versus actual behavior

This checklist uses the current project decisions as the expected behavior: one feedback record with
JSON fields, timeline/status owned by the feedback system, no persisted category question text or
serviceType on parent submission, raw audio saved locally for now, and staff list/detail reads from
the database.

### Parent intake, voice, and AI

| Function / source                  | Expected behavior                                                                             | Actual code behavior                                                                                                                          | Status / remaining gap        |
| ---------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| PetParentFeedbackPage.handleSubmit | Require five ratings, category, and answer; submit once; show confirmation                    | Performs those checks, calls submit API, and shows provider confirmation on success                                                           | Aligned                       |
| submitPetParentFeedback            | Send UUIDs, category, five ratings, raw answer, and optional original audio                   | Sends multipart payload plus optional feedback.webm; does not send prompt text or service type                                                | Aligned                       |
| useDictation (onAudioRecorded)     | Capture the original parent recording                                                         | Uses getUserMedia + MediaRecorder on the dictation stream and forwards one Blob when dictation stops                                          | Aligned for local development |
| useDictation (transcription)       | Transcribe the speech into the answer while preserving original audio                         | Streams PCM to `/api/speech/stream` and appends the final text; failures leave the raw Blob available but still require non-empty answer text | Partial voice-only fallback   |
| feedback.controller.submitFeedback | Validate payload and optional audio before service execution                                  | Zod validates UUIDs/category/ratings/raw answer; Multer memory upload is limited to 10 MB                                                     | Aligned                       |
| generateFeedbackInsights           | Produce objective summary plus up to five insights without changing category                  | Uses strict structured output and passes category as context only                                                                             | Aligned                       |
| saveFeedbackAudio                  | Store original audio locally until S3 is connected                                            | Writes generated filename to Backend/storage/feedback/ and returns /uploads/feedback/...                                                      | Local-only boundary           |
| createFeedback                     | Run AI, save audio, insert DB record and initial timeline event, and preserve core submission | Runs AI before insert, saves audio, and transactionally inserts feedback plus `submitted`/`captured` event                                    | Partial: no DB transcript     |
| notifySuggestionManager            | Create a durable notification for a new Suggestion                                            | Logs a mock internal email through sendInternalEmail                                                                                          | Not persisted                 |

### Feedback persistence and schema

| Function / source            | Expected behavior                                                                | Actual code behavior                                                                                                                         | Status / remaining gap          |
| ---------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| feedback.uuid schema default | Let PostgreSQL generate every feedback UUID                                      | DEFAULT gen_random_uuid() and repository omits UUID from INSERT                                                                              | Aligned                         |
| calculateFeedbackRating      | Compute aggregate from five source ratings                                       | Returns arithmetic average; DB stores numeric value with 1 to 5 constraint                                                                   | Aligned                         |
| createFeedbackRecord         | Persist one core feedback row and its initial timeline event transactionally     | Inserts category, submitted status, rating, rating_details, raw answer, audio URL, AI JSON, and the category-specific initial timeline event | Partial: no transcript          |
| feedback.rating_details      | Store five source scores as JSON                                                 | JSONB stores Professional, Service, Communication, Safety, Cost                                                                              | Aligned                         |
| feedback.ai_insights         | Store summary and insights together                                              | JSONB stores { summary, insights }; admin maps them separately                                                                               | Aligned                         |
| feedback_timeline_events     | Store durable progress, Suggestion workflow, current-assignment, and reply state | Stores initial events, transactional Issue/Suggestion transitions, the upserted `assigned` event, and the persisted `sent` reply event       | Aligned; email remains deferred |
| feedback.category            | Restrict runtime values to current taxonomy                                      | API Zod restricts values; DB column remains free-text VARCHAR                                                                                | API-enforced only               |
| Question/prompt persistence  | Avoid storing generated prompt text in feedback record                           | Prompt remains frontend-only; admin uses Parent feedback placeholder                                                                         | Aligned with current decision   |
| Parent/pet display names     | Resolve names from UUIDs                                                         | admin.feedback.read.repository.ts joins pet_owners and pets                                                                                  | Aligned for admin reads         |

### Admin database reads and filters

| Function / source              | Expected behavior                                      | Actual code behavior                                                                                              | Status / remaining gap    |
| ------------------------------ | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ------------------------- |
| listAdminFeedbackRecords       | Query the DB, not a local mock, for staff list         | Joins feedback/pets/owners and applies search, category, read, time, rating, and sort SQL                         | Aligned                   |
| listAdminFeedbackDetailRecords | Load one read-only full snapshot for admin hydration   | Joins feedback/pets/owners and aggregates all timeline actors in one PostgreSQL query; does not mark records read | Aligned for snapshot path |
| getAdminFeedbackRecord         | Read complete detail, JSON fields, audio, and timeline | Reads all listed fields and aggregates timeline actors                                                            | Aligned for read path     |
| adminService.getList           | Map DB rows to frontend list contract                  | Maps names, date, summary, rating, category, read state, current status, and persisted assignee UUID              | Aligned                   |
| adminService.getDetail         | Return DB detail and mark unread record read           | Reads DB detail, calls read transaction when needed, returns is_read: true                                        | Aligned                   |
| markFeedbackRecordsAsRead      | All-or-nothing read update                             | Locks UUIDs, rolls back if any UUID is missing, updates all valid rows in one transaction                         | Aligned                   |
| fetchFeedbackList              | Keep the filtered list API available for compatibility | Serializes search/category/status/sort/time/rating/custom dates                                                   | Compatibility path        |
| fetchFeedbackSnapshot          | Hydrate complete admin feedback data once              | Reads full details and timeline without a read-state mutation                                                     | Aligned for snapshot path |
| FeedbackSidebarList            | Use the hydrated snapshot for detail navigation        | Applies type/time/rating/search selectors locally and changes the detail UUID route                               | Aligned for snapshot path |
| AudioTranscript                | Let staff hear original raw audio                      | Resolves local upload path to backend origin and uses native audio; external URLs remain supported                | Development path aligned  |

### Staff actions and state changes

| Function / source                                    | Expected behavior                                            | Actual code behavior                                                                                                                                                                                       | Status / remaining gap                           |
| ---------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Current Feedback UI assignment                       | Do not expose Manager-to-Staff assignment                    | The Frontend has no assignment control, assignment selection state, or assignee presentation; the legacy server mutation remains available for compatibility                                               | Intentionally removed from current UI            |
| useFeedbackActions.deleteFeedback                    | Permanently remove one Card after confirmation               | Calls the authenticated DELETE route, removes the UUID from Zustand only after success, clears selection, and preserves the Card on failure                                                                | Aligned for Card deletion                        |
| getAssignees / listEmployeeStaffOptions              | Return shared employee options                               | Reads `{ id, name }` from users joined to employees; the current Pet Assignment editor still consumes this response                                                                                        | Retained shared boundary                         |
| assignFeedbackRecords                                | Persist legacy feedback ownership                            | Transactionally validates employee UUID, locks feedback rows, updates feedback.updated_at, and upserts the `assigned` timeline event                                                                       | Retained server compatibility                    |
| deleteFeedbackRecord                                 | Delete one feedback and related relational rows atomically   | Deletes linked notifications, deletes the feedback row, relies on timeline `ON DELETE CASCADE`, commits on success, and rolls back on failure                                                              | Aligned for Card deletion                        |
| updateFeedbackStatus API + adminService.updateStatus | Persist Issue status and append a durable timeline event     | Validates the expected transition, updates `feedback.current_status`, and inserts the timeline event in one PostgreSQL transaction                                                                         | Aligned for Issue progress                       |
| InteractionProgress                                  | Render the durable status timeline for Issue                 | Renders the Issue events returned by the PostgreSQL detail read                                                                                                                                            | Aligned for Issue progress                       |
| updateSuggestionWorkflow API + service               | Persist Suggestion progress/decision state in agreed storage | Validates the workflow transition and required decision fields, then inserts a PostgreSQL timeline event with `event_payload` in one transaction                                                           | Aligned for initialized Suggestions              |
| SuggestionReview                                     | Show a real persisted decision record when one exists        | Maps PostgreSQL Suggestion timeline events and payload into `suggestionWorkflow`; the legacy backfill migration restores missing initial events, while the fallback remains for records not yet backfilled | Aligned with migration; fallback remains pending |
| replyToFeedback                                      | Store a staff response status transition; email is deferred  | Updates `feedback.current_status` to `sent` and upserts the `sent` PostgreSQL timeline event                                                                                                               | DB status aligned; no real email yet             |

### Notification and external boundaries

| Function / source                | Expected behavior                                                 | Actual code behavior                                                                                                  | Status / remaining gap                                             |
| -------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| feedback.notification.service.ts | Send or persist a new Suggestion notification                     | Writes a mock email message to server console                                                                         | No runtime notification table insert                               |
| notification seed in SQL         | Provide local fixture notifications                               | Seed rows exist for database setup                                                                                    | Fixture only                                                       |
| Admin notification UI            | Read feedback notifications from DB                               | AdminNotificationPopover and notification page use frontend mock notification data                                    | Not connected to feedback notification rows                        |
| speech.websocket.ts              | Provide live transcription                                        | Relays dictation audio to the local Whisper speech service (`npm run dev:speech`)                                     | Needs the speech service running; live availability not guaranteed |
| llmProvider                      | Provide local structured summary generation                       | Uses the configured LLM factory and model                                                                             | Provider path; live model availability must be checked separately  |
| google.review.ai.service.ts      | Generate one Google review summary and first-pass triage          | Uses a separate strict Google review prompt and `llmProvider`; rating-only reviews use a bounded deterministic result | Local path; live model availability must be checked separately     |
| external_feedback.ai_insights    | Persist Google review AI output separately from internal feedback | New Google review creation writes summary, triage type, and confidence in the same transaction as the review          | Confirmed for the current mock write path                          |
| Local audio static route         | Let development staff browser request uploaded file               | server.ts exposes /uploads/feedback only outside production                                                           | Development only                                                   |
| S3/object storage                | Store audio outside local filesystem                              | No S3 integration exists                                                                                              | Planned                                                            |

## Remaining migration checklist

These are the items that still need implementation if the expected behavior is to be fully DB-backed:

- [x] Store one core feedback record in PostgreSQL.
- [x] Let PostgreSQL generate feedback UUIDs.
- [x] Store aggregate rating and rating_details JSONB.
- [x] Store raw_answer, audio_url, and structured AI ai_insights JSONB.
- [x] Resolve parent and pet names from their UUIDs for admin reads.
- [x] Read admin list/detail data from PostgreSQL.
- [x] Apply staff list search, category/status/time/rating filters, and sorting in SQL.
- [x] Mark record-level is_read through a transaction.
- [x] Retain the existing server-side feedback assignment persistence for compatibility; the current
      admin Feedback UI no longer exposes this action and no schema change or migration is required.
- [x] Play local raw audio in development when audio_url is present.
- [x] Insert the category-specific initial timeline event into feedback_timeline_events for every new
      feedback: `submitted` for Issue/Praise and `captured` with workflow payload for Suggestion.
- [x] Keep Issue status mutation in PostgreSQL and write the current status and timeline row
      transactionally.
- [x] Move Suggestion progress/decision state to feedback_timeline_events.event_payload and keep the
      selected persistence behavior consistent after reload.
- [x] Store Suggestion statuses in feedback_timeline_events and map the latest event into
      `suggestionWorkflow` for admin list/detail reads.
- [x] Provide a rerunnable migration to backfill the initial `captured` event for legacy Suggestion
      records without an existing Suggestion workflow event; records not yet backfilled retain the
      explicit unavailable/pending fallback.
- [x] Provide and apply a rerunnable migration to backfill the initial `submitted` event for legacy
      Issue/Praise records using feedback.created_at; the verified target has zero remaining missing
      events and all three backfilled timestamps match feedback.created_at.
- [x] Persist staff reply status and timeline state in PostgreSQL; keep actual email delivery deferred.
- [ ] Connect runtime Suggestion notifications to notification and its owner join table, if the
      notification feature remains in scope.
- [x] Require a signed authenticated parent session for feedback submission, derive the owner from the
      session, and verify the selected pet belongs to that owner.
- [x] Require a signed authenticated employee session for admin feedback reads and mutations, and derive
      Issue/Suggestion workflow actors from the session user UUID. Staff/manager fine-grained permissions
      and pet visibility rules remain deferred.
- [ ] Decide whether to persist the dictated transcript in feedback.transcript or explicitly keep
      the transcript display-only.
- [ ] Connect S3/object storage before enabling production audio retrieval.
- [ ] Add a browser-level test for voice recording, raw audio upload, backend static retrieval, and
      staff detail playback if that verification becomes required.

## API and command map

### Parent and AI routes

| Route                                    | Purpose                                                                                          |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------ |
| POST /api/feedback                       | Validate and create parent feedback with optional audio                                          |
| POST /api/feedback/generate-insights     | Signed-in parents only, 10 calls a minute; parent submit uses the service directly instead       |
| POST /api/google-reviews                 | Create a mock Google review, generate Google AI insights, and persist the review transactionally |
| GET /api/admin/google-reviews            | Manager: all reviews; staff: only reviews assigned to `req.user.id`                              |
| PATCH /api/admin/google-reviews/assignee | Manager-only transactional assignment through external_feedback ownership metadata               |
| WebSocket /api/speech/stream             | Live dictation socket used by `useDictation`; relays audio to the local Whisper speech service   |

### Admin feedback routes

| Route                                             | Purpose                                                    |
| ------------------------------------------------- | ---------------------------------------------------------- |
| GET /api/admin/feedback                           | PostgreSQL-backed list                                     |
| GET /api/admin/feedback/assignees                 | PostgreSQL employee option list                            |
| PATCH /api/admin/feedback/assignee                | PostgreSQL current-assignee mutation                       |
| PATCH /api/admin/feedback/read                    | PostgreSQL record-level read update                        |
| GET /api/admin/feedback/:id                       | PostgreSQL-backed detail plus read-on-open                 |
| DELETE /api/admin/feedback/:id                    | PostgreSQL transactional hard delete                       |
| PATCH /api/admin/feedback/:id/status              | PostgreSQL-backed Issue status mutation                    |
| PATCH /api/admin/feedback/:id/suggestion-workflow | PostgreSQL-backed Suggestion workflow mutation             |
| POST /api/admin/feedback/:id/reply                | PostgreSQL-backed status/timeline mutation; email deferred |

All persisted parent and admin feedback routes use the local signed HttpOnly session cookie. The draft
`/api/feedback/generate-insights` endpoint now sits inside the same boundary: it needs a pet-parent
session and a trusted origin, has a per-account budget because each call is billed by the model
provider, and answers `400` for malformed input and a plain `500` without the provider's error text
when the model fails. This demo does not
use a session table or provide server-side revocation for a stolen cookie before its eight-hour expiry.

### Local commands

From the repository root:

```bash
# Backend + Frontend (the Backend also serves live dictation)
npm run dev

# Or run the process groups separately
npm run dev:backend
npm run dev:frontend

# Optional local PostgreSQL test database; normal application traffic uses POSTGRESQL_URL for Neon
npm run db:up
npm run db:reset

# Focused package checks
npm run test --prefix Backend
npm run test --prefix Frontend
npm run build --prefix Backend
npm run build --prefix Frontend
npm run lint
npx prettier --check Frontend/src Backend/src docs/feedback-system.md
```

npm run dev starts Backend, the local AI service, and Frontend through the root dev:backend and
dev:frontend scripts. If the process groups are started separately, dev:backend starts Backend plus
the AI service, while dev:frontend starts only Frontend. Avoid launching duplicate processes when
using the combined script. The database connection is read from `POSTGRESQL_URL` for the normal
Neon application path. `DATABASE_URL` is not supported or read; credentials must not be copied into
documentation.

## Verification evidence

The current tests cover these contracts:

- Parent UI form validation, category prompt changes, submit request shape, and success confirmation:
  `Frontend/src/features/pet-parent/components/feedback/__tests__/FeedbackPage.test.tsx`
- Voice transcript append and audio Blob forwarding:
  `Frontend/src/shared/dictation/__tests__/useDictation.test.ts`
- Feedback UUID generation contract:
  `Backend/src/__tests__/feedback.repository.test.ts`
- Parent service AI mapping, persistence calls, and local audio cleanup:
  `Backend/src/__tests__/parent.feedback.service.test.ts`
- Parent/admin API validation and route contracts:
  `Backend/src/__tests__/feedback.api.test.ts`
- Admin SQL joins, filters, detail mapping, and read transaction behavior:
  `Backend/src/__tests__/admin.feedback.repository.test.ts`
- Admin feedback deletion transaction, authentication, and PostgreSQL read-back:
  `Backend/src/__tests__/admin.feedback.repository.test.ts`,
  `Backend/src/__tests__/admin.feedback.auth.test.ts`, and
  `Backend/src/__tests__/api.postgres.admin-feedback.test.ts`
- Admin list, filters, selection, mark-read, persisted assignment API, assignment failure handling, and
  assignee projection:
  `Frontend/src/features/admin/pages/__tests__/AdminFeedbackPage.test.tsx` and
  `Frontend/src/features/admin/store/__tests__/feedbackStore.test.ts`, plus
  `Backend/src/__tests__/feedback.api.test.ts` and
  `Backend/src/__tests__/admin.feedback.repository.test.ts`
- Raw audio URL mapping and play/pause UI:
  `Frontend/src/features/admin/components/feedback/detail/__tests__/AudioTranscript.test.tsx`

The Playwright spec is available at playWright/parent-feedback.persistence.spec.ts and runs with:

```bash
npm run test:e2e:parent-feedback
```

It starts the Backend and Frontend, submits text feedback with the configured local LLM provider,
reads the created row from PostgreSQL, and cleans up feedback plus related timeline/notification
rows in a transaction. It does not currently exercise microphone capture, live dictation, raw audio
retrieval, or the staff/admin browser flow.

The 2026-08-26 verification for the current assignment implementation reported:

- Frontend admin feedback suite: 11 test files, 40 tests passed;
- Backend admin feedback repository suite: 16 tests passed;
- Backend admin feedback API suite: 43 tests passed;
- Frontend and Backend builds passed;
- root lint passed;
- scoped Prettier check passed;
- git diff --check passed;
- read-only configured database preflight confirmed `feedback`, `employees`, and
  `feedback_timeline_events` exist, with `employees_uuid` present, 5 employees, and 8 feedback rows.

Those results verify the listed unit/API/build contracts. They do not prove S3 behavior, production
audio serving, live speech service availability, live configured LLM availability, authenticated multi-user
ownership, or staff browser E2E behavior.

## Source map

| Concern                               | Source of truth                                                                                                                                                                  |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Parent form and submit UI             | Frontend/src/features/pet-parent/pages/PetParentFeedbackPage.tsx                                                                                                                 |
| Parent request contract               | Frontend/src/features/pet-parent/api/feedbackApi.ts and Backend/src/controllers/feedback.controller.ts                                                                           |
| Category values/prompts               | Frontend/src/shared/types/feedback.ts                                                                                                                                            |
| Voice capture/transcription           | Frontend/src/shared/dictation/ and Backend/src/common/websocket/speech.websocket.ts                                                                                              |
| AI summary contract                   | Backend/src/services/feedback.service.ts and Backend/src/services/llm.service.ts                                                                                                 |
| Audio local storage                   | Backend/src/services/feedback.audio.storage.ts and Backend/src/server.ts                                                                                                         |
| Feedback schema and seed              | Backend/src/data/First_version_schema.sql                                                                                                                                        |
| Parent DB insert                      | Backend/src/repositories/feedback.repository.ts                                                                                                                                  |
| Admin DB reads                        | Backend/src/repositories/admin.feedback.read.repository.ts and Backend/src/repositories/admin.feedback.sql.ts                                                                    |
| Admin workflow/reply mutations        | Backend/src/repositories/admin.feedback.workflow.repository.ts and Backend/src/common/utils/database-transaction.ts                                                              |
| Admin delete/read-state/assignment    | Backend/src/repositories/admin.feedback.mutation.repository.ts and Backend/src/common/utils/database-transaction.ts                                                              |
| Admin list/detail mapping             | Backend/src/services/admin.feedback.read.service.ts                                                                                                                              |
| Admin frontend filters/views          | Frontend/src/features/admin/pages/AdminFeedbackPage.tsx, FeedbackFilterBar.tsx, and FeedbackSidebarList.tsx                                                                      |
| Assignment persistence and projection | Backend/src/repositories/admin.feedback.mutation.repository.ts, Backend/src/services/admin.feedback.read.service.ts, and Frontend/src/features/admin/hooks/useFeedbackActions.ts |
| Frontend assignment projection        | Frontend/src/features/admin/store/feedbackStore.ts                                                                                                                               |
| Deferred external integration         | Backend/src/services/feedback.notification.service.ts and the future staff reply email provider                                                                                  |

Evidence status: Confirmed unless a row or section is explicitly marked Partial, Planned, or Unknown.
