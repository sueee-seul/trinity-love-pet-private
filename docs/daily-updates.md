# Daily updates, the arrival note and the stay report

**Audience:** engineers working on the parent pages and the booking job.
**Status:** as implemented on branch `simplify_consumer_flows`, 2026-10-05.

Scenario 11 asks for a proactive daily update with a photo and a plain summary, in the parent's
language, that staff never have to write, and, as a stretch goal, a "how the stay went" report at
pick-up. Both come from the records the facility already keeps; nothing is invented and no model is
called. A short "settled in" note on the drop-off day covers the hours between the drop-off and the
first update, which the scenario calls the parents' "radio silence".

## When and to whom

The booking job (`booking.jobs.ts`, every 15 minutes) calls `runDailySummaryPass`. For each pet that
is checked in and not yet picked up:

| Piece        | When                                                                                                                                                   | Kind in `daily_summaries` | Bell notice            |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- | ---------------------- |
| Arrival note | On the drop-off day, 90 minutes after the desk recorded the arrival (`booking_pets.check_in_recorded_at`), before the update hour, outside quiet hours | `arrival`                 | `booking_arrival_note` |
| Daily update | From the owner's update hour (default 17:00 Auckland)                                                                                                  | `daily`                   | `booking_daily_update` |
| Stay report  | From the update hour on the pick-up day                                                                                                                | `stay_report`             | `booking_stay_report`  |

Each is written once (unique per stay, day and kind; migrations `20261007_daily_summaries.sql` and
`20261008_notification_preferences.sql`), so a second server or a second pass sends nothing twice.
Every piece is a parent notice in the bell and, when SES is configured and the parent has not
turned update emails off, an email with a link to Live care. The text is factual with no offer in
it, so it is a transactional message under the Unsolicited Electronic Messages Act 2007 s 6 and
needs no marketing consent.

## The parent's preferences

`notification_preferences` (one row per owner, defaults when there is none) holds the language the
updates and their emails are written in (`en` or `zh`), the update hour, quiet hours and whether
updates are emailed. `GET` and `PUT /api/parent/profile/notification-preferences` read and change
them (`notification.preferences.contract.ts`; `PUT` takes any subset of the fields). The response
carries `saved`, false until the parent chose something, so the page can set the language once from
the language switch without ever overwriting a saved choice. `isQuietHour` in
`notification-preferences.service.ts` is the rule for anything proactive that is not a safety
notice; the daily update ignores it because its hour is the parent's own choice.

## What the words come from

`daily-summary.compose.ts` decides what is true from the records; `daily-summary.words.ts` holds the
sentences in English and Chinese. Both are pure and tested sentence by sentence:

| Part        | Source                                                                | Rule                                                                                        |
| ----------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Meals       | the day's "Feeding" tasks                                             | done of planned; "all" when every one is ticked                                             |
| Exercise    | completed tasks whose title has "walk" or "play", plus other add-ons  | counts only; known add-on names are translated, unknown ones stay as staff wrote them       |
| Medication  | the dose record (`medication_administrations`)                        | a dose is named as given only when ticked; due and overdue doses are said to be unrecorded  |
| Staff notes | the description of completed tasks, at most two, up to 160 characters | shown as written (staff write in English)                                                   |
| Photos      | `media_logs` on the day's tasks                                       | photos and short videos counted apart; the newest video, else the newest photo, rides along |

When Bedrock is set up (`BEDROCK_*`, or the `CONCIERGE_BEDROCK_*` values; see
`Backend/src/config/bedrock.ts`), `daily-summary.writer.ts` asks Claude to reword the composer's
record as a warm note in the parent's language. The model gets the record and nothing else. A
checker then holds the note to the record: every number must appear in the record, a medicine may
be named only as the record names it and never as given unless the record says so, the pet must
be named, the language must be the parent's, no link, at most 700 characters. A note that fails,
or a model that is down, means the record is sent as written; `facts.writtenBy` on the row says
which went out (`model` or `record`). The arrival note and the stay report are always the record.

Staff-only tasks (`task_type = 'staff'`) are never read, so an incident write-up cannot leak into
an update. The stay report sums the same counts over every day of the stay and adds medication
adherence (given, not given, without a record) with a line asking the parent to share it with the
vet when anything was missed. Each row stores the `locale` it was written in; Live care shows the
body as delivered.

## Photos and short videos

Staff attach photos or short videos to a care task from the same upload button on the task pages
(`POST /api/tasks/:taskId/photos`, field `photos`, at most 3 files per task in all). No column was
added: a video is a row in `media_logs` like a photo, and the stored name's extension (`.mp4`,
`.mov`, `.webm`) says which one it is. `Backend/src/services/task.media.ts` is the one place that
reads that rule; the staff pages mirror it in `features/admin/components/tasks/taskMedia.ts`.

The files live in the Neon project's object storage under `tasks/<stored name>`
(`task.photo.storage.ts`), so every server and every checkout sees the same photos; `media_logs`
keeps only the stored name. The browser never gets the storage address: the photo routes check who
is asking, then pass the bytes on, Range requests included. Photos saved on a local disk before
this change are moved with `npm run media:upload-tasks --prefix Backend -- <folder>` (default
`Backend/storage/tasks`); it skips files already in the store and is safe to run again.

The upload is checked at the boundary (`task.media.file.ts`), never by the browser's MIME type
alone:

- A video is a video only when its first bytes say so: an ISO `ftyp` box with an MP4 or QuickTime
  brand, or an EBML header with the `webm` DocType. HEIC and AVIF photos use the same box with
  other brands, so they never pass as video. The stored extension comes from the bytes.
- A file named or typed as a video whose bytes are not one (a renamed photo) is refused with 400.
- A video may be up to 30 MB (413 above that; multer stops reading at the cap) and up to 60 seconds
  when the MP4 or MOV header gives its length (`task.media.mp4.ts`). WebM length is not read.
- Photos keep their earlier rule: an image MIME type, up to 10 MB.

`GET /api/tasks/:taskId/photos/:name` serves a video as `video/mp4`, `video/quicktime` or
`video/webm`, with `Accept-Ranges` and 206 answers to Range requests so a browser can seek. The
authorisation is the photo route's: staff, or the pet's own parent.

The daily update and the arrival note carry one item: the newest video of the day when there is
one, otherwise the newest photo. The path is stored in `daily_summaries.photo_path` as before, and
`GET /api/petparent/stays/:bookingPetId/summaries` adds `media: { kind: 'photo' | 'video', url }`
next to the old `photoPath`. The words name it: "There is a short video of Bella from today with
this update on Live care." (the same sentence in Chinese), and the
arrival note says "A short video from today is on Live care." instead of the photo line. Live care
plays it in a `<video controls muted playsInline preload="metadata">` with a spoken name; it never
plays by itself. The care timeline's photo viewers show images only, so a task's videos are left
out of the timeline and reach the parent through the update. No poster image is made, so the
browser shows the clip's first frame.

## The stay's memory

Right after the daily update, `writeStayMemoryNote` (`stay-memory.service.ts`) writes one note per
pet per day into `stay_memory_notes` (migration `20261009_stay_memory_notes.sql`), in the parent's
language: the day of the stay, appetite with the trend against the day before, activity, medication,
up to two staff notes and the photo count (videos are not counted there). The facts sit beside the words, so the next note compares
days without parsing text. Two days of eating less than planned raise a normal escalation to staff
(source `behaviour_trend`, stretch goal 2) and put a watch line in the note. `GET
/api/petparent/stays/:bookingPetId/memory` returns the notes newest first; the parent chat should
inject the latest ones into its context (`docs/in-stay-change-tools.md`).

## The link for the vet

`GET /api/petparent/stays/:bookingPetId/report/share-link` (owner) returns a path with a signed
token good for 30 days. `GET /api/share/stay-report/:token` (no sign-in, rate limited) renders a
printable page with the stay report, the dose record day by day and the memory notes, and nothing
about the parent. An expired or forged link gets a short page with status 410.

## Reading them back

`GET /api/petparent/stays/:bookingPetId/summaries` returns the stay's pieces newest first (report
first on the last day), owner scoped. Live care shows them beside the day's care; the bell shows a
Chinese body as written and gives an English body a general Chinese line on the Chinese page.

## Not done yet

- Videos in the care timeline and the photo carousel, a poster image for each video, and videos in
  the chat's event cards. The stay report still counts videos among its photos.

- A model-written warmer paragraph on top of the factual lines, behind a setting, with a check that
  every sentence maps to a recorded fact.
- Translating the staff notes inside the update (the page already translates care notes).
- Push or SMS delivery.
