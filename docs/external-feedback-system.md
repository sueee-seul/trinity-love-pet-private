# External Feedback System (Google Reviews)

This document records the current code behavior of the Google-shaped external feedback flow.
The source of truth for each statement is the current `Backend/`, `Frontend/`, SQL migration, or
test code linked below. It does not treat a product idea or an old document as an implemented
behavior.

## System boundary

The repository contains two different review records:

| Record                                             | Runtime owner                                                        | Used by                                                                      |
| -------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `place_reviews`                                    | `createReviewRecord()`                                               | The simulator route at `/api/reviews/simulator`                              |
| `google_business_reviews` plus `external_feedback` | `createGoogleBusinessReviewRecord()` and the admin review repository | The public PetHouse Google-shaped page and the employee admin review surface |

The simulator does not create an admin Google review. The admin projection reads from
`google_business_reviews`, joins the linked `external_feedback` row, and adds reviewer identity and
media data. The application employee session and the public reviewer session are separate:

- Employee authentication uses `wagstay_session` and reloads the employee from `users` and
  `employees`.
- Public reviewer authentication uses `maps_reviewer_session` and the `reviewer_identities` table.
- A reviewer identity is not automatically a `users`, `pet_owners`, or `employees` identity.

The review location lookup currently maps only `PetHouse` to `mock-pethouse-location` in
`getGoogleLocationIdForPlaceSlug()`. The current review repository contains no Google Business
Profile API client or remote provider synchronisation path. The seeded and user-created review rows
are app-owned records with `data_origin = 'mock'`.

## Permission rules

These are the rules enforced by the current admin Google review path.

| Actor                               | Visible reviews                                                                        | Allowed operations                                                                                                   | Enforced by                                                                                               |
| ----------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Manager                             | All reviews for the requested location                                                 | Read and correct the review Type; assign typed reviews; reply to any review that is supported by the mock reply path | `requireEmployee`, manager-only mutation middleware, and the manager branch of the repository query       |
| Staff                               | Only rows where `external_feedback.assigned_employee_uuid = authenticated employee id` | Read the server-scoped projection and reply only to an assigned review                                               | The Staff SQL predicate in `findAdminGoogleBusinessReviews()` and `updateMockGoogleBusinessReviewReply()` |
| Unassigned review                   | Visible to Manager; omitted from Staff list                                            | Manager can assign it; Staff cannot see or reply to it                                                               | A `LEFT JOIN` plus the Staff assignment predicate                                                         |
| Review assigned to another employee | Visible to Manager; omitted from that Staff member's list                              | Only the assigned Staff member may use the Staff reply path                                                          | The same assignment predicate compares against `req.user.id`                                              |

In concrete terms:

- Assignment is Manager-only. A Staff request to `PATCH /api/admin/google-reviews/assignee`
  stops at `requireManager` and returns 403 before the assignment service is called.
- The Frontend derives `canAssignGoogleReviews` from `user.employee_role === 'manager'`.
  Staff do not receive the Google review bulk-action bar, Select button, row checkboxes, or Assign
  control.
- Staff cannot use a crafted assignment request as a substitute for the hidden UI. The route
  guard remains server-side.
- A Staff reply for an unassigned review or a review assigned to another employee produces the same
  `GOOGLE_REVIEW_NOT_FOUND` 404 boundary as a missing review.
- The assignment repository validates that the target exists in `employees`. It does not require
  `staff_role = 'staff'`; despite the UI label `Assign staff`, the current API accepts any valid
  employee UUID as `assigneeId`.

### Detail-route gap

The desired product rule is:

> Staff directly opening another employee's Google review detail must be denied with 404.

The current code does not yet implement that rule as an HTTP detail read:

1. Both Manager and Staff route arrays register `/admin/google-reviews/:id`.
2. `AdminGoogleReviewDetailPage` reads the review from the already-loaded, server-scoped
   `useGoogleReviewStore` page.
3. If the ID is absent, the page navigates back to the Google review card list.
4. There is no `GET /api/admin/google-reviews/:id` endpoint.

Therefore, the current code proves a 404 for an unauthorized Staff reply, but not a 404 response for
a direct detail URL. This remains a documented gap rather than a falsely confirmed behavior.

## Public reviewer flow

### Reviewer session

`POST /api/review-auth/google` accepts an OAuth authorization code. The controller requires a
trusted origin, checks the Google client configuration, exchanges the code, verifies the identity,
upserts `reviewer_identities`, creates a signed `maps_reviewer_session`, and returns a sanitized
reviewer profile. `GET /api/review-auth/me` restores that profile through `requireReviewer`.

The reviewer cookie contains the reviewer UUID as its subject plus `displayName` and `avatarUrl`.
It is HttpOnly, SameSite Lax, and has the same eight-hour lifetime as the employee session. The
reviewer logout route clears only this cookie.

Source: [reviewer-auth.routes.ts](../Backend/src/routes/reviewer-auth.routes.ts),
[reviewer-auth.controller.ts](../Backend/src/controllers/reviewer-auth.controller.ts),
[reviewer.middleware.ts](../Backend/src/common/middlewares/reviewer.middleware.ts),
[reviewer.service.ts](../Backend/src/services/reviewer.service.ts), and
[reviewer.session.ts](../Backend/src/services/reviewer.session.ts).

### Public page read

`GET /api/google-reviews?placeSlug=PetHouse` is public. The route resolves the supported place slug,
loads one `google_business_locations` row, then loads all `google_business_reviews` rows for that
location ordered by `google_created_at DESC`, `created_at DESC`, and `uuid DESC`.

The service maps the database page into:

```text
location:
  id, displayName, formattedAddress, googleMapsUri
  averageRating, totalReviews, ratingBreakdown
reviews[]:
  id, reviewerName, reviewerAvatarUrl, reviewerIsAnonymous
  rating, reviewText, createdAt, updatedAt
  ownerReply, ownerReplyUpdatedAt, photoUrls
```

The public projection does not expose `reviewer_email`, `ai_insights`, `is_read`,
`current_status`, or `assigned_employee_uuid`.

### Human review creation

`POST /api/google-reviews` follows this execution order:

1. `requireReviewer` verifies `maps_reviewer_session` and puts the reviewer profile on `req`.
2. `requireTrustedOrigin` validates the request origin.
3. `reviewPhotoUpload.array('photos', 9)` accepts at most nine uploaded photos. The photo storage
   service writes development files and returns their public paths.
4. The controller parses the review payload with `parseReviewSubmissionPayload()`.
5. `ReviewService.createHumanReview()` calls `generateGoogleReviewAiInsights()` before persistence.
6. `createGoogleBusinessReviewRecord()` opens one database transaction and inserts:
   - one `google_business_reviews` row;
   - one `google_review_media_logs` row per stored photo;
   - one `external_feedback` row containing the AI result.
7. If database persistence fails, the service removes the files it already saved.
8. The response is a public `PublicReview` object. It does not return the staff-only AI projection.

The initial `external_feedback` row uses database defaults: `is_read = false`,
`current_status = 'received'`, and no assignee. The review creation path does not assign a staff
member, create an external reply row, or call Google to publish anything.

### Simulator creation and development deletion

`POST /api/reviews/simulator` is a separate route protected by the timing-safe
`X-Review-Simulator-Secret` comparison. It upserts a simulator reviewer and inserts into
`place_reviews` through `createReviewRecord()`.

`DELETE /api/google-reviews/:id` is limited to non-production and a trusted origin. The repository
locks and deletes only a `google_business_reviews` row whose `data_origin = 'mock'`, deletes its
linked `external_feedback` row, relies on foreign-key cascade for media, and then removes stored
photo files. It never deletes or edits a remote provider review.

Source: [review.routes.ts](../Backend/src/routes/review.routes.ts),
[review.controller.ts](../Backend/src/controllers/review.controller.ts),
[review.service.ts](../Backend/src/services/review.service.ts), and
[review.repository.ts](../Backend/src/repositories/review.repository.ts).

## Employee admin flow

The backend mounts the admin router at `/api/admin/google-reviews`. Every route first requires an
employee session. The controller then converts the reloaded `req.user` into an actor containing
only `{ id, role }`; roles other than `manager` and `staff` are rejected with 403.

### Load the admin list

The request is:

```text
GET /api/admin/google-reviews?placeSlug=PetHouse
```

The execution order is:

1. `requireEmployee` verifies `wagstay_session`, reloads the current user from PostgreSQL, and
   rejects non-employees with 403.
2. `adminGoogleReviewQuerySchema` validates `placeSlug`.
3. `getAdminGoogleReviewActor()` passes the authenticated UUID and `employee_role` to the service.
4. `getAdminGoogleReviews()` calls `findAdminGoogleBusinessReviews(placeSlug, actor)`.
5. The repository resolves the configured Google location, joins `external_feedback`, joins the
   unique reviewer identity projection, and aggregates review media.
6. For Staff only, the query adds:

```sql
AND external.assigned_employee_uuid = $2::uuid
```

`$2` is `actor.id`, which came from the authenticated session rather than from a query parameter.
The service then parses `external_feedback.ai_insights` against the strict AI contract and maps
snake_case database fields into `AdminGoogleReview`. The controller returns
`{ code: 200, msg: 'Google reviews loaded', data: { reviews } }`.

The employee projection includes reviewer email, AI summary, triage type/confidence, read state,
workflow status, and current assignee. Those fields remain outside the public response.

### Frontend list and presentation

`/admin/*` is protected by `AccountRoute identity="employee"`. `AdminPortal` hydrates the current
employee profile before selecting one of two route arrays. Both arrays include the Google review
detail route, but only the Manager route array includes `/admin/team`.

`AdminFeedbackPage` owns the shared source tabs and filter state. For the Google source it passes
`canAssignGoogleReviews` to `GoogleReviewsPanel`:

- Manager: `canAssignGoogleReviews` is true.
- Staff: `canAssignGoogleReviews` is false.

`GoogleReviewsPanel` loads the employee projection through `useGoogleReviewStore`. It then applies
these client-side presentation filters to the already server-scoped rows:

| Filter      | Current implementation                                                                      |
| ----------- | ------------------------------------------------------------------------------------------- |
| Search      | Reviewer name, raw review text, or AI summary, case-insensitive                             |
| Type        | `triageType` compared with Issue/Praise/Suggestion                                          |
| Status      | `ownerReply` determines Unreplied/Replied; this is not based on `external_feedback.is_read` |
| Rating      | Inclusive `ratingMin` and `ratingMax`                                                       |
| Custom time | Inclusive calendar-day range based on `createdAt`                                           |
| Sort        | Newest, oldest, highest rating, or lowest rating                                            |

These filters do not change the API request and do not widen the Staff dataset.

In table mode, `GoogleReviewsPanel` renders `FeedbackBulkActionBar` only when the actor is allowed
to assign. `FeedbackTable` renders row checkboxes only when `selectionMode` is true. Google review
table mode also renders the review `Content` in a bounded vertical-scroll cell. Manager rows render
an editable Type control and the Assignee column; Staff rows render a read-only Type tag and omit
the Assignee column. Every unreplied Google review exposes a Quick reply action, regardless of
whether it is classified as Praise, Issue, Suggestion, or unclassified; replied reviews do not.
Clicking Quick reply opens the editor in a floating modal/dialog rather than inline in the table
Action cell. In card mode, the panel renders `GoogleReviewCard` and does not render the assignment bar.

### Manager Type decision

The Manager action is:

```text
PATCH /api/admin/google-reviews/:id/type

{ "triageType": "issue" | "praise" | "suggestion" }
```

The route requires an employee session, the Manager role, and a trusted origin. The controller
validates the review UUID and the allowlisted Type. The repository locks the review and its linked
`external_feedback` row, then overwrites only the existing `triageType` key inside
`external_feedback.ai_insights`. The previous Type is not stored separately, no new schema object
is introduced, and unrelated AI insight keys are not rewritten. The service reads the complete
admin projection back before committing and publishes an admin-only `triage_updated` event after a
successful commit.

The Manager must make a Type decision before assigning a review to Staff. A selected review whose
effective Type is not one of `issue`, `praise`, or `suggestion` causes the whole assignment
transaction to roll back with `GOOGLE_REVIEW_TRIAGE_REQUIRED` and HTTP 409.

### Manager assignment

The Manager action is:

```text
PATCH /api/admin/google-reviews/assignee

{
  "reviewUuids": ["google_business_reviews.uuid", "..."],
  "assigneeId": "employees.users_uuid"
}
```

The route requires `requireManager` and `requireTrustedOrigin`. The schema requires at least one
UUID and a UUID-shaped assignee. The service deduplicates review UUIDs and the repository executes
one transaction:

1. Lock-check that `assigneeId` exists in `employees`.
2. Lock-check every selected review in `google_business_reviews`.
3. Lock-check that every selected review has an effective Type.
4. Roll back without changes if any selected review is missing or undecided.
5. Upsert one `external_feedback` row per review using the unique
   `google_business_review_uuid` key.
6. Set `assigned_employee_uuid`, `assigned_at`, and `updated_at`.
7. Commit and return `{ updatedUuids, assigneeId }`.

Assignment does not change the Google review comment, rating, public owner reply,
`external_feedback.is_read`, `external_feedback.current_status`, or `external_feedback.ai_insights`.
The operation is not a Google provider write.

After success, the Frontend updates only the selected rows in the local Zustand projection, clears
selection, and calls `publishGoogleReviewsUpdated()`. Other mounted admin contexts receive the
window/BroadcastChannel event and call `loadGoogleReviewPage(true)`.

### Staff reply ownership

The reply request is:

```text
POST /api/admin/google-reviews/:id/reply

{ "replyBody": "..." }
```

The route requires an employee and a trusted origin. The controller validates the UUID and trims
the body. The repository begins a transaction and locks the matching review query. For Staff, the
same query includes the assignment predicate. It therefore cannot distinguish these cases through
the response:

- UUID does not exist;
- review has no `external_feedback` assignment;
- review is assigned to another employee.

All three return the service error `GOOGLE_REVIEW_NOT_FOUND` with HTTP 404.

If the row is visible to the actor, the repository then checks:

- `data_origin` must be `'mock'`; live rows return `GOOGLE_REVIEW_REPLY_NOT_SUPPORTED` (409).
- The unique reviewer identity join must produce a non-empty email; otherwise the result is
  `GOOGLE_REVIEW_RECIPIENT_UNAVAILABLE` (422).

For a supported mock review, the transaction creates the `external_feedback` workflow row when
needed, inserts an `external_feedback_replies` row with the authenticated employee, reply body,
`reply_status = 'sent'`, and `sent_at`, then reads the admin projection back and commits. It does
not send an email or call Google. The detail page publishes the same update event after the API
call succeeds.

## Data ownership

The SQL contract is defined in
[google-feedback-and-reviews-schema.sql](../Backend/src/data/migrations/google-feedback-and-reviews-schema.sql):

| Table                       | Current responsibility                                                                                                        |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `google_business_locations` | Facility-linked location identity and aggregate location display fields                                                       |
| `google_business_reviews`   | Review identity, reviewer display fields, rating/comment, provider-shaped timestamps, and `data_origin`                       |
| `external_feedback`         | One-to-one admin workflow projection: `is_read`, `current_status`, `assigned_employee_uuid`, `assigned_at`, and `ai_insights` |
| `external_feedback_replies` | App-owned employee reply records linked to `external_feedback`, including body, status, actor, and `sent_at`                  |
| `google_review_media_logs`  | Review photo URLs keyed by `google_business_reviews_uuid` and `created_at`                                                    |
| `reviewer_identities`       | Public reviewer identity and the unique-name email lookup used by the mock reply path                                         |

The current synthetic seed migrations create Google review rows and external feedback rows with
`current_status = 'received'`, `is_read = false`, AI JSON in the strict shape, and no assignment.
They are fixtures, not a provider sync job.

## Failure and status matrix

| Condition                                           | Boundary                      | Result                                                       |
| --------------------------------------------------- | ----------------------------- | ------------------------------------------------------------ |
| Missing/invalid employee session                    | `requireEmployee`             | 401                                                          |
| Authenticated user is not an employee               | `requireEmployee`             | 403 `FORBIDDEN`                                              |
| Employee role is neither Manager nor Staff          | `getAdminGoogleReviewActor()` | 403 `FORBIDDEN`                                              |
| Staff calls assignment route                        | `requireManager`              | 403 `FORBIDDEN`                                              |
| Mutation has an untrusted origin                    | `requireTrustedOrigin`        | 403 `UNTRUSTED_ORIGIN`                                       |
| Invalid query/body/UUID                             | Zod schemas                   | 400 `VALIDATION_FAILED`                                      |
| Unsupported place or missing location               | admin/public service          | 404                                                          |
| Assignment target is not an employee                | assignment service            | 400 `INVALID_ASSIGNEE`                                       |
| Selected review does not exist during assignment    | assignment service            | 404 `GOOGLE_REVIEW_NOT_FOUND`, transaction rolled back       |
| Staff calls the Type mutation route                 | `requireManager`              | 403 `FORBIDDEN`                                              |
| Type mutation contains an invalid value             | Zod schema                    | 400 `VALIDATION_FAILED`                                      |
| Selected review has no valid Type during assignment | assignment service            | 409 `GOOGLE_REVIEW_TRIAGE_REQUIRED`, transaction rolled back |
| Type mutation finds invalid/missing AI JSON         | triage service/repository     | 409 `INVALID_GOOGLE_REVIEW_DATA`                             |
| Staff reads/replies outside assignment scope        | repository query              | List omission or reply 404                                   |
| Mock reply targets a live review                    | reply service                 | 409 `GOOGLE_REVIEW_REPLY_NOT_SUPPORTED`                      |
| Reviewer email cannot be resolved uniquely          | reply service                 | 422 `GOOGLE_REVIEW_RECIPIENT_UNAVAILABLE`                    |
| Database failure during admin read/reply/assignment | service catch boundary        | 503 without database details                                 |
| Persisted AI JSON violates the contract             | `parseAiInsights()`           | 500 `INVALID_GOOGLE_REVIEW_AI_INSIGHTS`                      |

## Relevant tests

The behavior is covered at separate boundaries rather than by one UI assertion:

- Backend route tests cover employee authentication, Manager-only Type mutation and assignment,
  trusted origin, input validation, actor propagation, and reply responses in
  [admin.google.review.api.test.ts](../Backend/src/__tests__/admin.google.review.api.test.ts).
- Repository tests cover the Manager/Staff list predicate, direct Type replacement, assignment
  prerequisite, atomic assignment upsert and rollback, staff reply scope, mock/live reply boundary,
  and missing location in
  [admin.google.review.repository.test.ts](../Backend/src/__tests__/admin.google.review.repository.test.ts).
- Service tests cover mapping, default workflow fields, Type mutation, invalid AI JSON, assignment
  errors, and reply outcomes in
  [admin.google.review.service.test.ts](../Backend/src/__tests__/admin.google.review.service.test.ts).
- PostgreSQL API tests exercise Manager/Staff list visibility, unauthorized reply 404, assignment
  persistence, rollback-preserving state, and live reply rejection in
  [api.postgres.admin-google-review.test.ts](../Backend/src/__tests__/api.postgres.admin-google-review.test.ts).
- Frontend tests cover API parsing, store hydration/update events, Manager/Staff control visibility,
  Content scrolling, Type editing, Quick reply, assignment projection updates, card/table behavior,
  and detail-page store routing in the
  corresponding `Frontend/src/features/admin/**/__tests__/` files.

## Source map

- Backend mount: [server.ts](../Backend/src/server.ts)
- Public routes: [review.routes.ts](../Backend/src/routes/review.routes.ts)
- Public controller/service/repository: [review.controller.ts](../Backend/src/controllers/review.controller.ts), [review.service.ts](../Backend/src/services/review.service.ts), [review.repository.ts](../Backend/src/repositories/review.repository.ts)
- Admin route/controller/service/repository: [admin.google.review.routes.ts](../Backend/src/routes/admin.google.review.routes.ts), [admin.google.review.controller.ts](../Backend/src/controllers/admin.google.review.controller.ts), [admin.google.review.service.ts](../Backend/src/services/admin.google.review.service.ts), [admin.google.review.repository.ts](../Backend/src/repositories/admin.google.review.repository.ts)
- Admin Frontend route and page: [AdminPortal.tsx](../Frontend/src/features/admin/components/AdminPortal.tsx), [AdminFeedbackPage.tsx](../Frontend/src/features/admin/pages/AdminFeedbackPage.tsx), [GoogleReviewsPanel.tsx](../Frontend/src/features/admin/components/feedback/GoogleReviewsPanel.tsx), [AdminGoogleReviewDetailPage.tsx](../Frontend/src/features/admin/pages/AdminGoogleReviewDetailPage.tsx)
- Frontend state/API/events: [googleReviewStore.ts](../Frontend/src/features/admin/store/googleReviewStore.ts), [googleReviewsApi.ts](../Frontend/src/features/admin/api/googleReviewsApi.ts), [googleReviewEvents.ts](../Frontend/src/shared/events/googleReviewEvents.ts)
- Schema: [google-feedback-and-reviews-schema.sql](../Backend/src/data/migrations/google-feedback-and-reviews-schema.sql)

Evidence status: Confirmed from current source and tests unless a section is explicitly marked as a current gap or fixture boundary.
