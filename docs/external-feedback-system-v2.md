# External Feedback System: Code-Level Trace

> Historical design note. Google Review AI summaries and investigation described in this document
> were retired on 2026-09-28. See [the removal record](google-review-ai-removal-plan.md) for current
> behavior.

This is an implementation trace for the Google-shaped external feedback system as it existed when
the document was written. It is based on the route, controller, service, repository, Frontend, SQL,
and test code from that time. The
document distinguishes the public reviewer path from the employee admin path and records the
authorization boundary at the layer where the code enforces it.

## 1. Runtime entry points

The Backend mounts these routes in `server.ts`:

| Mounted path                | Router                                          | Purpose                                                         |
| --------------------------- | ----------------------------------------------- | --------------------------------------------------------------- |
| `/api/review-auth`          | `reviewer-auth.routes.ts`                       | Public Google reviewer session                                  |
| `/api/google-reviews`       | `review.routes.ts`                              | Public Google-shaped review read/write and development deletion |
| `/api/reviews/simulator`    | `reviewSimulatorRoutes` from `review.routes.ts` | Secret-protected `place_reviews` simulator path                 |
| `/api/admin/google-reviews` | `admin.google.review.routes.ts`                 | Employee admin projection, assignment, and mock reply           |

The public and admin paths do not share the same response model:

```text
Public page       -> PublicReviewPage
Employee admin    -> AdminGoogleReviewPage
Simulator         -> PublicReview written to place_reviews
```

`place_reviews` is not queried by the admin Google review repository. The admin path queries
`google_business_reviews` and its related tables.

## 2. Public reviewer authentication

### `POST /api/review-auth/google`

Execution order:

1. `requireTrustedOrigin` checks the request origin.
2. `googleReviewerLogin` requires a non-empty `authorizationCode`.
3. The controller reads `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and the request `origin` as
   the redirect URI. Missing configuration returns 500.
4. `ReviewerService.authenticateWithGoogleCode()` exchanges the code for an ID token.
5. `ReviewerService.authenticateWithGoogle()` verifies the token and requires a provider subject,
   email, and `email_verified === true`.
6. The verified identity is upserted into `reviewer_identities` with `provider = 'google'`.
7. The service returns only `{ id, displayName, avatarUrl }` as the reviewer profile.
8. The controller signs `maps_reviewer_session`, sets it as an HttpOnly SameSite Lax cookie, and
   returns `{ code: 200, data: { reviewer } }`.

`GET /api/review-auth/me` requires `maps_reviewer_session`, verifies its signed claims, and returns
the sanitized reviewer profile. `POST /api/review-auth/logout` clears only this reviewer cookie.

Sources: [reviewer-auth.routes.ts](../Backend/src/routes/reviewer-auth.routes.ts),
[reviewer-auth.controller.ts](../Backend/src/controllers/reviewer-auth.controller.ts),
[reviewer.middleware.ts](../Backend/src/common/middlewares/reviewer.middleware.ts),
[reviewer.service.ts](../Backend/src/services/reviewer.service.ts), and
[reviewer.session.ts](../Backend/src/services/reviewer.session.ts).

## 3. Public Google-shaped page

### `GET /api/google-reviews?placeSlug=PetHouse`

`attachReviewerIfPresent` runs before the controller. Unlike `requireReviewer` it never rejects:
it attaches a reviewer when a valid `maps_reviewer_session` cookie is present and otherwise leaves
the request anonymous, so the page stays readable while signed out. An expired or tampered cookie
is treated as signed out rather than as an error.

The controller validates `placeSlug` and calls `ReviewService.getGoogleReviewPage()` with
`req.reviewer?.id ?? null`. `findGoogleBusinessReviewPage()` then:

1. Maps the slug through `GOOGLE_LOCATION_ID_BY_PLACE_SLUG`. The current map contains only
   `pethouse -> mock-pethouse-location`.
2. Reads one `google_business_locations` row.
3. Reads every `google_business_reviews` row for the location, with review media from
   `google_review_media_logs`.
4. Reads each review's like total as a `COUNT` over `google_review_likes`, and whether the
   requesting reviewer is among them as an `EXISTS`. A null reviewer makes that `EXISTS` false,
   so an anonymous visitor still receives every like count.
5. Orders reviews by `google_created_at DESC`, `created_at DESC`, and `uuid DESC`.
6. Returns `null` for an unsupported slug or a missing configured location; the controller maps
   that result to 404.

`toPublicReviewPage()` computes the display projection:

- `averageRating` uses the stored `aggregate_rating` when present; otherwise it averages the loaded
  review rows.
- `totalReviews` uses `user_rating_count` when it is greater than zero; otherwise it uses the
  number of loaded rows.
- `ratingBreakdown` counts the loaded rows for five, four, three, two, and one star.
- Anonymous reviewers receive the display name `Anonymous reviewer` and no avatar URL.
- Non-anonymous reviewers use the stored display name or the fallback `Google reviewer`.
- `likeCount` is the total across every reviewer and `viewerHasLiked` is per request; the latter
  is always false for an anonymous visitor.

The public response does not include admin-only AI, read, workflow, or assignment fields.

### `POST /api/google-reviews`

This is the app-owned human review creation path, not a remote Google review publication path.

```text
requireReviewer
  -> requireTrustedOrigin
  -> reviewPhotoUpload.array('photos', 9)
  -> parseReviewSubmissionPayload
  -> ReviewService.createHumanReview
```

`ReviewService.createHumanReview()` performs these steps:

1. Generates one structured Google review AI result from `rating` and `reviewText`.
2. Converts uploaded files into stored photo URLs.
3. Calls `createGoogleBusinessReviewRecord()` with the reviewer identity, display fields, place,
   rating, text, photo URLs, and AI result.
4. Inside one database transaction, inserts the review row, media rows, and linked
   `external_feedback.ai_insights`.
5. Returns a `PublicReview` object with the new review ID, reviewer ID, place slug, rating, text,
   `source = 'human'`, `serviceUserMatchStatus = 'pending'`, and `createdAt`.
6. If the database operation fails after files were stored, removes those files before rethrowing.

The new `external_feedback` row relies on database defaults for `is_read = false`,
`current_status = 'received'`, and a null `assigned_employee_uuid`.

### `PUT /api/google-reviews/:id/like` and `DELETE /api/google-reviews/:id/like`

```text
requireReviewer
  -> requireTrustedOrigin
  -> googleReviewLikeReviewIdSchema.parse(req.params.id)
  -> ReviewService.setReviewLike
```

The like is attributed to the reviewer resolved from the `maps_reviewer_session` cookie. No
request body is read and no reviewer identifier is accepted from the client, so a caller cannot
record a like as another Google account. A signed-out request is rejected by `requireReviewer`
before the controller runs.

`PUT` stores the like and `DELETE` removes it. Both verbs are idempotent, which matches the
repository behavior: `setGoogleReviewLike()` opens one transaction and then

1. Loads the review by UUID, rolling back and returning `null` when it does not exist. The service
   maps that to 404.
2. Inserts with `ON CONFLICT (google_business_review_uuid, reviewer_uuid) DO NOTHING` for a like,
   or deletes the `(review, reviewer)` row for an unlike.
3. Reads the resulting `likeCount` and `viewerHasLiked` inside the same transaction, so the
   returned count already includes this change and the caller needs no second request.

Repeating a like is therefore not an error and does not inflate the count. The unique constraint,
not the application code, is what enforces one like per reviewer per review.

### `POST /api/reviews/simulator`

The simulator uses a different contract. `requireReviewSimulatorSecret()` compares the
`X-Review-Simulator-Secret` header to `REVIEW_SIMULATOR_SECRET` with `timingSafeEqual`. The service
upserts a simulator reviewer and calls `createReviewRecord()`, whose SQL inserts into
`place_reviews`. It does not create `google_business_reviews`, `external_feedback`, or review media
rows.

### `DELETE /api/google-reviews/:id`

This route is available only when `NODE_ENV !== 'production'` and the origin is trusted. The
repository transaction:

1. Locks a review by UUID and requires `data_origin = 'mock'`.
2. Reads its media URLs.
3. Deletes the linked `external_feedback` row.
4. Deletes the mock `google_business_reviews` row.
5. Commits and then removes the stored photo files.

An absent or non-mock review is mapped to 404. No remote provider resource is touched.

## 4. Admin list request

### Route and controller

`admin.google.review.routes.ts` applies `router.use(requireEmployee)` to every admin Google review
route. The list route then calls `getAdminGoogleReviewList()`.

The controller validates `placeSlug` with `adminGoogleReviewQuerySchema`. It creates the actor from
the reloaded session:

```text
req.user.is_employee === true
req.user.employee_role === 'manager' | 'staff'
        -> { id: req.user.id, role: req.user.employee_role }
```

An employee with a missing or unsupported `employee_role` is rejected with 403 by
`getAdminGoogleReviewActor()`.

### Service and repository

`getAdminGoogleReviews(placeSlug, actor)` calls
`findAdminGoogleBusinessReviews(placeSlug, actor)`.

The repository first resolves the place slug and the `google_business_locations.uuid`. It then
selects:

```text
google_business_reviews
  + unique reviewer email from reviewer_identities
  + aggregated review photo URLs from google_review_media_logs
  + ai_insights, is_read, current_status, assigned_employee_uuid
    from external_feedback
```

The query is role-scoped in SQL:

```sql
WHERE review.google_business_location_uuid = $1::uuid
  -- only for Staff:
  AND external.assigned_employee_uuid = $2::uuid
```

For Manager, `$1` is the location UUID and there is no assignment predicate. For Staff, `$1` is the
location UUID and `$2` is the authenticated user UUID. The browser cannot choose the Staff scope by
sending a different user ID.

### Service projection

`mapAdminGoogleReview()` converts database values to the Frontend contract:

| Database value                              | Admin field                                      |
| ------------------------------------------- | ------------------------------------------------ |
| `review.uuid`                               | `id`                                             |
| `reviewer_display_name` / anonymous flag    | `reviewerName`                                   |
| Unique reviewer identity email              | `reviewerEmail`                                  |
| Rating/comment/provider timestamps          | `rating`, `reviewText`, `createdAt`, `updatedAt` |
| Latest sent `external_feedback_replies` row | `ownerReply`, `ownerReplyUpdatedAt`              |
| Validated `external.ai_insights.summary`    | `aiSummary`                                      |
| Validated `triageType`, `triageConfidence`  | matching admin fields                            |
| `external.is_read` or false                 | `isRead`                                         |
| `external.current_status` or `received`     | `currentStatus`                                  |
| `external.assigned_employee_uuid` or null   | `assignedEmployeeUuid`                           |

If `external.ai_insights` exists but fails `googleReviewAiInsightsSchema`, the service fails closed
with `INVALID_GOOGLE_REVIEW_AI_INSIGHTS` instead of inventing a display value.

## 5. Frontend admin list

`App.tsx` protects `/admin/*` with `AccountRoute identity="employee"`. `AdminPortal` hydrates the
current staff record before selecting the Manager or Staff route array.

Both route arrays include:

```text
/admin/feedback
/admin/google-reviews/:id
```

Only the Manager route array includes `/admin/team`.

`AdminFeedbackPage` owns source tabs and shared filters. It calculates:

```text
canAssignGoogleReviews = useAuthStore.user.employee_role === 'manager'
```

For the Google source, `GoogleReviewsPanel` reads the employee-scoped page from
`useGoogleReviewStore`. The panel applies local presentation filters only after the server has
already decided which rows the employee may receive:

```text
rawReviews
  -> search reviewerName/reviewText/aiSummary
  -> triageType filter
  -> ownerReply-based unreplied/replied filter
  -> rating range
  -> inclusive custom date range
  -> sort
  -> Card or Table projection
```

In Table mode:

- `FeedbackBulkActionBar` is rendered only when `canAssignGoogleReviews` is true.
- `FeedbackTable` receives `selectionMode = false` for Staff, so it renders no checkboxes.
- The Assign select is therefore absent for Staff, not merely disabled.

In Card mode, `GoogleReviewCard` is rendered without the bulk assignment bar for either role.

## 6. Assignment request

### Request contract

```text
PATCH /api/admin/google-reviews/assignee

{
  "reviewUuids": ["google_business_reviews.uuid", "..."],
  "assigneeId": "employees.users_uuid"
}
```

The route order is:

```text
requireEmployee
  -> requireManager
  -> requireTrustedOrigin
  -> adminGoogleReviewAssigneeSchema
  -> assignGoogleReviews
  -> assignGoogleReviewRecords
```

### Transaction behavior

`assignGoogleReviews()` deduplicates `reviewUuids` before entering the repository. The repository
transaction then:

1. Locks an employee row matching `assigneeId` with `FOR SHARE`.
2. Locks all selected review rows with `FOR UPDATE`.
3. Computes missing UUIDs. Any missing UUID causes rollback and no assignments are written.
4. Uses `INSERT INTO external_feedback ... ON CONFLICT (google_business_review_uuid)`.
5. Updates `assigned_employee_uuid`, `assigned_at`, and `updated_at` for every selected review.
6. Checks the returned row count, commits, and returns `updatedUuids` and `assigneeId`.

The database does not impose a Staff-only target role in this function. A valid employee UUID can be
the assignee. The Manager-only rule applies to the actor making the mutation, not to the target
employee's `staff_role`.

### Frontend mutation and synchronisation

After the API succeeds, `GoogleReviewsPanel` updates only matching IDs in the local store, clears
selection, and publishes `GOOGLE_REVIEW_UPDATED_EVENT`. `useGoogleReviewStoreSync()` listens to the
same-runtime event and the BroadcastChannel message, then calls `loadGoogleReviewPage(true)`.

The state transition is:

```text
Manager selects rows
  -> PATCH assignment
  -> PostgreSQL external_feedback update
  -> local selected-row projection update
  -> clear selection
  -> same-tab/other-tab reload event
```

Assignment does not change the review text, rating, AI JSON, `is_read`, `current_status`, or owner
reply.

## 7. Reply request

### Request contract and actor scope

```text
POST /api/admin/google-reviews/:id/reply

{ "replyBody": "..." }
```

The controller validates the UUID and trims a non-empty `replyBody`. The route requires an employee
and a trusted origin, but it is not Manager-only.

The repository's initial transaction query joins `external_feedback` and applies this condition for
Staff:

```sql
WHERE review.uuid = $1::uuid
  AND external.assigned_employee_uuid = $2::uuid
FOR UPDATE OF review
```

If the query returns no row, the result is `not_found`. The service maps that to 404
`GOOGLE_REVIEW_NOT_FOUND`. This intentionally gives the same response for a missing, unassigned, or
other-employee review.

### Mock-only persistence

For a visible row, the repository checks:

1. `data_origin` is `'mock'`.
2. The unique reviewer identity join returns a non-empty email.
3. The transaction creates the `external_feedback` row when needed and inserts an
   `external_feedback_replies` row with the authenticated employee, body, `reply_status = 'sent'`,
   and `sent_at`.
4. The transaction reads the admin projection back and commits.

The service maps these outcomes:

| Repository outcome        | HTTP result                               |
| ------------------------- | ----------------------------------------- |
| `not_found`               | 404 `GOOGLE_REVIEW_NOT_FOUND`             |
| `not_mock`                | 409 `GOOGLE_REVIEW_REPLY_NOT_SUPPORTED`   |
| `recipient_unavailable`   | 422 `GOOGLE_REVIEW_RECIPIENT_UNAVAILABLE` |
| Updated projection        | 200                                       |
| Unexpected database error | 503 `GOOGLE_REVIEW_REPLY_UNAVAILABLE`     |

The current implementation writes the app-owned `external_feedback_replies` row. It does not send a
real email or call Google.

## 8. Detail route behavior and known gap

The Frontend route `/admin/google-reviews/:id` is present for both roles, but
`AdminGoogleReviewDetailPage` does not call a detail API. It selects the ID from the already-loaded
`useGoogleReviewStore` page.

Current behavior when the ID is absent from that page:

```text
status = ready && review is missing
  -> navigate('/admin/feedback?source=google-reviews&view=card', { replace: true })
```

Therefore:

- Staff list visibility is server-enforced.
- Staff reply scope is server-enforced and returns 404 outside the assignment.
- A direct Staff detail URL is not currently an HTTP 404 detail read; it is a Frontend redirect.
- There is no `GET /api/admin/google-reviews/:id` route in the current code.

This is the exact current gap against the desired rule “Staff directly opening another review detail
returns 404”. It must remain labelled as a gap until code changes and a direct-detail test exist.

## 9. Persistence schema

The relevant tables are defined in
[google-feedback-and-reviews-schema.sql](../Backend/src/data/migrations/google-feedback-and-reviews-schema.sql):

```text
google_business_locations
  -> google_business_reviews
       -> google_review_media_logs
       -> google_review_likes <- reviewer_identities
       -> external_feedback
            -> external_feedback_replies
```

`google_review_likes` is added by
[20260908_add_google_review_likes.sql](../Backend/src/data/migrations/20260908_add_google_review_likes.sql).

Important constraints:

- `google_business_reviews.uuid` is the review primary key.
- `google_business_reviews.data_origin` is restricted to `mock` or `live`.
- `external_feedback.google_business_review_uuid` is unique, so one review has one current external
  workflow row.
- `external_feedback.assigned_employee_uuid` references `employees(users_uuid)` and uses
  `ON DELETE SET NULL`.
- `external_feedback_replies` supports `draft`, `sent`, and `failed`; the admin reply repository
  persists the authenticated employee's sent reply there.
- `google_review_media_logs` uses `(google_business_reviews_uuid, created_at)` as its primary key.
- `google_review_likes` is unique on `(google_business_review_uuid, reviewer_uuid)`. One row means
  the reviewer currently likes the review, and unliking deletes the row, so the displayed total is
  always a live `COUNT` rather than a stored counter that could drift.
- `google_review_likes` has no separate index on `google_business_review_uuid`: the unique
  constraint already builds a composite index led by that column. `reviewer_uuid` carries its own
  index because it is the trailing column of that composite index.
- Both `google_review_likes` foreign keys use `ON DELETE CASCADE`, so deleting a review or a
  reviewer identity clears the related likes without any application code.

The two current synthetic seed migrations create mock review rows, media rows, and AI-backed
`external_feedback` rows. They do not assign those rows to Staff; assignments are a separate
Manager action.

## 10. Test-to-contract map

| Contract                                                             | Test source                                                                                                              |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Employee and Manager route gates                                     | `Backend/src/__tests__/admin.google.review.api.test.ts`                                                                  |
| Role actor propagation                                               | `Backend/src/__tests__/admin.google.review.api.test.ts` and `admin.google.review.service.test.ts`                        |
| Staff list SQL predicate                                             | `Backend/src/__tests__/admin.google.review.repository.test.ts`                                                           |
| Assignment deduplication, target validation, rollback, and upsert    | `Backend/src/__tests__/admin.google.review.repository.test.ts` and `api.postgres.admin-google-review.test.ts`            |
| Staff reply outside assignment scope                                 | `Backend/src/__tests__/admin.google.review.repository.test.ts` and `api.postgres.admin-google-review.test.ts`            |
| AI projection mapping and invalid JSON failure                       | `Backend/src/__tests__/admin.google.review.service.test.ts`                                                              |
| Frontend role-based selection/assignment UI                          | `Frontend/src/features/admin/components/feedback/__tests__/GoogleReviewsPanel.test.tsx` and `AdminFeedbackPage.test.tsx` |
| Store hydration and update-event reload                              | `Frontend/src/features/admin/store/__tests__/googleReviewStore.test.ts`                                                  |
| Public/admin API parsing                                             | `Frontend/src/features/admin/api/__tests__/googleReviewsApi.test.ts`                                                     |
| Existing store-based detail behavior                                 | `Frontend/src/features/admin/pages/__tests__/AdminGoogleReviewDetailPage.test.tsx`                                       |
| Like toggle transaction, repeat-like absorption, and missing review  | `Backend/src/__tests__/review.like.repository.test.ts`                                                                   |
| Like route reviewer gate, UUID validation, and 404 mapping           | `Backend/src/__tests__/review.api.test.ts`                                                                               |
| Like state projection and anonymous page load                        | `Backend/src/__tests__/review.service.test.ts`                                                                           |
| Signed-out like routed to sign-in, toggle, rollback, expired session | `Frontend/src/features/maps-review/pages/__tests__/PetHouseReviewPage.likes.test.tsx`                                    |

Evidence status: Confirmed from current source and tests unless explicitly marked as the direct-detail gap or a fixture-only boundary.

## 11. Manager Google Review Operations Dashboard

The manager-only overview lives at `/admin/operation` under the Feedback Overview section. It is
separate from the record-level table at `/admin/feedback` and does not duplicate that table.

### Runtime entry point

```text
GET /api/admin/google-reviews/dashboard?placeSlug=PetHouse
GET /api/admin/google-reviews/dashboard?placeSlug=PetHouse&from=YYYY-MM-DD&to=YYYY-MM-DD
GET /api/admin/google-reviews/dashboard-summary?placeSlug=PetHouse
```

The route requires an authenticated employee and a Manager role. The current dashboard is fixed to
the server-owned `PetHouse` location mapping. Staff are redirected away from the Frontend route and
are rejected by the dashboard API. Existing record-level Google Review APIs retain their separate
role-scoped behavior.

### Data and metric rules

The repository reads one row per active `google_business_reviews.uuid`, left-joins the optional
`external_feedback` row, and projects the latest successful product-owned reply from
`external_feedback_replies`. Reviews with `source_deleted_at IS NOT NULL` are excluded from the
current dashboard.

```text
Successful reply = reply_status = 'sent' AND sent_at IS NOT NULL
Pending reply    = no successful reply
```

Current metrics use two scopes:

- Manager Attention and Response Health use all active pending reviews, so an old overdue review
  cannot disappear when an analytics date filter changes.
- Average rating, Feedback Mix, and Feedback Flow use the selected period based on
  `google_created_at`, with `periodStart` inclusive and `periodEnd` exclusive in
  `Pacific/Auckland` time.

Manager Attention is calculated as:

```text
Issues need review    = triageType = 'issue' AND no successful reply
Overdue replies       = no successful reply AND age >= 24 hours
Approaching threshold = no successful reply AND 12 <= age < 24 hours
```

Response Health uses `now - google_created_at` for pending reviews and assigns each review to one
exclusive bucket: under `4h`, `4h` to under `12h`, `12h` to under `24h`, or `24h+`. The user-facing
labels are `Safe`, `Monitor`, `Reply soon`, and `Overdue`; the threshold starts the next bucket at
4h, 12h, and 24h. Feedback Mix maps valid triage types to Issue, Suggestion, or Praise; a null
triage type remains Unclassified and is included in the percentage denominator. It must not be
mapped to Praise.

Feedback Mix percentages are displayed to one decimal place. For non-empty segments, a deterministic
largest-remainder allocation keeps the displayed percentages at a `100.0%` total while counts remain
the source of truth.

Average rating is calculated from the selected-period review rows, not from the location's
all-time `aggregate_rating`:

```text
average rating = SUM(selected-period rating) / COUNT(selected-period reviews)
```

Feedback Flow groups received reviews by `google_created_at` half-month and replied reviews by
distinct successful `sent_at` half-month. Each calendar month is split into `1-15` and `16-end`
points. The default view covers the last 12 calendar months at half-month granularity and preserves
zero-value half-months after the first active bucket. Current outstanding count is not derived by
subtracting period received and replied counts.

### AI summary bundle

The manager dashboard also requests one source-revision-keyed summary bundle through:

```text
GET /api/admin/google-reviews/dashboard-summary?placeSlug=PetHouse
```

The Backend reads the app-owned dashboard review projection once, resolves the three existing
`Pacific/Auckland` windows, and passes all three datasets to the existing
`google-review-investigation-agent` package. The agent makes one configured QWEN request with at most
one bounded retry after structured-output rejection, then preserves the existing error state after a
second rejection. It returns one independent summary string for each of `last_7_days`,
`last_30_days`, and `last_12_months`.

Each string contains two or three complete sentences. Each period is summarized independently;
the summaries do not compare periods or produce actions, themes, evidence lists, or public reply
text. Review text is treated as untrusted input, and the summary mode has no identity, stay, or
Evidence Check tools.

The Frontend stores the complete bundle in the existing `googleReviewStore`. Period switching only
selects a string from that bundle and does not call the agent again. The store invalidates the
bundle only for `created`, `deleted`, or `triage_updated` Google Review events; `replied` does not
invalidate a review-content summary. A bundle is committed atomically, and a result created from an
older source revision cannot replace a newer store revision.

The agent package also provides a process-local shared QWEN scheduler. Review investigation calls
have priority over dashboard summary calls, and the scheduler allows at most one active model
request in the current process. This is not a cross-process or cross-container coordination
mechanism.

### Frontend projection

The Frontend uses a dedicated dashboard DTO and renders five overview regions:

1. Manager Attention cards that link directly to filtered Google Review work queues; signal counts
   may overlap.
2. AI Review Summary with the selected period's 2-3 sentence agent summary; the complete bundle is stored in the existing Zustand review store.
3. Feedback Mix with counts, percentages, and conditional Unclassified.
4. Response Health with labelled aging bands and pending counts.
5. Feedback Flow with half-month received and replied series plus period-level hover/focus details.

The Manager Attention card destinations are:

```text
Issues need review  -> /admin/feedback?source=google-reviews&status=unreplied&type=issue
Overdue replies     -> /admin/feedback?source=google-reviews&status=unreplied&age=overdue
Approaching         -> /admin/feedback?source=google-reviews&status=unreplied&age=approaching
```

The Google Reviews Feedback page parses these client-side filters and exposes the selected age
filter in the toolbar. The `Feedback Dashboard` action beside the table/card toggle opens
`/admin/operation`. The dashboard does not expose staff assignment, staff workload, Recently
Resolved records, raw review rows, or AI-generated theme data.

Feedback Flow tooltips identify the half-month and show the Received and Replied counts for that
period. Received is grouped by `google_created_at`; Replied is grouped by successful reply `sent_at`.

The current `data_origin`, `last_observed_at`, and `refreshed_at` values are returned as freshness
metadata. The manager-facing UI uses `refreshed_at` for `Last refreshed` and hides the label when it
is invalid; it does not display `Source freshness unavailable`. A successful dashboard request must
not be described as a live Google provider sync; the current PetHouse fixtures and reply path may be
mock-backed.

## 12. Public review sharing

Sharing a review is a Frontend-only capability. It adds no route, no controller, no service, and no
schema change, so nothing in sections 1 to 9 changes. Every review card on the public page carries a
Share action beside its Like button; the action opens a dialog holding the review's link, a copy
button, and four channel buttons.

### Link contract

`Frontend/src/features/maps-review/utils/shareLinks.ts` builds the link from the current page URL:

```text
<origin><path>?review=<review id>
```

Existing query parameters are dropped, because the sharer's search and sort state is not the
recipient's. The review id is the same public identifier the page already renders; the link carries
no session, cookie, or reviewer identity.

`PetHouseReviewPage` reads `?review=` through `useSearchParams`, scrolls the named review into view
once, and marks it with `maps-review-card--highlighted`. Each card renders `id="review-<review id>"`,
which is the element the link addresses. A background SSE refresh does not repeat the scroll. If the
named review is absent, filtered out by search, or the parameter is missing, no card is highlighted
and nothing scrolls.

### Channels

`Frontend/src/features/maps-review/components/shareChannels.tsx` declares Facebook, X, WhatsApp, and
email. Each button is an anchor to that network's own public compose endpoint; nothing is posted on
the visitor's behalf and no request reaches this system's Backend. The three web channels open in a
new tab; email does not, because a `mailto:` handler is taken over by the mail client and would
otherwise strand an empty tab. Every URL is percent-encoded at the boundary.

The dialog is modal in behaviour as well as in role: it takes focus on open, keeps Tab within itself,
and returns focus to the Share button on close. A copy is confirmed in a `role="status"` region; a
clipboard the browser refuses selects the link and reports the failure instead of confirming a copy
that did not happen. An anonymous review is shared as `A review of <place>` so the masked name is not
given a possessive.

### Test-to-contract map

| Contract                                                              | Test source                                                                     |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Link shape, clipboard write, blocked clipboard, per-review copy state | `Frontend/src/features/maps-review/components/__tests__/ShareDialog.test.tsx`   |
| Channel endpoints, new-tab policy, copy announcement                  | `Frontend/src/features/maps-review/components/__tests__/ShareDialog.test.tsx`   |
| Focus entry, Tab containment, focus return                            | `Frontend/src/features/maps-review/components/__tests__/ShareDialog.test.tsx`   |
| Share opens with the review's own deep link                           | `Frontend/src/features/maps-review/pages/__tests__/PetHouseReviewPage.test.tsx` |
| Shared link scrolls to and highlights only its review                 | `Frontend/src/features/maps-review/pages/__tests__/PetHouseReviewPage.test.tsx` |
| Anonymous review share title                                          | `Frontend/src/features/maps-review/pages/__tests__/PetHouseReviewPage.test.tsx` |

The values read back from the browser during the behaviour run are in `docs/reviews/share/README.md`.
Screenshots are in the pull request description rather than in the repository.
