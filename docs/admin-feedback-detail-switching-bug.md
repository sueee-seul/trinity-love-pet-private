# Admin Feedback Detail Switching Reload-Like Bug

Status: Resolved for detail switching and submitted-state display; target database migration applied on 2026-08-25
Severity: High (proposed; production-wide priority is not yet measured)
Scope: Admin feedback list/detail workflow

## Summary

Switching between feedback cards in the admin detail view causes the page to enter a full loading state. The detail content and the left feedback list do not finish loading together, so the screen briefly disappears, reappears with only the detail content, and then restores the sidebar.

This is an application-level reload-like failure. The evidence does not show a browser hard reload. It shows repeated route-scoped data fetching, component unmounting, and a second sidebar fetch during the same user action.

## Why this matters

This is a high-severity user-facing bug because it affects the main staff task: reviewing feedback records one after another.

| Impact area               | Current effect                                                                                             | Why it matters                                                               |
| ------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Review workflow           | The screen disappears while a staff member moves to the next record.                                       | Staff lose the continuous context needed for triage and comparison.          |
| Interaction feedback      | The right detail panel and left sidebar finish at different times.                                         | The UI looks unreliable and makes it unclear which record is active.         |
| Database and network work | A detail read runs for each selected UUID, and the sidebar can fetch the list again after it is remounted. | The interaction path carries avoidable latency and repeated database work.   |
| Data semantics            | The current detail GET also marks an unread feedback record as read.                                       | A preload or navigation read is coupled to an attention-state mutation.      |
| State ownership           | Detail data lives in page-local state and the current Zustand store only keeps assignments.                | List, sidebar, and detail cannot share one already-loaded feedback snapshot. |

There is no evidence in the reviewed recording or source that this bug corrupts feedback content or loses a progress event. The confirmed risk is repeated disruption, unnecessary reads, and an unintended read-state side effect.

## Observed behavior

The user-provided screen recording from 2026-08-25 shows this sequence:

1. The admin feedback table opens a detail record.
2. The main content is replaced by a full-page `Loading...` state.
3. The detail content appears while `Recent Feedback` still shows `Loading...`.
4. After the sidebar request finishes, the full detail layout appears.
5. Selecting another feedback card repeats the same broken sequence.

The behavior is therefore visible at normal user speed and is not only a theoretical performance concern.

## Confirmed current code path

The current flow is:

```text
AdminFeedbackPage
  -> navigate('/admin/feedback/:uuid')
  -> AdminFeedbackDetailPage sets loading = true
  -> GET /api/admin/feedback/:uuid
  -> full page returns Loading...
  -> FeedbackSidebarList is unmounted
  -> detail response completes
  -> sidebar mounts again
  -> GET /api/admin/feedback for sidebar records
```

The relevant source is:

- [`AdminFeedbackPage.tsx`](../Frontend/src/features/admin/pages/AdminFeedbackPage.tsx) navigates to the detail route when a record is opened.
- [`AdminFeedbackDetailPage.tsx`](../Frontend/src/features/admin/pages/AdminFeedbackDetailPage.tsx) fetches on every `id` change and returns a full-screen loading element while the request is pending.
- [`FeedbackSidebarList.tsx`](../Frontend/src/features/admin/components/feedback/FeedbackSidebarList.tsx) fetches its list when it mounts or when its own filters change.
- [`feedbackApi.ts`](../Frontend/src/features/admin/api/feedbackApi.ts) defines separate list and detail requests.
- [`admin.feedback.read.service.ts`](../Backend/src/services/admin.feedback.read.service.ts) maps the detail response and marks unread records as read during `getDetail`.
- [`admin.feedback.read.repository.ts`](../Backend/src/repositories/admin.feedback.read.repository.ts) executes the PostgreSQL list, detail, and snapshot reads, using [`admin.feedback.sql.ts`](../Backend/src/repositories/admin.feedback.sql.ts) for the shared detail/timeline projection.
- [`admin.feedback.workflow.repository.ts`](../Backend/src/repositories/admin.feedback.workflow.repository.ts) owns workflow and persisted reply mutations, while [`admin.feedback.mutation.repository.ts`](../Backend/src/repositories/admin.feedback.mutation.repository.ts) owns delete, read-state, and assignment mutations; [`database-transaction.ts`](../Backend/src/common/utils/database-transaction.ts) owns their transaction lifecycle.
- [`admin.feedback.repository.ts`](../Backend/src/repositories/admin.feedback.repository.ts) remains only as a compatibility re-export facade for existing imports.
- [`feedbackStore.ts`](../Frontend/src/features/admin/store/feedbackStore.ts) currently stores assignment overlays only; it does not cache feedback list or detail records.

## Root cause

The current route treats every card change as a new detail-loading lifecycle:

- `activeFeedback` is local to `AdminFeedbackDetailPage`.
- `loading` controls the entire page instead of only the detail panel.
- The sidebar is inside the loading-dependent render tree, so it is destroyed and recreated.
- The sidebar owns its own list request instead of reading the same data source as the detail view.
- The detail GET combines reading data with a write to `is_read`, which makes it unsafe as a bulk preload request.

The primary architectural gap is the absence of a feedback snapshot shared across the feedback list, sidebar, and detail routes.

## Expected behavior

When the admin feedback section is entered:

1. Load a read-only feedback snapshot once.
2. Normalize the records into a frontend store keyed by UUID.
3. Render the list, filters, sidebar, and detail view from that snapshot.

When a staff member selects another card:

1. Change the selected UUID or route.
2. Read the matching record from the store.
3. Keep the sidebar and detail layout mounted.
4. Update only the detail content.

Progress, timeline, read state, assignment, Suggestion workflow, and reply mutations remain explicit mutable state. A mutation response updates the affected UUID rather than forcing a full snapshot reload.

## Planned remediation

The proposed implementation is a read-mostly client snapshot:

```text
GET /api/admin/feedback/snapshot
  -> one read-only PostgreSQL query
  -> feedbackByUuid + feedbackUuids in Zustand
  -> client-side list/filter/sort selectors
  -> detail route selects feedbackByUuid[currentUuid]
```

The preload endpoint must not reuse the current detail GET because that endpoint marks unread records as read. The existing list/detail endpoints can remain for compatibility and fallback behavior, while the normal admin feedback flow uses the snapshot.

The store should be hydrated again when the admin feedback section is entered after leaving it. This is the MVP refresh boundary for new parent submissions. Cross-browser realtime updates are outside this bug fix.

## Implemented solution

Implemented on 2026-08-25 across four phases:

1. Added `GET /api/admin/feedback/snapshot`, backed by one PostgreSQL detail-list query. The endpoint returns complete `AdminFeedback` records and does not mark records as read.
2. Added a normalized Zustand snapshot with `feedbackByUuid`, ordered UUIDs, hydration status, record replacement, and read-state patch actions. Search, type, read, time, rating, and sort filters now run through frontend selectors.
3. Added an `AdminFeedbackLayout` route boundary that hydrates once per feedback-section entry. The list, sidebar, and detail route share the same snapshot. Switching a hydrated card changes the selected UUID without a detail or sidebar list GET.
4. Updated mutation synchronization so read, Issue progress, Suggestion workflow, and reply responses patch the affected cached record. The detail content is keyed by UUID so local tab/reply state resets per record while the sidebar remains mounted.

The existing filtered list and single-detail endpoints remain available as compatibility paths. The normal admin feedback flow uses the snapshot path.

## Verification of the solution

- Frontend full suite: 24 test files, 93 tests passed.
- Backend full suite: 7 test files, 73 tests passed, 5 skipped by the existing suite.
- Frontend build: passed.
- Backend build: passed.
- Frontend lint: passed.
- Root lint: passed.
- Browser Network check: one feedback snapshot GET on entry; zero list/detail GET requests when switching an already loaded sidebar card.
- Browser visual check: the sidebar and detail content remained visible together after switching; no full-page `Loading...` state was present.

## Related progress timeline issue found during verification

The submitted screen capture also exposed a separate data-integrity/display issue. For an Issue record whose `current_status` is `review_started`, the current snapshot contained a `review_started` timeline event but no `submitted` event. `InteractionProgress` marks a step complete only when it finds that exact event, so `Feedback Submitted` appeared as Pending even though the workflow had already advanced.

This is outside the detail-switching preload fix. The repair now includes:

- `Backend/src/data/migrations/20260825_backfill_missing_submitted_feedback_events.sql`, which inserts the missing `submitted` event for legacy Issue/Praise rows using `feedback.created_at` and `System` as the actor;
- a frontend fallback that derives completion from the ordered `current_status` and uses the parent submission timestamp when the legacy event is not present;
- a regression test covering a progressed Issue with a missing initial event.

The migration file is idempotent and has now been applied to the configured `.env.local` database target. The post-migration audit found zero remaining missing `submitted` events, three backfilled rows, three parent-timestamp matches, and zero timestamp mismatches.

## Acceptance criteria

- The feedback section performs one feedback snapshot load on entry.
- Changing search, type, read status, time, rating, or sort does not issue another feedback list request.
- Switching between already-loaded cards does not issue a detail GET.
- The sidebar remains visible during card switching and does not return to its own loading state.
- Preloading does not change any record's `is_read` value.
- Existing explicit read, assignment, Issue progress, Suggestion workflow, and reply behaviors continue to update the correct record.
- A failed mutation does not clear unrelated cached records.
- Leaving and re-entering the feedback section loads newly persisted parent feedback on the next entry.

## Severity assessment

**High (proposed).** The defect is visible, repeatable, and affects the primary admin review workflow on every detail switch. It also creates avoidable database work and couples data retrieval to a read-state mutation.

This is not classified as P0 from the current evidence because there is no confirmed outage, data loss, authorization failure, or corrupted persisted timeline. Production frequency, affected staff count, and database impact still need runtime measurement.

## Verification gap

The recording, source inspection, tests, and browser check confirm the detail-switching behavior and the implemented solution. They do not yet quantify:

- production frequency;
- request and database query counts under real data volume;
- snapshot payload size;
- time spent in the loading state;
- whether any external workflow depends on opening detail marking a record read;
- whether other database environments have also applied the submitted-event migration.

The detail-switching bug, the submitted-state display regression, and the persisted timeline invariant are fixed for the verified target database. Other database environments must run the same idempotent migration before they are considered repaired.

Evidence status: Confirmed unless noted.
