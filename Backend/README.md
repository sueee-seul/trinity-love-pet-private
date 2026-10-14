# Backend API

The Backend is an Express 5 API written in TypeScript. It listens on port `3000` by default and
uses Router → Controller → Service → Repository boundaries. PostgreSQL-backed authentication,
feedback, pet list, staff/profile, and KPI dashboard data use the pooled Neon connection configured
by `POSTGRESQL_URL`.

For the complete repository setup, cross-platform startup instructions, Frontend routes, persistence
boundaries, and current limitations, read the [root README](../README.md).

## Setup

From the repository root, install the Backend dependencies and create its environment file:

**macOS**

```bash
npm ci --prefix Backend
cp Backend/.env.example Backend/.env
```

**Windows PowerShell**

```bash
npm ci --prefix Backend
Copy-Item Backend/.env.example Backend/.env
```

Set at least:

- `POSTGRESQL_URL` to the team's pooled Neon connection for PostgreSQL-backed auth, feedback, pets,
  and profile/staff behavior.
- `AUTH_SESSION_SECRET` for signed login sessions.
- `REVIEWER_SESSION_SECRET` for signed Maps reviewer sessions. It is separate from
  `AUTH_SESSION_SECRET` and has no fallback.
- `REVIEW_SIMULATOR_SECRET` for the server-side-only synthetic review endpoint.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` when Google login is required.
- `NEON_S3_BUCKET` and the four `AWS_*` variables for Neon Object Storage. Google Review photos
  and profile/pet images use the same S3-compatible bucket. Review images are uploaded by the
  Backend; profile and pet images use a short-lived presigned PUT URL so the browser sends the
  file directly to storage. Profile records store only the resulting public object URL.

The copied environment example enables `EXPOSE_LOCAL_PASSWORD_RESET_URL=true` for local/test-only
password-reset verification when no email provider is configured. Production never exposes the reset
URL, regardless of this setting.

For optional local Docker development or API tests, the connection string is:

```bash
postgresql://postgres:postgres@127.0.0.1:5433/tropical_love_pet
```

Start that optional database from the repository root with `npm run db:up`, then point
`POSTGRESQL_URL` at it for the current process. The normal application setup connects directly to
Neon. The Backend can listen without PostgreSQL, but `/api/health` returns `503` and database-backed
routes cannot complete.

Run the development server with:

```bash
npm run dev
```

Build and run the compiled server with:

```bash
npm run build
npm start
```

## Database behavior

`POSTGRESQL_URL` is the only database connection variable read by the current runtime.
`DATABASE_URL` is not supported or read. The final Neon schema is
[`database/neon.sql`](database/neon.sql). The normal Neon
database must already have the schema and required fixtures; the application does not automatically
apply the schema to an arbitrary Neon database.

Docker Compose mounts the schema into PostgreSQL's initialization directory for the optional local
database, so it is applied only when that named Docker volume is created.

Profile and staff repositories use the existing PostgreSQL schema when the database is available.
The runtime does not apply DDL, seed fixtures, or backfill records. If PostgreSQL is unavailable,
database-backed profile and staff requests fail explicitly; they are never converted into fixture
responses or writes.

`npm run db:reset` from the repository root deletes the local PostgreSQL volume and recreates it from
the canonical schema. This removes local database data.

The SQL files in `src/data/migrations/` are migration artifacts. The current Docker Compose setup
does not execute them automatically.

## API routes

All routes are mounted below `/api` except `GET /`. The live dictation WebSocket
(`/api/speech/stream`, relayed to Amazon Transcribe) shares the same HTTP server; see the root
README. This is the complete route reference; the root README only summarizes the primary feedback
flow.

### Core and auth

| Method | Route                            | Behavior                                                                                |
| ------ | -------------------------------- | --------------------------------------------------------------------------------------- |
| `GET`  | `/`                              | API name and running status.                                                            |
| `GET`  | `/api/health`                    | PostgreSQL health check; returns `503` when unavailable.                                |
| `GET`  | `/api/auth/google/config`        | Returns the configured Google client ID.                                                |
| `POST` | `/api/auth/google`               | Verifies a Google ID token and issues a local session for an existing user.             |
| `POST` | `/api/auth/google/signup`        | Creates a pet-parent account after Google profile completion.                           |
| `GET`  | `/api/auth/me`                   | Verifies the signed cookie and reloads the current user from PostgreSQL. Requires auth. |
| `POST` | `/api/auth/logout`               | Clears the local session cookie.                                                        |
| `POST` | `/api/auth/check-email`          | Checks whether an email exists.                                                         |
| `POST` | `/api/auth/login`                | Verifies a PostgreSQL password hash and sets the local session cookie.                  |
| `POST` | `/api/auth/first-login-password` | Replaces a manager-provisioned temporary password for the authenticated employee.       |
| `POST` | `/api/auth/signup`               | Creates a pet-parent account and profile transactionally.                               |
| `POST` | `/api/auth/signup/validate`      | Validates signup fields and email/username conflicts.                                   |

### Pet-parent homepage

Requires a signed-in pet parent. Design and rationale:
[docs/homepage-backend-plan.md](../docs/homepage-backend-plan.md). The "Vaccination information"
checklist item is done for a pet only when the parent answered Yes and uploaded a certificate for
that stay.

| Method | Route                 | Behavior                                                                                                                                                               |
| ------ | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/api/petparent/home` | Resolves the homepage state (`A`, `B1`, `B2`, `C1`, `C2`), the pets, every active booking with its "Before the stay" checklist, and the "Get ready" cards (see below). |

#### Pet parent stay status

Every pet parent read (Home, `GET /api/petparent/bookings`, `GET /api/petparent/stays`, live
care, the profile stays, the vaccination page and the AI chatbot) names a stay with one rule,
`toParentStayStatus` in `src/services/petparent.stayStatus.ts`. It reads
`booking_pets.manager_review_status` and the clock, never `bookings.status`:

| Manager decision | Clock                          | Status sent          | Words the parent reads |
| ---------------- | ------------------------------ | -------------------- | ---------------------- |
| `pending`        | any                            | `waiting_for_review` | Waiting for review     |
| `approved`       | before drop-off                | `approved`           | Approved               |
| `approved`       | drop-off to pick-up, inclusive | `staying_now`        | Staying now            |
| `approved`       | after pick-up                  | `stay_ended`         | Stay ended             |
| `refused`        | any                            | `refused`            | Not accepted           |
| `cancelled`      | any                            | `cancelled`          | Cancelled              |

Home lists only pending and approved pets as upcoming, only approved pets as staying now or
past, and a refused request with a drop-off still ahead under `needsAttention` with its reason.
`GET /api/petparent/bookings` also sends `reviewStatus` and `refusalReason`. Live care and the
vaccination page answer not found for a stay the manager has not approved (live care) or has
refused or cancelled (vaccination). The AI chatbot tags only an approved stay as current, upcoming
or past; any other request carries its status words, such as "Oct 12-16 (waiting for review)", so
it is never taken for the stay a parent means by "current" or "upcoming".

#### Get ready before drop-off

`src/services/petparent.getReady.ts` builds a task list for each approved pet from rows that
already exist. Nothing stores it: each status is worked out when the page is read. Every task is
`completed` or `not_started` (the GOV.UK task list pattern):

| Task                        | Completed when                                                                                                                                                          |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vaccination`               | The certificate for this stay is on file (the same rule as the Home checklist).                                                                                         |
| `feeding`                   | `pets.diet_notes` or this stay's `feeding_routine` has text.                                                                                                            |
| `medication`                | This stay's `medication_instructions` has real instructions, or the pet has no active `pet_medications` row and the owner did not tell the concierge it needs medicine. |
| `emergency_contact_and_vet` | `pets.emergency_contact` or `pet_owners.emergency_contact_number` has text, and so do `vet_name` and `vet_phone`.                                                       |

Behaviour and allergies is not a task: nothing records that a parent confirmed "none", so a pet
with no behaviour notes and no allergies could never complete it.

When the owner tells the booking concierge a pet needs medication, the concierge writes a fixed
note for staff into `medication_instructions` (`OWNER_SAID_NEEDS_MEDICATION_NOTE` in
`src/common/utils/booking-care-notes.ts`). That note has no medicine, dose or times, so it never
counts as instructions: it keeps `medication` at `not_started`, even though a new concierge pet has
no `pet_medications` row yet.

A parent cannot yet add medication instructions to a stay after the request is sent, and
`pet_medications` is written only by staff. An open `medication` task is therefore one only our
team can finish: the list shows it without a link and says our team goes through the medicines,
doses and times with the parent by drop-off.

- `GET /api/petparent/bookings` sends `getReady` (the tasks) only while a stay is `approved` and
  has not started, and `null` for every other status.
- `GET /api/petparent/home` sends `getReady`: each approved pet whose drop-off is at most 48 hours
  away (from exactly 48 hours before drop-off until drop-off), soonest first.
- The facts are read with the owner's id on both the booking and the pet, and only as yes or no;
  the notes, names and numbers never leave the database for this list.
- Staff check the vaccination proof and the pet's health at drop-off, go through the temperament
  and any bite history with the owner, and the owner signs the consent to emergency vet treatment
  there (Code of Welfare MS 4(a), 4(g), 6(b)). The app does not collect that consent. A pet without
  proof is kept apart from other pets (MS 4(c), 6(a)); every list says so under "At drop-off". The
  concierge's "What happens next" steps and its consent task say the same (see
  `docs/ai-booking-concierge.md` for the one place that does not yet).
- No notice goes to the parent's bell for it: the card is worked out on read, and no job runner
  exists to write a timed notice.

### Vaccination information

The parent gives one stay's proof on `/parent/vaccination/:bookingPetId`. Only the owner of the
booking reaches their pets (another owner's id answers 404), and a refused or cancelled pet answers
404 too.

| Method | Route                                                  | Behavior                                                                                                                                                                                                                                                                                                                                                   |
| ------ | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/api/petparent/vaccination/:bookingPetId`             | The stay, the answer, `certificate: { uploadedAt } \| null`, `canChange` and the other pets on the booking.                                                                                                                                                                                                                                                |
| `PUT`  | `/api/petparent/vaccination/:bookingPetId`             | Multipart form: `fullyVaccinated` (`true` or `false`) and, with `true` only, one `certificate` file. PDF, JPG, PNG or HEIC, checked by the file's first bytes, up to 10 MB (`413 VACCINATION_FILE_TOO_LARGE`, `422 VACCINATION_FILE_UNSUPPORTED`). Only before drop-off (`409 STAY_ALREADY_STARTED`). `false` clears the certificate. Trusted origin only. |
| `GET`  | `/api/petparent/vaccination/:bookingPetId/certificate` | Streams the owner's own certificate (`Cache-Control: private, no-store`).                                                                                                                                                                                                                                                                                  |
| `GET`  | `/api/admin/vaccination-certificates/:bookingPetId`    | **Employee.** Streams any stay's certificate, for the drop-off check and the manager's review.                                                                                                                                                                                                                                                             |

Certificates are kept on the server's disk (`Backend/storage/vaccination-certificates`, gitignored,
or `VACCINATION_CERTIFICATE_DIR`), never in the public object storage bucket, and have no URL of
their own. `booking_pets_caring_info.vaccination_document_url` holds only the random file name and
`vaccination_document_uploaded_at` the upload time; no response carries the file name. With
`NODE_ENV=production`, `VACCINATION_CERTIFICATE_DIR` is required: without it every certificate
upload and download fails with a logged 500, so files never land in the checkout, where a redeploy
would lose them.

Known gaps before launch (owner decisions or owner actions):

- **Schema file.** `Backend/database/neon.sql` does not have `vaccination_document_url` or
  `vaccination_document_uploaded_at` yet, and agents may not edit it. A database built only from
  it (the Docker database, a fresh branch) answers 500 on `/api/petparent/home`,
  `/api/admin/bookings` and these routes until the owner adds the two approved columns, or applies
  `src/data/migrations/20260929_booking_cancel_and_vaccination_document.sql`.
- **Retention (IPP 9).** Certificates are kept until the parent replaces or clears them. Nothing
  removes them after a stay ends, is refused or is cancelled. The owner needs to set a retention
  period, and a cleanup job should follow it.
- **Durability and security (IPP 5).** The volume behind `VACCINATION_CERTIFICATE_DIR` must be
  persistent and backed up, and only one server instance can use it. Encryption at rest is a
  follow-up.
- **Privacy contact (IPP 3, s201).** The collection notice names Wagstay but not its address or a
  privacy officer. Add them once the owner supplies them.

### Parent notifications

Requires a signed-in pet parent (`requirePetParent`); the two writes also check the origin
(`requireTrustedOrigin`). The owner comes from the session and every statement joins
`pet_owners_notification`, so another owner's notice answers like one that does not exist.
Concierge checkout and the manager's approve, refuse and undo write the notices. Design, wording
and storage: [docs/booking-notifications.md](../docs/booking-notifications.md).

| Method  | Route                                   | Behavior                                                                                                        |
| ------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `GET`   | `/api/petparent/notifications`          | `limit` 1 to 50 (default 20). `{ items, unreadCount }`, newest first; `unreadCount` counts every unread notice. |
| `PATCH` | `/api/petparent/notifications/:id/read` | `{ id, readAt }`; the first read time is kept. `404 NOTIFICATION_NOT_FOUND` for any id the owner does not own.  |
| `PATCH` | `/api/petparent/notifications/read-all` | Body `{ through?: ISO date and time }`. Marks unread notices up to `through` read. `{ updatedIds, readAt }`.    |

### Maps reviews

The Maps review flow is independent from website parent/employee authentication. A valid Google
account is verified server-side, upserted into `reviewer_identities`, and receives a signed,
HttpOnly `maps_reviewer_session` cookie whose subject is the database reviewer UUID; it does not
create a row in `users`, `pet_owners`, or `employees`. The current Maps page reads the seeded
PetHouse location and app-owned Google-shaped reviews from PostgreSQL. It does not call the Google
Maps or Google Business Profile review APIs. Reviewer sessions never use `wagstay_session`.

| Method   | Route                                                        | Behavior and access                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST`   | `/api/review-auth/google`                                    | Exchanges `{ authorizationCode }` from the Maps popup, verifies and persists the Google reviewer identity, sets `maps_reviewer_session`, and returns only `id`, `displayName`, and `avatarUrl`.                                                                                                                                                                                                                                                                                                                                                                     |
| `GET`    | `/api/review-auth/me`                                        | Restores the sanitized reviewer profile from the signed `maps_reviewer_session` claims.                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `POST`   | `/api/review-auth/logout`                                    | Clears only `maps_reviewer_session`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `GET`    | `/api/google-reviews?placeSlug=PetHouse`                     | Loads the PetHouse location summary, persisted `google_business_reviews` projection, and stable public review photo URLs resolved from Neon Object Storage keys.                                                                                                                                                                                                                                                                                                                                                                                                    |
| `POST`   | `/api/google-reviews`                                        | Authenticated app-owned Google review creation. It accepts multipart form data: JSON `payload` with `placeSlug`, `rating` (1 to 5), optional `reviewText`, and up to 9 JPEG/PNG/GIF `photos` (10 MB each). Photos are uploaded directly to Neon Object Storage with the original filename preserved as the key's final segment; only object keys are stored with the review. The review, media rows, `external_feedback` row, `review_received` event, and one notification per active manager are committed together. No Google Review AI investigation is queued. |
| `DELETE` | `/api/google-reviews/:id`                                    | Non-production mock-data cleanup. Requires a trusted origin, deletes only `google_business_reviews.data_origin = 'mock'`, and does not call or delete a remote Google Maps review. Linked external feedback and media rows are removed with the local record, and stored review photo objects are deleted from Neon Object Storage.                                                                                                                                                                                                                                 |
| `GET`    | `/api/admin/google-reviews?placeSlug=PetHouse`               | Authenticated employee projection of Google reviews with original review text, rating, photos, manager-selected type, assignment/workflow fields, sent reply, and stable public photo URLs. It does not include AI summaries, confidence, or investigation status.                                                                                                                                                                                                                                                                                                  |
| `GET`    | `/api/admin/google-review-notifications?limit=10&cursor=...` | Manager-only cursor-paginated notifications with the current unread count: Google Reviews and "New booking request" notices from concierge checkout. Rows are scoped to the authenticated manager; Google Review rows also to the app-owned PetHouse location. See `docs/booking-notifications.md`.                                                                                                                                                                                                                                                                 |
| `PATCH`  | `/api/admin/google-review-notifications/:id/read`            | Persists `notification.read_at` for one notification of either kind assigned to the authenticated manager.                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `PATCH`  | `/api/admin/google-review-notifications/read-all`            | Persists `notification.read_at` for all notifications of both kinds assigned to the authenticated manager.                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `POST`   | `/api/admin/google-reviews/:id/reply`                        | Authenticated employee mock reply. Accepts `{ replyBody }`, resolves a unique reviewer email from existing reviewer identity data, persists an app-owned `external_feedback_replies` row, and returns the updated owner response. It does not send a real email or call Google.                                                                                                                                                                                                                                                                                     |
| `POST`   | `/api/reviews/simulator`                                     | Separate server-side simulator ingestion path. Requires `X-Review-Simulator-Secret`; it is not used by the current Maps page.                                                                                                                                                                                                                                                                                                                                                                                                                                       |

The additive schema for these routes is in
`src/data/migrations/google-feedback-and-reviews-schema.sql`. PetHouse facility and location seed
data are in `src/data/migrations/20260901_seed_pethouse_facility.sql` and
`src/data/migrations/20260901_seed_pethouse_google_location.sql`; the migrations have been applied
to the configured Neon targets. The reply endpoint uses the existing reviewer identity table and
the `external_feedback_replies` table. The canonical schema snapshot is synchronized in
`database/neon.sql`.

Google Review management is a manual workflow. Review creation stores the review and media, emits its
receipt and ordinary refresh events, and creates manager notifications; it does not create an AI
investigation marker or run a background analysis worker. Admin review reads return the original
review content and manager-maintained fields. Managers can set a review type, assign follow-up, and
compose a reply manually. The Operation dashboard API supplies rating/count metrics and charts; no
Google Review summary-bundle endpoint or AI reply-draft endpoint is used. Internal Feedback AI
insights remain a separate feature.

### Feedback

| Method   | Route                                         | Behavior and access                                                                           |
| -------- | --------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `POST`   | `/api/feedback/generate-insights`             | Public draft insight generation through the configured Ollama-compatible model.               |
| `POST`   | `/api/feedback`                               | Authenticated pet-parent multipart submission with optional audio and ownership verification. |
| `GET`    | `/api/admin/feedback`                         | Authenticated employee list with search, filters, and sorting.                                |
| `GET`    | `/api/admin/feedback/assignees`               | Authenticated employee options for assignment.                                                |
| `GET`    | `/api/admin/feedback/snapshot`                | Authenticated full feedback snapshot for Frontend hydration.                                  |
| `PATCH`  | `/api/admin/feedback/assignee`                | Transactional current-assignee update.                                                        |
| `PATCH`  | `/api/admin/feedback/read`                    | Transactional record-level read update.                                                       |
| `GET`    | `/api/admin/feedback/:id`                     | Authenticated detail read and read-on-open behavior.                                          |
| `DELETE` | `/api/admin/feedback/:id`                     | Transactionally removes feedback and linked notification/timeline records.                    |
| `PATCH`  | `/api/admin/feedback/:id/status`              | Transactional Issue progress transition.                                                      |
| `PATCH`  | `/api/admin/feedback/:id/suggestion-workflow` | Transactional Suggestion workflow transition and metadata.                                    |
| `POST`   | `/api/admin/feedback/:id/reply`               | Persists `sent` status and timeline; no real email is sent yet.                               |

The admin feedback router requires an authenticated employee for the entire group. Detail and
mutation routes also require a trusted origin. The parent submit route requires an authenticated
pet-parent and trusted origin. The draft insight route is intentionally outside that authentication
boundary.

### Pet and staff/profile routes

| Method   | Route                                           | Behavior                                                                                                                                                                                                                        |
| -------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/api/admin/pets`                               | PostgreSQL pet roster with owner and latest _approved_ booking timing; `status` auto-flips `incoming` → `onboarding` at check-in (see `docs/admin-bookings-api.md` §9).                                                         |
| n/a      | n/a                                             | `status`, `check-in`/`check-out` on this and `GET /api/admin/pets/:id` are derived from the pet's _approved_ bookings only, and `status` auto-flips `incoming` → `onboarding` at check-in. See `docs/admin-bookings-api.md` §9. |
| `GET`    | `/api/admin/pets/:id`                           | PostgreSQL pet detail.                                                                                                                                                                                                          |
| `PATCH`  | `/api/admin/pets/:id`                           | Updates type, gender, age, and owner name. Assignment state is not part of the profile payload.                                                                                                                                 |
| `GET`    | `/api/admin/pets/:id/assignments`               | Lists dated/shift Pet assignments. Requires an authenticated employee.                                                                                                                                                          |
| `POST`   | `/api/admin/pets/:id/assignments`               | Manager creates a dated/shift or all-day assignment in `employee_assignments`.                                                                                                                                                  |
| `DELETE` | `/api/admin/pets/:id/assignments/:assignmentId` | Manager removes one assignment, matching both Pet and assignment UUIDs.                                                                                                                                                         |
| `GET`    | `/api/admin/staff/me?email=...`                 | Staff lookup by email.                                                                                                                                                                                                          |
| `GET`    | `/api/admin/staff`                              | Staff list from the existing PostgreSQL schema; unavailable PostgreSQL is returned as an explicit error.                                                                                                                        |
| `POST`   | `/api/admin/staff`                              | Manager creates an employee account and receives the generated temporary password once.                                                                                                                                         |
| `GET`    | `/api/admin/staff/:id`                          | Staff detail.                                                                                                                                                                                                                   |
| `GET`    | `/api/admin/staff/:id/assignments`              | Assigned pets from `employee_assignments` only.                                                                                                                                                                                 |
| `PATCH`  | `/api/admin/staff/:id`                          | Manager-style staff edit.                                                                                                                                                                                                       |
| `PATCH`  | `/api/admin/staff/:id/self`                     | Self-service name, phone, and avatar edit.                                                                                                                                                                                      |
| `DELETE` | `/api/admin/staff/:id`                          | Removes staff after service-level conflict checks. The current controller accepts `x-acting-staff-id` as a caller-identity stand-in.                                                                                            |

### Profile media upload

These routes require an authenticated session and a trusted Frontend origin. They prepare and
clean up direct uploads for staff avatars, parent avatars, and parent pet photos. The current
`petown` bucket is public and contains synthetic demo data only; anyone who obtains an object URL
can read that object.

| Method   | Route                           | Behavior                                                                                                                                                                                    |
| -------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST`   | `/api/profile-media/upload-url` | Accepts `{ target, petId?, fileName, contentType, size }`, validates the session/ownership and image metadata, and returns a short-lived presigned PUT URL plus a stable public `assetUrl`. |
| `DELETE` | `/api/profile-media/upload`     | Deletes one owner-scoped object after a failed or cancelled upload.                                                                                                                         |

The Frontend sends the raw file to the returned storage URL with the returned `Content-Type` and
`Cache-Control` headers. The subsequent profile or pet JSON request contains only `assetUrl`; it
does not contain a base64/data URL or the `File` object. Generated keys are scoped under
`profile-media/users/<owner-id>/` or `profile-media/pets/<owner-id>/` and retain the original
filename as the final key segment. Existing profile and pet image reads use lazy loading.

Staff routes require an authenticated employee; creation, manager edits, and deletion require a
manager. Self-profile updates use the authenticated employee identity.

### KPI routes

| Method | Route                      | Behavior                                                                                                                  |
| ------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/api/admin/kpi/dashboard` | Manager-only KPI dashboard. Returns task completion rate, overdue rate, and average completion time for the last 30 days. |

The KPI router requires an authenticated manager for the entire group.

## Auth and session boundary

Password login looks up `users.email` and verifies `users.password_hash` with PostgreSQL `pgcrypto`.
Manager-created employee accounts store the temporary bcrypt hash in that same existing column;
the first password change replaces it with a normal hash, without adding an activation column.
Signup creates `users` and `pet_owners` in one transaction. Google credentials are verified at login,
then exchanged for a local session cookie.

The session cookie is signed, HttpOnly, same-site `lax`, and valid for up to eight hours. Its claims
contain the local user UUID, session version, issue time, and expiry. `GET /api/auth/me` reloads the
current user and role from PostgreSQL; the cookie is not stored in localStorage. Logout clears the
browser cookie but there is no server-side session table or pre-expiry stolen-cookie revocation.

The current signup password rules are 8 to 32 characters, at least one number, and at least one symbol;
the validation also rejects surrounding whitespace, mismatched confirmation, and passwords containing
personal information.

## Development commands

```bash
npm run dev
npm run build
npm start
npm run test
npm run test:llm
npm run auth:provision-password -- --email user@example.test
npm run test:api:postgres:validate
npm run test:api:postgres
```

The PostgreSQL API tests require `TEST_DATABASE_URL`; the test support uses it as the isolated test
database and injects it into the Backend's `POSTGRESQL_URL` only for that test process. Otherwise the
test files are skipped unless `POSTGRES_API_TEST_REQUIRED=1` is set (which `npm run test:api:postgres`
sets for you).

The normal runtime does not create or seed a database. Point `TEST_DATABASE_URL` at a database whose
schema already matches `database/neon.sql`. `npm run test:api:postgres:validate` reports exactly which
tables or columns are missing if it does not.

Staff/profile routes read the records already present in the configured database. They do not seed
staff identities or apply profile DDL at request time. See [Local demo authentication](../README.md#local-demo-authentication)
for the password provisioning command used with canonical fixture users.

### Task routes

Mounted at `/api` via `taskRouter`. Every route requires an authenticated employee; the routes below
additionally require a manager.

| Method   | Route                                   | Behavior                                                                                                      |
| -------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/api/pets/:petId/task-assignments`     | Available dated/shift assignment slots for a pet.                                                             |
| `GET`    | `/api/pets/:petId/tasks?range=...`      | Task list for a pet. `range` is `all\|today\|week\|month`.                                                    |
| `GET`    | `/api/staff/:staffId/tasks?range=...`   | A staff member's own tasks (used by the "My Tasks" page).                                                     |
| `GET`    | `/api/tasks/:taskId`                    | One task.                                                                                                     |
| `POST`   | `/api/pets/:petId/tasks`                | **Manager.** Creates a task for a pet.                                                                        |
| `POST`   | `/api/tasks/from-booking/:bookingId`    | **Manager.** Fans a booking's services/intake answers into pending tasks; safe to re-call (dedupe).           |
| `PATCH`  | `/api/tasks/:taskId`                    | Updates a task. Used by staff's own "My Tasks" edits (status, issue, etc.).                                   |
| `PATCH`  | `/api/pets/:petId/tasks/:taskId`        | **Manager.** Same handler as above: the Pet Profile Task Timeline's edit path (staff assignment, exact time). |
| `PATCH`  | `/api/tasks/:taskId/complete`           | Marks a task complete.                                                                                        |
| `DELETE` | `/api/tasks/:taskId`                    | Deletes a task.                                                                                               |
| `GET`    | `/api/tasks/:taskId/photos/:storedName` | Reads one task photo.                                                                                         |
| `POST`   | `/api/tasks/:taskId/photos`             | Uploads task-completion photos (up to 10 per request).                                                        |
| `DELETE` | `/api/tasks/:taskId/photos/:storedName` | **Manager.** Deletes a task photo.                                                                            |
| `GET`    | `/api/task-templates`                   | Task template list.                                                                                           |
| `GET`    | `/api/task-staff`                       | Staff options for assignment.                                                                                 |
| `GET`    | `/api/free-staff`                       | Staff free at a given date/time, cross-checked against the Staff Shift Table roster.                          |

### Booking review routes

Mounted at `/api/admin/bookings`. Every route requires a manager. A decision that changes what the
parent sees also writes a parent notice in the same transaction; a failed notice never undoes the
decision (see `docs/booking-notifications.md`).

| Method  | Route                             | Behavior                                                                                                                                                          |
| ------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`   | `/api/admin/bookings`             | Every paid booking, one row per pet, with care instructions, whether a vaccination certificate is on file, and priced services. See `docs/admin-bookings-api.md`. |
| `PATCH` | `/api/admin/bookings/:id/approve` | Sets `manager_review_status = 'approved'`, clears any refusal reason, and generates that pet's tasks.                                                             |
| `PATCH` | `/api/admin/bookings/:id/refuse`  | Sets `manager_review_status = 'refused'` with a required `reason`.                                                                                                |
| `PATCH` | `/api/admin/bookings/:id/undo`    | Reverts either decision to `pending`; if it was an approval, deletes the tasks it generated.                                                                      |

### Staff shift routes

Mounted at `/api/admin/staff-shifts`. Every route requires a manager.

| Method   | Route                                   | Behavior                                                |
| -------- | --------------------------------------- | ------------------------------------------------------- |
| `GET`    | `/api/admin/staff-shifts/staff-options` | Staff options for the Staff Shift Table.                |
| `GET`    | `/api/admin/staff-shifts`               | Shift entries, optionally filtered by staff/date range. |
| `POST`   | `/api/admin/staff-shifts`               | Adds a shift entry.                                     |
| `PUT`    | `/api/admin/staff-shifts/:id`           | Edits a shift entry.                                    |
| `DELETE` | `/api/admin/staff-shifts/:id`           | Removes a shift entry.                                  |

### Staff dashboard routes

Mounted at `/api/admin/staff-dashboard`. Every route requires a manager.

| Method | Route                                 | Behavior                                                                                       |
| ------ | ------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `GET`  | `/api/admin/staff-dashboard`          | Team overview: tasks done/overdue/issues per staff, on-shift status.                           |
| `GET`  | `/api/admin/staff-dashboard/:staffId` | One staff member's detail: completion breakdown, recent issues, today's tasks, shift calendar. |
