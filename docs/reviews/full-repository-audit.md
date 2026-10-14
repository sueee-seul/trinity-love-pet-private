# Trinity: Full Repository Engineering Audit

## 1. Audit metadata, scope, read-only boundary and verdict

| Field              | Content                                                                                                                                                                                                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Audit target       | `/Users/heminghan/Tropical_love_pet`                                                                                                                                                                                                                                                             |
| Current checkout   | `feat/feedback-system`; `1fa0f2f8c5721a0628cc711d0e8bc1e97b7bbb52`                                                                                                                                                                                                                               |
| Audit date         | 2026-08-31 (Pacific/Auckland)                                                                                                                                                                                                                                                                    |
| Method             | Direct inspection of Express route/controller/service/repository, React API/hooks/pages, schema/migrations, tests, Docker, CI, and documentation; README or code comments were not used to replace source verification.                                                                          |
| Read-only boundary | This audit does not modify code, tests, schemas, migrations, configurations, lockfiles, or CI. The only new file is this report. No `.env` contents were read or disclosed.                                                                                                                      |
| Verdict            | **The current repository is not yet suitable for production.** The most urgent issues are: public access and object scope gaps in the pet/task API, booking cross-pet writes and raw card paths, auth/session/CSRF boundaries, schema/runtime drift, and the feedback reply and audio lifecycle. |

The `Classification` in this report uses only the following five values, and each finding uses only one: `Confirmed from code`, `Confirmed by test`, `Documentation claim only`, `Reasonable inference`, `Not verified`. "Expected permissions" in documentation should not be misread as currently implemented; fine-grained authorization for staff/managers is explicitly deferred in the documentation, so this document only lists the lack of coarse authentication or explicit object scope as risks.

## 2. Actual architecture / data-flow map

```text
Browser React app
  ├─ App.tsx hydrates GET /api/auth/me with wagstay_session cookie
  ├─ AccountRoute gates the parent/admin UI by is_pet_owner / is_employee
  ├─ parent profile and conversations -> browser localStorage; /parent/stays -> static defaults
  ├─ parent feedback -> POST /api/feedback (multipart, cookie, optional audio)
  ├─ parent booking -> GET /api/petparent/{pets,services}, POST /bookings (cookie)
  └─ staff pet/tasks/feedback -> hardcoded or shared API fetch calls
          │
          ▼
Express server.ts
  cors(credentials=true; missing Origin accepted) -> json/urlencoded
  mounted routes -> middleware -> controller -> service -> repository -> PostgreSQL
          │                                                └─ transaction in selected writes
          └─ development-only /uploads/feedback -> local static directory

Feedback submission:
  parent route auth/origin/upload -> ownership query(pet_uuid, session user)
  -> calculate rating + LLM generateObject -> local audio save
  -> feedback + initial timeline transaction -> mock suggestion notification

Booking submission:
  parent route auth -> Zod shape validation -> selectedPetIds ownership query
  -> catalog lookup/total/mockChargeCard -> dates/info/service maps
  -> transaction: bookings, booking_pets, services, caring_info, agreement,
     payment_methods, booking_payments, confirmed

AI service:
  Browser audio -> unauthenticated FastAPI /transcribe -> synchronous faster-whisper
  -> returned text appended in browser; backend feedback insert does not populate
     feedback.transcript.
```

Business-rule ownership is split: route/controller schemas validate shape; services perform some business checks; repositories issue SQL and sometimes own transactions. The split is not consistently closed: task routes do not receive caller identity, booking validates ownership only for one array, and some frontend guards are stronger than backend guards.

## 3. Mounted API inventory summary

| Mount                 | Actual endpoints / middleware                                                                     | Verified runtime implication                                                                                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/auth`           | Google config/login/signup, login/signup, check-email, logout, reset, `/me`, first-login password | `/me` requires `requireAuth`; logout/login/signup and Google endpoints are public; reset uses origin middleware; no login rate limiter is mounted. `Backend/src/routes/auth.routes.ts:24-40`. |
| `/api/feedback`       | `POST /generate-insights`; `POST /`                                                               | Insight generation is public. Submit requires `requirePetParent`, `requireTrustedOrigin`, and Multer. `Backend/src/routes/feedback.routes.ts:6-9`.                                            |
| `/api/admin/feedback` | list, assignees, snapshot, read/assign/detail/delete/status/suggestion/reply                      | Router-wide `requireEmployee`; mutation/detail routes additionally call `requireTrustedOrigin`. `Backend/src/routes/admin.feedback.routes.ts:16-28`.                                          |
| `/api/admin/pets`     | list/detail/profile/health/behaviour/medications; assignments                                     | Only assignment GET/POST/DELETE are gated. Other reads and writes have no route middleware. `Backend/src/routes/pet.routes.ts:19-31`.                                                         |
| `/api/admin/staff`    | staff list/detail/options/assignments/create/update/self/delete                                   | Coarse employee/manager middleware is mounted per route. No trusted-origin middleware is applied. `Backend/src/routes/staff.routes.ts:16-27`.                                                 |
| `/api`                | all task assignment/read/create/update/complete/delete/template/staff/free-staff routes           | No auth middleware is mounted. `Backend/src/modules/tasks/task.routes.ts:16-28`.                                                                                                              |
| `/api/petparent`      | pets, services, booking creation                                                                  | All three use `requirePetParent`; none use `requireTrustedOrigin`. `Backend/src/routes/petparent.booking.routes.ts:9-13`.                                                                     |
| `/uploads/feedback`   | `express.static(FEEDBACK_AUDIO_STORAGE_DIRECTORY)` in non-production only                         | No authentication is applied to development audio retrieval. `Backend/src/server.ts:47-49`.                                                                                                   |
| `/`, `/api/health`    | API status and DB health                                                                          | Public operational/status endpoints. `Backend/src/server.ts:51-63`.                                                                                                                           |

## 4. Actual anonymous / parent / staff / manager permission matrix

| Actor                        | Server-side access actually observed                                                                                                                                                                                                                   | Boundary note                                                                                                                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Anonymous                    | Public auth bootstrap/login/signup/check-email/logout/reset endpoints; public `POST /api/feedback/generate-insights`; every task route; every `/api/admin/pets` route except assignment routes; public status/health; development feedback audio files | This is direct route evidence, not a claim that a browser UI exposes every route.                                                                                                                                       |
| Authenticated parent         | Parent booking reads/create and feedback submit; `/api/auth/me`; can be rejected from `requireEmployee` routes                                                                                                                                         | Parent feedback ownership is checked server-side in `findOwnedPetFeedbackContext`. Booking ownership is only checked for `selectedPetIds`, not every pet-bearing input row.                                             |
| Authenticated employee/staff | All admin feedback operations; staff self/detail/assignment reads; also unprotected pet/task APIs; staff-management manager-only routes are rejected                                                                                                   | Existing docs defer fine-grained staff visibility/permission rules. The finding is the missing authentication/object scope on routes, not a claim that every staff member must have narrower product permissions today. |
| Authenticated manager        | Employee access plus staff options/list/create/update/delete and manager-only pet assignment create/delete                                                                                                                                             | `requireManager` checks only `employee_role === 'manager'`; role data can be inconsistent between user flags and employee/profile projections.                                                                          |

`requireTrustedOrigin` treats a missing Origin as trusted (`Backend/src/common/middlewares/auth.middleware.ts:90-104`), while several state-changing routes do not call it at all. Frontend `AccountRoute` blocks temporary-password employees, but this is not a server-side API invariant.

## 5. Severity-ranked findings

### Critical

#### F-01: Admin pet profile and medication surface is publicly reachable

- **Severity:** Critical
- **Classification:** `Confirmed from code`
- **Evidence:** `Backend/src/routes/pet.routes.ts:21-31`, `router`: `getPetList`, `getPetDetail`, profile/health/behaviour/medication handlers have no `requireEmployee`; only assignment handlers at lines 22-24 are gated.
- **Why it matters:** An unauthenticated caller can enumerate staff-facing pet/owner data and invoke profile, health-note, behaviour-note, and medication mutations. This breaks the parent/staff boundary and exposes sensitive pet-care information.
- **Reproduction / verification:** Mount `petRoutes` as `server.ts` does at `/api/admin/pets`; call `GET /api/admin/pets` and `PATCH /api/admin/pets/:id` without a cookie. A route-level Supertest test should assert 401 before the controller/repository.
- **Smallest recommended fix:** Apply `requireEmployee` to the router or each non-public pet route; apply the existing trusted-origin check to state-changing routes; then add unauthenticated and cross-object authorization tests.

#### F-02: All task reads and writes are public and accept no caller/object scope

- **Severity:** Critical
- **Classification:** `Confirmed from code`
- **Evidence:** `Backend/src/modules/tasks/task.routes.ts:18-28`, `taskRouter`: every task route is registered without auth middleware. `Backend/src/controllers/task.controller.ts:30-233` and `Backend/src/services/task.service.ts:37-218` pass only URL IDs and payload values; no caller identity or authorization scope is accepted.
- **Why it matters:** Anyone who knows or guesses UUIDs can read pet/staff tasks, create/update/complete/delete tasks, and enumerate staff/template/free-staff data. A route-level frontend guard cannot protect direct API calls.
- **Reproduction / verification:** Send anonymous requests to `GET /api/pets/{petUuid}/tasks`, `GET /api/staff/{staffUuid}/tasks`, `POST /api/pets/{petUuid}/tasks`, and `DELETE /api/tasks/{taskUuid}`. Assert that current behavior reaches controller/repository rather than returning 401.
- **Smallest recommended fix:** Add an employee authentication gate to the task router, then make service/repository methods accept the authenticated actor and enforce the intended coarse scope. Add tests for anonymous, staff, manager, and wrong-pet/wrong-staff object access.

#### F-03: Booking can persist pet rows outside the selected/owned set

- **Severity:** Critical
- **Classification:** `Confirmed from code`
- **Evidence:** `Backend/src/services/petparent.booking.ts:114-122`, `createBooking`: ownership is checked only against `input.selectedPetIds`; `Backend/src/controllers/petparent.booking.controller.ts:86-95`, `createBookingSchema`: `dates`, `services`, and `info` are independent arrays; `Backend/src/services/petparent.booking.ts:174-197` maps every `input.dates` row into persisted booking pets; `Backend/src/repositories/petparent.booking.repository.ts:219-225`, `createBooking`: inserts each mapped `petId` without an owner join.
- **Why it matters:** A parent can submit an owned `selectedPetIds` value while placing another UUID in `dates` (and matching `info`), causing the booking to reference a pet that was not selected and whose ownership was not checked. The `booking_pets` FK proves that the pet exists, not that it belongs to the booking owner.
- **Reproduction / verification:** Authenticate as parent A; submit a payload with parent A’s UUID in `selectedPetIds` and parent B’s pet UUID in `dates`/`info`. Use an isolated database and verify whether `booking_pets.pet_uuid` is inserted under parent A’s booking.
- **Smallest recommended fix:** Validate that every pet-bearing row has a unique pet ID, belongs to the caller, belongs to `selectedPetIds`, and has exactly one date/info row before charging or opening the write transaction; enforce the relationship again in SQL where practical.

#### F-04: Raw PAN/CVC reaches the backend and every syntactically valid card is approved

- **Severity:** Critical
- **Classification:** `Confirmed from code`
- **Evidence:** `Backend/src/controllers/petparent.booking.controller.ts:75-84`, `paymentSchema` accepts card number/expiry/CVC; `Frontend/src/features/pet-parent/components/booking/steps/Step5Payment.tsx:158-162` says fields are sent as-is; `Backend/src/services/petparent.booking.ts:95-103`, `mockChargeCard` always returns `succeeded: true`; `Backend/src/services/petparent.booking.ts:208-213`, `createBooking`, persists a deterministic mock processor token; `Backend/src/repositories/petparent.booking.repository.ts:271-285` inserts it into `payment_methods` and `booking_payments`.
- **Why it matters:** The current path creates a payment-processing and data-handling hazard if deployed outside a prototype boundary. It does not verify expiry or card ownership, does not call a processor, and reports a successful charge for any accepted digit string.
- **Reproduction / verification:** Submit two different syntactically valid card payloads to an isolated booking API; both should reach `mockChargeCard` and produce a `succeeded` booking payment. Confirm that no external processor call exists.
- **Smallest recommended fix:** Keep the feature disabled outside an explicitly non-production environment; replace the path with a PCI-compliant client-side processor token and server-side payment intent/verification before allowing production booking confirmation.

#### F-05: Schema source used at runtime/test setup conflicts with the documented Neon schema

- **Severity:** Critical
- **Classification:** `Confirmed from code`
- **Evidence:** `docker-compose.yml:19-24` mounts `Backend/src/data/First_version_schema.sql`; `Backend/src/scripts/prepare-postgres-api-test-db.ts:56-61` applies that same file; `Backend/scripts/postgres-api-test-preflight.mjs:5-18` and `Backend/scripts/validate-postgres-api-test-schema.mjs:19-20` treat `Backend/database/neon.sql` as the expected schema. `Backend/src/data/First_version_schema.sql:106-112` defines `employees` without `staff_role`/`staff_status`; runtime projection selects those at `Backend/src/repositories/staff.read.repository.ts:32-50`. `Backend/src/repositories/pet.repository.ts:195-213` queries `pet_medications`, while `Backend/database/neon.sql:427-442` defines singular `pet_medication` and `First_version_schema.sql` defines neither.
- **Why it matters:** Docker/test databases can be created from a schema that cannot satisfy runtime staff or medication queries, while preflight may validate a different schema file. This makes "green" setup evidence non-representative and can turn normal reads into SQL errors.
- **Reproduction / verification:** Initialize the Docker database or run the preparation script in an isolated database, then call staff/profile and pet-detail medication paths; compare `information_schema` against the runtime SQL. Separately run the Neon preflight against a Neon-shaped database and note that it does not validate the First-version runtime database.
- **Smallest recommended fix:** Declare one canonical schema/migration source and make Docker, test preparation, preflight, runtime documentation, and CI consume it. Add a schema contract test for every runtime-selected table/column and medication table name.

#### F-26: Test database preparation can force-drop the database named by `TEST_DATABASE_URL`

- **Severity:** Critical
- **Classification:** `Confirmed from code`
- **Evidence:** `Backend/src/scripts/prepare-postgres-api-test-db.ts:36-61`, `prepareDatabase`, parses `TEST_DATABASE_URL`, connects to the same host's `/postgres`, and executes `DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)` before applying `First_version_schema.sql`. The equality/isolation guard exists in `Backend/scripts/run-postgres-api-tests.mjs:9-17`, not in the preparation script itself.
- **Why it matters:** Invoking the preparation script directly with a product or shared database URL can terminate connections and irreversibly delete that database. The URL format/name regex is not an isolation proof.
- **Reproduction / verification:** In a disposable PostgreSQL server, set `TEST_DATABASE_URL` to a database containing a sentinel row and run only the preparation script; verify the database is dropped/recreated. Do not run this against a real product database.
- **Smallest recommended fix:** Require an explicit isolated-test database identity and reject `TEST_DATABASE_URL === POSTGRESQL_URL` (plus a configurable host/database allowlist) inside the preparation script itself before any destructive SQL.

### High

#### F-06: Frontend task fetchers silently convert API/auth failures into empty task lists

- **Severity:** High
- **Classification:** `Confirmed from code`
- **Evidence:** `Frontend/src/features/admin/pages/TaskPage.tsx:21-26`, `load`; `Frontend/src/features/admin/components/TaskTimeline.tsx:42-54`, effects: both parse JSON without checking `response.ok` and replace any non-array error body with `[]`/keep fallback templates. `Frontend/src/features/admin/components/tasks/useTaskEditor.ts:62-94` repeats the same unchecked fetch pattern.
- **Why it matters:** A 401/403/500, schema failure, or wrong API origin is displayed as "no tasks", hiding operational/security failures and making staff believe a state is empty. The page also omits `credentials: 'include'` in all task fetches.
- **Reproduction / verification:** Mock task endpoints with a 401 JSON error object and load the page; observe `tasks=[]` with no error state. In a browser session, inspect the request and confirm no cookie credentials option is supplied.
- **Smallest recommended fix:** Centralize the authenticated task client, send credentials, check status, validate the response shape, and expose an explicit error/retry state instead of silently emptying the list.

#### F-07: Booking request lacks cardinality, date/time, and stale-selection invariants

- **Severity:** High
- **Classification:** `Confirmed from code`
- **Evidence:** `Backend/src/controllers/petparent.booking.controller.ts:86-95`, `createBookingSchema` only requires `selectedPetIds.min(1)` and `dates.min(1)`; `Backend/src/services/petparent.booking.ts:72-88`, `nightsBetween`/`combineDateAndTime`; `Backend/src/services/petparent.booking.ts:149-167`, pricing uses `dates` map and totals every submitted service without asserting one date per selected pet or checking same-day time order. `Frontend/src/features/pet-parent/components/booking/steps/Step1BoardingDates.tsx:31-41`, `togglePet`, removes `selectedPetIds` and `dates` but leaves `services` and `info`.
- **Why it matters:** Duplicate/missing rows can be priced differently from persisted rows; an end date before start date is guarded only in the UI; same-day pick-up before drop-off is not rejected; deselection leaves stale service/info payloads that can still be charged or ignored inconsistently.
- **Reproduction / verification:** Submit duplicate date/info entries, omit a selected pet's date, use same-day `17:00` drop-off and `09:00` pick-up, and deselect a pet after choosing services. Compare `totalCharged` with persisted `booking_pets`/service rows.
- **Smallest recommended fix:** Normalize the draft on every selection change and enforce exact set/cardinality, date ordering, same-day time ordering, valid calendar dates, and service/info membership on the server before payment.

#### F-08: Booking agreement identity and amount shown to the parent are not the recorded server facts

- **Severity:** High
- **Classification:** `Confirmed from code`
- **Evidence:** `Frontend/src/features/pet-parent/components/booking/BookingFlow.tsx:18-32`, initializes `agreedToTermsVersionId: 'terms-v3'`; `Frontend/src/features/pet-parent/components/booking/steps/Step4Agreements.tsx:4-14`, hardcodes terms text and `:35-41`, stores the full name in `signatureDataUrl`; `Backend/src/services/petparent.booking.ts:141-147` ignores the client terms ID and resolves current DB terms; `Frontend/src/features/pet-parent/components/booking/steps/Step6ThankYou.tsx:22-42,94-96` recomputes/displays client total and promises an email despite the response’s `totalCharged` and no email integration.
- **Why it matters:** The agreement can be recorded against a different terms version from the one shown; a name string is not a signature artifact; and the confirmation screen can disagree with the captured server amount or promise a message that is not sent.
- **Reproduction / verification:** Change the client terms ID or current DB terms between render and submit; inspect `bookings_agreements.terms_versions_uuid`. Change catalog prices or mock the response `totalCharged`; inspect the thank-you amount and email behavior.
- **Smallest recommended fix:** Fetch and display the exact current terms record, persist an explicit signer/consent contract, and render the server response's `totalCharged`/confirmation data. Remove or implement the email promise.

#### F-09: Google identity verification and session invalidation are incomplete

- **Severity:** High
- **Classification:** `Confirmed from code`
- **Evidence:** `Backend/src/services/auth.service.ts:242-275`, `loginWithGoogle`, checks token audience and `payload.email`/`given_name` but never checks `payload.email_verified`; the signup path at `Backend/src/services/auth.service.ts:278-309` likewise only requires `payload.email`. `Backend/src/services/auth.session.ts:35-75` verifies signature/version/expiry but has no per-user revocation state. `Backend/src/controllers/auth.session.controller.ts:128-135`, `logout`, only clears the browser cookie; password update functions at `Backend/src/repositories/auth.repository.ts:251-281` do not revoke existing sessions.
- **Why it matters:** An accepted Google token need not prove a verified email claim, and a copied valid JWT remains usable after logout or password reset until expiry/session-version rotation. Clearing one client cookie is not server-side revocation.
- **Reproduction / verification:** Unit-test mocked Google payloads with `email_verified: false` and observe no rejection. Create a session token, call logout or change the password, then call a protected endpoint with the old token; it remains cryptographically valid unless the cookie is absent.
- **Smallest recommended fix:** Require the provider's verified-email claim where product policy depends on it; maintain revocation/session version per user and invalidate on logout/password changes, with focused auth tests.

#### F-10: Temporary-password employees are blocked only by frontend routing

- **Severity:** High
- **Classification:** `Confirmed from code`
- **Evidence:** `Frontend/src/shared/auth/AccountRoute.tsx:37-45` redirects temporary-password employees to first-login; `Backend/src/common/middlewares/auth.middleware.ts:62-74`, `requireEmployee`, checks only `is_employee`; `Backend/src/routes/staff.routes.ts:19-27` and `Backend/src/routes/admin.feedback.routes.ts:18-28` do not check `isUsingTemporaryPassword`.
- **Why it matters:** A temporary-credential employee with a valid session can call employee APIs directly before changing the password. The UI redirect is not a server-side security invariant.
- **Reproduction / verification:** Provision an employee whose password hash carries the temporary marker, create a valid session cookie, bypass the browser route, and call an employee endpoint. The employee gate currently accepts the session.
- **Smallest recommended fix:** Add a server-side `requireCompletedFirstLogin` policy to employee APIs, while keeping the password-change endpoint as the allowed exception; test direct API access.

#### F-11: CSRF/trusted-origin coverage and authentication abuse controls are inconsistent

- **Severity:** High
- **Classification:** `Confirmed from code`
- **Evidence:** `Backend/src/common/middlewares/auth.middleware.ts:95-104`, `requireTrustedOrigin`, accepts a missing Origin; `Backend/src/routes/pet.routes.ts:22-31`, `Backend/src/routes/staff.routes.ts:19-27`, and `Backend/src/routes/petparent.booking.routes.ts:11-13` do not apply it to their mutations. `Backend/src/routes/auth.routes.ts:24-40` has no rate-limit/lockout middleware, and repository search found no rate limiter or lockout implementation for auth/LLM endpoints.
- **Why it matters:** State-changing cookie-authenticated routes have no consistent browser-origin check, and public login/insight endpoints can be brute-forced or used to consume LLM capacity. Missing Origin acceptance weakens the intended origin gate for clients that can omit the header.
- **Reproduction / verification:** Send mutation requests with no Origin and with a disallowed Origin to each route; observe which paths reach handlers. Repeatedly submit invalid login or public insight requests and inspect for a 429/lockout response.
- **Smallest recommended fix:** Define the intended same-site/CSRF policy, enforce it consistently on cookie-authenticated mutations, and add narrow rate limits/lockout/backpressure to login, reset, and LLM-consuming endpoints.

#### F-12: Public LLM endpoint leaks internal error strings and lacks abuse boundary

- **Severity:** High
- **Classification:** `Confirmed from code`
- **Evidence:** `Backend/src/routes/feedback.routes.ts:8`, `POST /generate-insights` is public; `Backend/src/controllers/feedback.controller.ts:12-27`, `generateInsights`, returns `details: String(error)` on 500; `Backend/src/services/feedback.service.ts:94-119` directly invokes `generateObject`.
- **Why it matters:** Anonymous callers can consume model resources and receive provider/implementation details. The endpoint is separate from the authenticated parent ownership path, so it is not protected by the parent session.
- **Reproduction / verification:** Call `/api/feedback/generate-insights` anonymously with valid input and force the model provider to fail; inspect the response body. Load-test a bounded staging endpoint and observe there is no route-level auth/rate gate.
- **Smallest recommended fix:** Remove internal error details from production responses, put the endpoint behind the intended auth/rate policy or remove it if only the submit service needs it, and keep structured schema validation.

#### F-13: Feedback reply validates `emailBody` but discards it, marks any category sent, and UI reports a send that is not performed

- **Severity:** High
- **Classification:** `Confirmed from code`
- **Evidence:** `Backend/src/controllers/admin.feedback.controller.ts:247-266`, `replySchema` requires `emailBody` but calls `replyToFeedback(uuid, actorId)` without passing it; `Backend/src/services/admin.feedback.workflow.service.ts:166-187`, `replyToFeedback`; `Backend/src/repositories/admin.feedback.workflow.repository.ts:35-76`, `replyFeedbackRecord`, writes `current_status='sent'` and a `sent` timeline event without category/state validation or email delivery. `Frontend/src/features/admin/components/feedback/FeedbackDetailContent.tsx:131-136` fabricates the recipient as `${parentName...}@example.com`, and `DraftResponseEditor.tsx:32-40,67-83` presents a recipient/send-email UI, while `Backend/src/services/feedback.notification.service.ts:26-30` only logs mock internal email.
- **Why it matters:** Staff input is silently lost, an Issue/Suggestion can bypass its intended workflow, and a successful HTTP response means only a status mutation, not an email sent to a parent. This creates an audit and customer-communication integrity failure.
- **Reproduction / verification:** POST a reply with a unique `emailBody` to Praise, Issue, and Suggestion fixtures; inspect repository arguments, DB status/timeline, outbound email provider calls, and frontend success message.
- **Smallest recommended fix:** Pass and persist the approved reply body in a reply record/outbox, validate category-specific transition rules, and return "queued/sent" only from an actual delivery boundary.

#### F-14: Feedback audio has public development retrieval, incomplete cleanup, and weak upload semantics

- **Severity:** High
- **Classification:** `Confirmed from code`
- **Evidence:** `Backend/src/server.ts:47-49` serves the feedback directory statically without auth in development; `Backend/src/services/admin.feedback.workflow.service.ts:147-163`, `deleteFeedback`, deletes DB state only; `Backend/src/services/feedback.audio.storage.ts:14-30`, `getSafeExtension` falls back any unknown extension to `.webm` and only checks non-empty buffer; `Backend/src/common/middlewares/upload.middleware.ts:6-11` limits size but does not validate MIME/content; no retention path is present. `Backend/src/services/parent.feedback.service.ts:124-127` removes audio only when the initial DB insert fails.
- **Why it matters:** Audio can outlive deleted feedback, development URLs expose recordings without staff auth, and extension/name metadata is not content validation. Audio is potentially sensitive personal data and may accumulate indefinitely.
- **Reproduction / verification:** Upload a renamed/non-audio file under an allowed or unknown extension; retrieve the returned path without a cookie in development; delete the feedback and check whether the local file remains.
- **Smallest recommended fix:** Gate audio retrieval, validate MIME/content and size at the upload boundary, delete storage objects on feedback deletion, and define retention/expiry ownership.

#### F-15: AiService is unauthenticated, unbounded, and has a temporary-file failure path

- **Severity:** High
- **Classification:** `Confirmed from code`
- **Evidence:** `AiService/main.py:10-17` enables wildcard CORS with credentials; `AiService/main.py:27-37`, `transcribe_audio`, reads the entire upload without size/content limit; `AiService/main.py:41-61` performs synchronous Whisper work inside an async handler and returns `str(e)` in a 500; `AiService/main.py:63-66` references `temp_file_path` even if `NamedTemporaryFile` failed; no `AiService` tests or Python CI job are present.
- **Why it matters:** Any origin/client can consume CPU/memory, errors disclose internals, concurrent requests can block the event loop, and a temp-file creation failure can mask the original error with an unbound local variable.
- **Reproduction / verification:** POST a large/non-audio body and observe it is read before model processing; force temp-file creation/model failure and inspect the finally block; check CI for a Python test job.
- **Smallest recommended fix:** Add explicit service auth or network boundary, restrictive CORS, upload size/content validation, bounded worker execution, safe error responses, and Python tests run in CI.

### Medium

#### F-16: User identity flags and staff roles are not database-consistent, and projections disagree on invalid values

- **Severity:** Medium
- **Classification:** `Confirmed from code`
- **Evidence:** `Backend/database/neon.sql:92-123`, `users.is_employee/is_pet_owner` are nullable and `employees.staff_role` is free `VARCHAR`; no cross-table checks require flag/extension consistency. `Backend/src/services/auth.service.ts:140-158` maps an invalid/null staff role to authenticated `employee_role: null`; `Backend/src/repositories/staff.read.repository.ts:59-80` maps the same value to `staff`.
- **Why it matters:** The same database row can route to different UI/API authorization behavior depending on the projection used. Nullable independent flags can represent impossible identities such as an employee without an employee row or a role-bearing non-employee.
- **Reproduction / verification:** Insert/update an employee row with null/unknown `staff_role` or inconsistent user flags in an isolated DB, then compare `/api/auth/me` with staff profile output and route gates.
- **Smallest recommended fix:** Define one role source of truth and a normalized projection; add appropriate `NOT NULL`/allowlist/consistency constraints or migration-backed invariant checks, then align auth/staff mapping tests.

#### F-17: Staff deletion checks only assignments; other non-cascading foreign keys can turn deletion into a 500

- **Severity:** Medium
- **Classification:** `Confirmed from code`
- **Evidence:** `Backend/src/repositories/staff.write.repository.ts:331-350`, `removeStaff`, blocks only `employee_assignments` before deleting `users`; `Backend/src/data/First_version_schema.sql:270-287` defines `tasks.employees_uuid` without `ON DELETE CASCADE`, `:342-350` defines `messages.employees_uuid` without cascade, and `:374-397` defines feedback timeline/notification employee references without cascade. The Neon schema has the same non-cascading employee references at `Backend/database/neon.sql:291-306`, `:362-419`.
- **Why it matters:** A staff member with tasks, timeline actor records, notifications, or messages but no assignment can pass the pre-check, then the user cascade attempts can violate an FK. The UI receives a generic failure and the deletion semantics are unclear.
- **Reproduction / verification:** In an isolated DB create a staff member with a task or feedback timeline actor but no `employee_assignments`, call the manager delete endpoint, and inspect the FK error/transaction rollback.
- **Smallest recommended fix:** Decide retention semantics first; either block with an explicit dependency summary, reassign/anonymize references, or add deliberate cascade behavior with migration and focused integration tests.

#### F-18: Pet profile update mutates a shared owner row; empty medication PATCH reports success

- **Severity:** Medium
- **Classification:** `Confirmed from code`
- **Evidence:** `Backend/src/repositories/pet.repository.ts:103-143`, `updatePetRecord`, updates `pet_owners` by owner UUID after updating one pet; `Backend/src/repositories/pet.repository.ts:291-311`, `updatePetMedication`, returns `true` when `assignments.length === 0` without checking the medication row. `Backend/src/controllers/pet.controller.ts:121-131` accepts a partial medication body.
- **Why it matters:** Renaming the owner while editing one pet changes the owner displayed for all sibling pets. A PATCH with `{}` can claim success for a nonexistent medication, creating false UI state and audit ambiguity.
- **Reproduction / verification:** Give one owner two pets, edit the owner name through one pet, and list both pets. Send an empty PATCH for an unknown medication ID and observe the 200 path.
- **Smallest recommended fix:** Separate owner edits from pet edits; require a non-empty patch or return 404/422 for empty updates; add regression tests for sibling isolation and nonexistent medication IDs.

#### F-19: Pet ID validation does not match repository UUID casts; tests mask the live failure

- **Severity:** Medium
- **Classification:** `Confirmed from code`
- **Evidence:** `Backend/src/controllers/pet.controller.ts:19-29`, `petIdSchema`, accepts any non-empty string; `Backend/src/repositories/pet.repository.ts:90-93` casts `$1::uuid`. `Backend/src/__tests__/pet.api.test.ts:7-24` mocks the repository and uses non-UUID fixtures (`p1`, `p2`) while expecting a 404 at `:167-172`.
- **Why it matters:** A malformed non-empty production ID can raise a database cast error rather than the expected controlled 404/400. The mocked API test cannot exercise the cast boundary and may give false confidence.
- **Reproduction / verification:** Call a live DB-backed detail endpoint with `no-such-pet` or another non-UUID string; compare with the mocked test result.
- **Smallest recommended fix:** Validate UUID at the controller contract (or use a repository query that safely handles legacy IDs), then add a live/contract regression test for malformed IDs.

#### F-20: Feedback state is split between `feedback.current_status` and timeline-derived Suggestion state without DB allowlists

- **Severity:** Medium
- **Classification:** `Confirmed from code`
- **Evidence:** `Backend/src/services/parent.feedback.service.ts:95-108` initializes Suggestion as `captured` but `Backend/src/repositories/feedback.repository.ts:68-80` inserts `feedback.current_status='submitted'`; `Backend/src/services/admin.feedback.read.service.ts:314-363` derives Suggestion status from timeline; schema columns are unconstrained `VARCHAR`/JSONB at `Backend/database/neon.sql:376-401` and `Backend/src/data/First_version_schema.sql:356-380`.
- **Why it matters:** Two consumers can observe different "current status" values, and direct/legacy SQL can store invalid category, step, or payload shapes. The application validator catches some read-time invalid states but does not prevent bad persisted values.
- **Reproduction / verification:** Submit a Suggestion and read both `feedback.current_status` and its latest timeline event; insert an unsupported category/step directly in an isolated DB and observe whether constraints reject it.
- **Smallest recommended fix:** Specify ownership of current state, reconcile existing rows, and add DB allowlists/JSON shape constraints or a controlled event model; keep service transition tests aligned.

#### F-21: Frontend parent data sources are account-global localStorage, static stays, and DB pets, so accounts can cross-display data

- **Severity:** Medium
- **Classification:** `Confirmed from code`
- **Evidence:** `Frontend/src/features/pet-parent/profile/repository.ts:12-38`, `STORAGE_KEY='wagstay-parent-profile-v2'`, reads/writes one browser-global key; `Frontend/src/features/pet-parent/profile/repository.ts:55-108`, owner/pet/medication edits never call the Backend. `/parent/stays` uses defaults in `Frontend/src/features/pet-parent/pages/MyStaysPage.tsx:1-14` imported from `Frontend/src/features/pet-parent/components/stays/staysDefaults.ts:22-84`, rather than the profile repository. `Frontend/src/features/pet-parent/pages/PetParentFeedbackPage.tsx:21-25,49-79` selects the first DB pet; `Frontend/src/features/pet-parent/components/booking/BookingFlow.tsx:44-69` fetches DB pets/services.
- **Why it matters:** Two accounts using the same browser can see the same local owner/pet data, while the stays page independently shows static defaults; profile edits do not affect booking/feedback DB data; feedback has no explicit pet selector and silently targets the first DB pet. This is a user/data-integrity boundary, not only a presentation difference.
- **Reproduction / verification:** Log in as two accounts in one browser, edit the local profile under account A, then inspect account B and start booking/feedback. Compare localStorage state with `GET /api/petparent/pets`.
- **Smallest recommended fix:** Namespace local state by authenticated user only if it remains deliberately local; otherwise make parent profile/stays server-backed and require an explicit selected pet for feedback/booking contracts.

#### F-22: Hardcoded origins, external avatar requests, and voice hooks weaken deployment/privacy behavior

- **Severity:** Medium
- **Classification:** `Confirmed from code`
- **Evidence:** `Frontend/src/shared/api/index.ts:1` hardcodes `http://localhost:3000/api`; `Frontend/src/shared/hooks/voice/useWhisperTranscription.ts:21-44` hardcodes `http://localhost:8000/transcribe`, parses `data.text` without runtime shape validation, and has no abort; `Frontend/src/shared/hooks/voice/useAudioRecorder.ts:8-50` has no unmount cleanup; `Frontend/src/features/admin/components/AdminNavbar.tsx:130` and `Frontend/src/features/pet-parent/components/PetParentNavbar.tsx:139` build `ui-avatars.com` URLs from user name/email.
- **Why it matters:** The documented Vite override cannot work through the shared API constant; production/staging can call localhost; unmounting during recording/transcription can leave media/network work running; and names/emails are sent to a third-party avatar service.
- **Reproduction / verification:** Build with a different `VITE_API_BASE_URL` and inspect the generated request URL; navigate away while recording/transcribing; inspect browser network requests for avatar query strings.
- **Smallest recommended fix:** Resolve API/Whisper origins from one environment-aware config, abort/cleanup on unmount, validate the Whisper response, and use local/generated avatars or obtain explicit privacy approval for external requests.

#### F-23: Suggestion notification is after the feedback commit, so response semantics can diverge from persistence

- **Severity:** Medium
- **Classification:** `Reasonable inference`
- **Evidence:** `Backend/src/services/parent.feedback.service.ts:95-96` resolves `getManagerRecipient()` before persistence; `Backend/src/repositories/feedback.repository.ts:63-113` commits feedback and initial timeline; `Backend/src/services/parent.feedback.service.ts:135-155` then calls `notifySuggestionManager`; `Backend/src/services/feedback.notification.service.ts:26-36` only logs a mock email and can still throw. The manager lookup occurs after audio save at `parent.feedback.service.ts:78-93`, but before the DB insert catch at `:110-133`.
- **Why it matters:** If `notifySuggestionManager()` fails after the DB commit, the API can return an error even though feedback exists, causing retries/duplicates and confusing the parent. If the log is treated as delivery, there is no durable notification/outbox record. Separately, a pre-commit manager lookup failure can occur after audio save and is outside the DB-insert cleanup catch, leaving an orphaned file.
- **Reproduction / verification:** Force only `notifySuggestionManager()` to reject after a successful `createFeedbackRecord`; inspect the HTTP response and database row. Separately, force `getManagerRecipient()` to reject after audio save and verify whether the local file is removed.
- **Smallest recommended fix:** Use a transactional outbox or return persistence success with an explicit notification-pending status; make notification delivery idempotent and durable before calling it sent.

#### F-24: Whisper transcript is appended to `raw_answer` but never persisted in `feedback.transcript`; LLM safety evaluation is incomplete

- **Severity:** Medium
- **Classification:** `Confirmed from code`
- **Evidence:** `Frontend/src/shared/hooks/voice/useVoiceInput.ts:34-40` sends Whisper output into the answer; `Backend/src/services/parent.feedback.service.ts:135-142` returns `transcript: null`; `Backend/src/repositories/feedback.repository.ts:68-90` omits `transcript` from INSERT. `Backend/src/services/feedback.service.ts:98-119` interpolates user text into the LLM prompt; existing `Backend/src/__tests__/llm.evaluation.test.ts` checks schema/basic output shape and selected prompt contract, but there is no prompt-injection or semantic-safety scenario coverage.
- **Why it matters:** Operators cannot distinguish typed answer from machine transcript, and transcript provenance is lost. Structured output validation does not stop a malicious answer from influencing model behavior or producing unsafe summaries.
- **Reproduction / verification:** Submit a voice feedback payload and inspect `feedback.transcript`; run/search LLM tests for injection, instruction override, sensitive-data leakage, and unsupported claims.
- **Smallest recommended fix:** Choose and document transcript persistence/provenance; add adversarial prompt-safety and semantic-faithfulness eval cases before relying on summaries operationally.

#### F-25: PostgreSQL production SSL disables certificate verification

- **Severity:** Medium
- **Classification:** `Confirmed from code`
- **Evidence:** `Backend/src/config/database.ts:21-28`, `pool`, sets `ssl: { rejectUnauthorized: false }` whenever `NODE_ENV === 'production'`.
- **Why it matters:** TLS encryption can remain enabled while server certificate identity is not verified, increasing interception/misrouting risk for database credentials and data.
- **Reproduction / verification:** Start the backend in production mode with a deliberately untrusted/mismatched DB certificate and observe that the client configuration does not reject it.
- **Smallest recommended fix:** Use provider CA verification or an explicit environment-controlled CA bundle; fail closed when production TLS verification cannot be established.

## 6. Feedback state-transition map

### Issue / Praise path actually observed

```text
POST /api/feedback
  -> authenticated parent + owned pet
  -> LLM insights + optional audio
  -> feedback.current_status = submitted
  -> timeline step = submitted (Issue/Praise)

Issue admin:
  submitted -> review_started -> fact_checked -> sent
  (admin.feedback.workflow.service.ts:26-30, 46-70)
  each transition locks/checks expected current status and writes feedback.current_status
  plus timeline event transactionally (admin.feedback.workflow.repository.ts:79-130)

Praise:
  submitted -> no Issue progress transition allowed by updateStatus;
  reply endpoint can nevertheless set sent without category/state check (F-13).
```

### Suggestion path actually observed

```text
POST /api/feedback
  -> initial timeline step = captured with workflow payload
  -> feedback.current_status is still inserted as submitted
  -> mock manager notification is logged after commit

Suggestion timeline:
  captured -> under_review -> decision_recorded -> closed
  latest suggestion timeline event is projected as suggestionWorkflow.status
  (admin.feedback.read.service.ts:314-363)
  transition service checks current timeline status and category
  (admin.feedback.workflow.service.ts:72-144)

Reply endpoint:
  any feedback category -> feedback.current_status = sent + sent timeline event
  emailBody is validated then discarded; no external send (F-13).
```

Read state is a separate global row flag: `GET /api/admin/feedback/:id` performs a read and then marks an unread record read (`Backend/src/services/admin.feedback.read.service.ts:410-425`). This is not a pure GET and means a failed/automated detail read changes operational state.

## 7. Frontend / API / DB contract review

| Contract             | Source evidence                                                                                                                                                                                                                                                                                                                        | Assessment                                                                                                                                               |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Parent feedback      | Frontend sends `{pet_uuid, category, rating_details, raw_answer}` plus optional audio with credentials (`Frontend/src/features/pet-parent/api/feedbackApi.ts:53-72`); controller validates and service checks owner (`Backend/src/controllers/feedback.controller.ts:32-77`; `Backend/src/repositories/feedback.repository.ts:45-60`). | Core owner check is aligned. Transcript remains null, and client-selected first pet plus DB owner can diverge from local profile.                        |
| Admin feedback       | Router requires employee; status/decision enums are controller validated; DB status/category/step fields remain free text (`Backend/src/routes/admin.feedback.routes.ts:18-28`; `Backend/database/neon.sql:376-401`).                                                                                                                  | Coarse employee boundary exists; persistence allowlists and reply delivery contract do not fully align.                                                  |
| Booking              | Frontend/API contract documents `totalCharged` and one transaction (`Frontend/src/features/pet-parent/api/bookingApi.ts:100-138`); implementation does transactionally write several tables (`Backend/src/repositories/petparent.booking.repository.ts:195-303`).                                                                      | Transaction exists, but input set/cardinality/ownership checks are incomplete and UI ignores `totalCharged`.                                             |
| Payment              | Frontend explicitly sends raw mock fields (`Step5Payment.tsx:158-162`); DB stores processor token shape (`First_version_schema.sql:216-231`).                                                                                                                                                                                          | Shape appears tokenized in DB, but the server receives raw PAN/CVC and mock approves all valid syntax.                                                   |
| Task                 | Backend routes accept UUIDs and payloads; frontend has multiple clients with hardcoded origin and no credentials (`TaskPage.tsx:21-26`; `TaskTimeline.tsx:42-54`; `useTaskEditor.ts:111-125`).                                                                                                                                         | API routes are public; client error/credential behavior is not a reliable authenticated contract. Update semantics can also mismatch assignment/staff.   |
| Parent profile/stays | Local repository owns owner/pets/medications (`profile/repository.ts:25-108`); `/parent/stays` uses `DEFAULT_UPCOMING_STAYS`/`DEFAULT_PAST_STAYS` (`MyStaysPage.tsx:1-14`; `components/stays/staysDefaults.ts:22-84`); booking/feedback fetch DB pets (`bookingApi.ts:81-98`; `PetParentFeedbackPage.tsx:49-79`).                      | Deliberate source split is documented, but local profile state is not account-namespaced and static stays/DB pets produce cross-feature inconsistencies. |

Additional task integrity defects: `Backend/src/services/task.service.ts:176-200` validates `assignmentId` first but sends both `assignmentId` and `staffId` to `updateTaskRecord`; `Backend/src/repositories/task.repository.ts:140-148` gives `$10` (`staffId`) precedence over the assignment subquery. Thus validation can pass for one assignment while persistence selects another staff ID. The scheduling checks are separate reads before inserts (`task.service.ts:132-165`; `task.repository.ts:157-186,253-275`) with no transaction-level exclusion constraint, so concurrent requests can both pass.

`validDate` accepts `undefined` and `null` (`Backend/src/modules/tasks/task.types.ts:23-26`), and `updateTaskRecord` uses `COALESCE($5, scheduled_at)` (`Backend/src/repositories/task.repository.ts:140-148`), so the advertised "clear dueDatetime" behavior is not represented by the update path; a missing value can also pass controller validation in create/update cases.

## 8. Automated test inventory, results, and gaps

### Fresh execution evidence supplied for this audit checkout

| Command                                          | Result                                                                                          | Interpretation                                                                                                         |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `npm run test --prefix Frontend -- --run`        | **39 test files, 175 tests passed**                                                             | Frontend unit evidence is green for the executed suite.                                                                |
| `npm run test:unit --prefix Backend`             | **Final exit 1**; six Supertest files hit sandbox `listen EPERM 0.0.0.0`; other unit groups ran | Environment limitation, not a product assertion that the suite is green. Do not report this as a passed backend suite. |
| `npm run lint`                                   | **Pass**                                                                                        | Root lint check.                                                                                                       |
| `npm run lint --prefix Frontend`                 | **Pass**                                                                                        | Frontend lint check.                                                                                                   |
| Scoped Prettier check                            | **Pass**                                                                                        | Formatting check for the audit scope supplied by the main audit run.                                                   |
| `npx tsc --noEmit -p Backend/tsconfig.json`      | **Pass**                                                                                        | Backend static type check.                                                                                             |
| `npx tsc --noEmit -p Frontend/tsconfig.app.json` | **Pass**                                                                                        | Frontend static type check.                                                                                            |
| PostgreSQL API tests / Playwright E2E            | **Not run**                                                                                     | Read-only audit boundary; these start services and mutate an isolated DB.                                              |

### Coverage observed

- Backend has auth, staff, pet-assignment, feedback repository/service/API, and mocked pet API tests. `Backend/src/__tests__/pet.api.test.ts:7-25` mounts the pet router with mocked repositories, so it does not prove live auth or UUID-cast behavior.
- Feedback API tests mock auth middleware (`Backend/src/__tests__/feedback.api.test.ts:51-63`) and repository/LLM dependencies (`:65-96`); they exercise controller/service behavior but not the real database boundary for most cases.
- LLM tests check schema/basic output shape and selected prompt contract, but not semantic neutrality, prompt injection, or semantic safety.
- No dedicated task API/service/repository behavioral test file, no booking API/service/repository test file, and no AiService Python test file were found.
- `playWright/parent-feedback.persistence.spec.ts:158-183` navigates directly to `/parent/feedback` and submits without performing login; the web server config starts services but does not establish a browser session. It therefore is not self-contained for the authenticated parent contract.
- CI runs Frontend tests/build and Backend unit tests, but both npm audit steps deliberately use `|| true` (`.github/workflows/ci.yml:76-79,139-142`) and there is no Python/AiService job. PostgreSQL API tests require external Neon setup and were not run in this audit.

## 9. Duplicate / dead / contradictory logic

| Item                                                       | Evidence                                                                                                                                                                           | Impact                                                                                                   |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Unused mock parent feedback context                        | `Frontend/src/features/pet-parent/data/mockParentFeedbackContext.ts:1-7`; repository search finds only its own definition and a documentation mention                              | Preserves a misleading fixed-pet abstraction after the page moved to a DB pet lookup.                    |
| Unused `fetchFeedbackList`                                 | `Frontend/src/features/admin/api/feedbackApi.ts:205-231`; no production caller found, while snapshot/detail fetchers are used                                                      | Two competing list API abstractions can drift in payload/error behavior.                                 |
| Legacy `AdminDashboard` and commented `LegacyTaskTimeline` | `Frontend/src/features/admin/components/AdminDashboard.tsx:69-300,302-315`; current portal imports `AdminDashboardPage` at `AdminPortal.tsx:5,18,35`                               | Large stale mock UI and commented task implementation obscure the actual route and duplicate task logic. |
| Unused numeric `validId`                                   | `Backend/src/modules/tasks/task.types.ts:17-21`; current task controller uses UUID validation (`:5-19`)                                                                            | Retains an old integer-ID convention beside current UUID contracts.                                      |
| Duplicate task fetchers/origins                            | `TaskPage.tsx:6,21-26`, `TaskTimeline.tsx:6,42-54`, `useTaskEditor.ts:4,62-125`, `useTaskDashboardTable.ts:4,40-66`, plus commented legacy fetches at `AdminDashboard.tsx:306-310` | Repeated clients omit shared auth/error/response handling and increase contract drift.                   |
| Assignment/staff naming mismatch                           | `useTaskEditor.ts:98-109` sends `staffId`; `task.service.ts:176-200` accepts both; repository precedence differs                                                                   | Can validate one assignment but persist another staff link.                                              |

## 10. Documentation-claim-only drift

These are not runtime findings by themselves; they are claims in documentation that conflict with inspected source and should not be used as implementation evidence.

1. Root README says `VITE_API_BASE_URL` overrides/inference (`README.md:144-156`), while `Frontend/src/shared/api/index.ts:1` is a fixed localhost constant and Whisper is fixed at `useWhisperTranscription.ts:25`.
2. Root README calls `Backend/database/neon.sql` the final canonical schema (`README.md:417-444`), while Docker and test preparation apply `Backend/src/data/First_version_schema.sql` (`docker-compose.yml:19-24`; `prepare-postgres-api-test-db.ts:56-61`).
3. `Frontend/README.md:35-53` still describes parent feedback as "fixed demo pet", booking as "no booking/payment API", and feedback as mock-backed in places, while current source has DB pet/feedback calls and a booking API (`PetParentFeedbackPage.tsx:49-79`; `bookingApi.ts:81-148`).
4. `Frontend/README.md:19-24` claims API inference/override that the fixed API constant does not implement.
5. `docs/feedback-system.md:251-268` describes `First_version_schema.sql` as the feedback schema, while root/Backend README claims Neon is final; the same document accurately notes transcript non-persistence at `:159-162`, but its "Confirmed" labels do not establish runtime execution.
6. `Frontend/src/features/pet-parent/api/bookingApi.ts:120-138` documents a server transaction, processor charge, and client trust in `totalCharged`; source confirms the transaction but not a real processor or the Step6 use of the returned amount.

## 11. Unverified / residual risk

- PostgreSQL API and Playwright E2E were intentionally not run; the report does not claim live Neon/Docker state, real provider delivery, or browser authentication behavior beyond source inspection.
- Whether the production deployment exposes the development static audio route is not verified; source disables it when `NODE_ENV === 'production'`, but deployment environment configuration was not inspected.
- Fine-grained staff permissions, facility-level visibility, and intended employee ability to edit all pets/tasks are documented as deferred; this audit does not convert that product decision into a confirmed vulnerability.
- Actual Google provider behavior and whether upstream infrastructure guarantees `email_verified` were not verified; the application itself does not enforce the claim.
- Actual payment processor, email provider, object storage, rate limiting, reverse proxy, network ACL, and secret-management configuration are not present in the inspected runtime code; absence from this repository is a residual risk, not proof that an external platform control exists or does not exist.
- Database constraints on the deployed Neon instance may differ from the checked SQL files; this is precisely why schema preflight must validate constraints/types and not only selected table/column names.

## 12. Prioritized smallest-remediation sequence

1. **Contain public mutation/read exposure:** gate pet and task routers with employee auth, add object-scope checks, cover anonymous/wrong-object tests, and apply the selected CSRF/origin policy to all cookie-authenticated mutations.
2. **Make booking fail closed:** enforce exact pet/date/service/info sets and ownership, cross-field date/time rules, stale-selection cleanup, and server-authoritative confirmation display. Disable raw-card/mock-charge flow outside an explicit prototype environment.
3. **Repair auth session boundary:** require verified Google email where intended, add first-login enforcement server-side, implement revocation/version invalidation on logout/password changes, and rate-limit login/reset/LLM endpoints.
4. **Choose and enforce one schema source:** reconcile First_version vs Neon, table/column names, employee fields, medication FK/table naming, and make Docker/test/preflight/CI consume the same artifact. Extend preflight to constraints/types and add an explicit database isolation guard before any force-drop preparation operation.
5. **Make feedback auditable:** pass/persist reply content, enforce category-specific transitions, use a durable notification/outbox boundary, separate read from GET if desired, persist transcript provenance by decision, and delete/retain audio deliberately behind authorization.
6. **Remove frontend source-of-truth splits:** namespace or replace localStorage profile data, use one API client with credentials/error handling, replace hardcoded origins, and make feedback pet selection explicit.
7. **Add boundary tests and CI evidence:** task and booking contract/integration tests, live pet UUID/error tests, authenticated self-contained Playwright login, AiService Python tests, prompt-injection/semantic LLM evals, and non-ignored security audit reporting.
8. **Clean stale paths after behavior is covered:** remove unused mock/list helpers, old dashboard/task code, numeric ID helper, and contradictory README/docs claims.

## 13. Evidence / commands reviewed

### Source and configuration reviewed

- `Backend/src/server.ts`; all mounted route files under `Backend/src/routes/` plus `Backend/src/modules/tasks/task.routes.ts`.
- Auth middleware/session/service/repository/controllers; staff middleware/service/repositories; pet/task/feedback/booking controllers, services and repositories.
- `Backend/src/data/First_version_schema.sql`, `Backend/database/neon.sql`, migrations, Docker Compose, database config, PostgreSQL test preparation/preflight scripts.
- `Frontend/src/App.tsx`, `AccountRoute`, auth store, parent booking/feedback/profile/stays flows, admin pet/task/feedback flows, shared API and voice hooks.
- `AiService/main.py`, requirements/README; root/Backend/Frontend README and `docs/feedback-system.md`, `docs/testing-guide.md`.
- Backend/Frontend tests, Playwright configuration/spec, `.github/workflows/ci.yml`, and package scripts.

### Read-only commands / checks

- `git status --short`; `git rev-parse HEAD`.
- `rg --files`, `rg -n` for route mounts, middleware, cross-layer contracts, schema/table names, tests, stale symbols and hardcoded origins.
- `nl -ba ... | sed -n ...` on each cited source to re-open exact current line numbers before writing this report.
- Fresh execution evidence is recorded in Section 8; PostgreSQL/E2E were not rerun under the read-only audit boundary.

### Change boundary verification after writing

The expected post-write change is exactly `docs/reviews/full-repository-audit.md`; no code, tests, schema, migration, configuration, lockfile, or other artifact is in scope for this audit.
