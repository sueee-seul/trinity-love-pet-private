# Admin Google Review Cross-Browser Synchronization Bug

Status: Implemented. Verified for browsers connected to the same Backend process; the final automated test rerun after BroadcastChannel deletion was intentionally skipped at the user's request
Severity: High (proposed; production frequency and affected staff count are not yet measured)
Scope: Google-shaped public review page and Admin Google Reviews workflow across Safari and Chrome

## Summary

Before the SSE implementation, after a Google review mutation succeeded, an already-open review
page in another browser could continue to display stale data. The pre-SSE Frontend update signal
was browser-local: it used a same-runtime `window` event and `BroadcastChannel` for browser tabs.
In the observed Safari-to-Chrome workflow, the persisted change became visible in the other browser
only after the user manually reloaded or re-entered the relevant page.

The confirmed pre-SSE problem was stale active-page state and delayed visibility of a persisted
change. There was no evidence that the mutation itself consistently failed to persist. The
implemented solution and its verification are recorded below.

## Why this matters

This affects the staff workflow that depends on public reviews and internal review state remaining
consistent across active screens.

| Impact area           | Observed effect                                                                                                                | Why it matters                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Review intake         | A review submitted on the public Safari page does not immediately appear in the already-open Chrome Admin Google Reviews page. | Staff may not know that a new review requires triage.                               |
| Assignment visibility | A Manager assignment can remain absent from a Staff page that is already open in another browser.                              | Staff may not see work assigned to them and may delay handling it.                  |
| Reply visibility      | A Staff reply can remain absent from the Manager or public review page until that page loads again.                            | Staff, managers, and reviewers can see different versions of the same review state. |
| Workflow trust        | The user has to perform an explicit reload or page re-entry to reveal a change that has already succeeded.                     | The product appears unreliable and makes it unclear whether the mutation completed. |

## Problem statement

When a reviewer, Manager, or Staff member completes a supported Google review mutation in one
browser, every already-open affected review surface should reflect the persisted result without a
manual browser reload or page re-entry. The current behavior only propagates the invalidation event
within the same browser context. Safari and Chrome can therefore show different review snapshots
after the same mutation has succeeded.

The affected transitions are:

1. Public review creation → Manager active Google Reviews page.
2. Manager assignment → Staff active Google Reviews page.
3. Staff reply → Manager active Google Reviews page.
4. Staff reply → public mock Google review page.

## Observed behavior (pre-SSE bug)

The attached recordings are evidence for the problem statement. UI labels and text shown inside the
recordings are not treated as additional instructions or scope.

### Video 1: public review creation does not update the active Chrome admin page

The recording shows Safari on the left and Chrome on the right:

1. The public PetHouse review page is open in Safari, while the Admin Google Reviews page is open
   in Chrome.
2. A new review is submitted from the Safari public page.
3. Safari displays the new review in its public review list.
4. The already-open Chrome Admin Google Reviews view continues to show the previous review list.
5. After an explicit Admin reload or page re-entry, the new review becomes visible in Chrome.

This is direct visual evidence of different active-page snapshots across Safari and Chrome after the
same review creation has completed.

Source recording: [Screen Recording 2026-09-02 at 11.18.29 PM.mov](</Users/heminghan/Desktop/Screen Recording 2026-09-02 at 11.18.29 PM.mov>)

### Video 2: reply flow involves separate loading transitions across the two surfaces

The recording shows the Chrome Admin reply view on the right and the public Safari review surface
on the left. Submitting the reply causes the Admin detail view to enter `Loading Google review…`;
the public side later enters a review-loading state and displays the owner response.

The recording starts with an owner response already visible on the public side. Therefore, it
supports the existence of the cross-surface reply and loading path, but it does not prove that the
response was absent before this particular reply action.

Source recording: [Screen Recording 2026-09-02 at 11.15.37 PM.mov](</Users/heminghan/Desktop/Screen Recording 2026-09-02 at 11.15.37 PM.mov>)

## Confirmed current code path

The implemented notification and refetch paths are:

| Mutation and affected surface         | Mutation source and API                                                                                                                                                                                      | Publisher                                                                                                                                                                  | Subscriber and refetch                                                                                                                                                                                                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public review creation → Manager page | [`WriteReviewModal.tsx`](../Frontend/src/features/maps-review/components/WriteReviewModal.tsx) calls `reviewerAuthApi.submitReview()` through `POST /api/google-reviews`.                                    | [`review.service.ts`](../Backend/src/services/review.service.ts) publishes a `created` invalidation through the Backend in-process event bus after successful persistence. | [`googleReviewStore.ts`](../Frontend/src/features/admin/store/googleReviewStore.ts) subscribes through [`googleReviewServerEvents.ts`](../Frontend/src/shared/events/googleReviewServerEvents.ts) and performs a background REST GET of `/api/admin/google-reviews?placeSlug=PetHouse`. |
| Manager assignment → Staff page       | [`GoogleReviewsPanel.tsx`](../Frontend/src/features/admin/components/feedback/GoogleReviewsPanel.tsx) calls `googleReviewsApi.assignReviews()` through `PATCH /api/admin/google-reviews/assignee`.           | [`admin.google.review.service.ts`](../Backend/src/services/admin.google.review.service.ts) publishes an `assigned` invalidation after successful persistence.              | The Staff AdminPortal uses `useGoogleReviewStoreSync()` and refreshes the admin review page through the REST GET.                                                                                                                                                                       |
| Staff reply → Manager page            | [`AdminGoogleReviewDetailPage.tsx`](../Frontend/src/features/admin/pages/AdminGoogleReviewDetailPage.tsx) calls `googleReviewsApi.replyToGoogleReview()` through `POST /api/admin/google-reviews/:id/reply`. | [`admin.google.review.service.ts`](../Backend/src/services/admin.google.review.service.ts) publishes a `replied` invalidation after successful persistence.                | The Manager AdminPortal uses `useGoogleReviewStoreSync()` and refreshes the admin review page through the REST GET.                                                                                                                                                                     |
| Staff reply → public mock page        | The same Staff reply mutation and Backend publisher are used.                                                                                                                                                | The reply service publishes a `replied` invalidation for both targets after persistence.                                                                                   | [`PetHouseReviewPage.tsx`](../Frontend/src/features/maps-review/pages/PetHouseReviewPage.tsx) subscribes to the public SSE stream and refreshes through `GET /api/google-reviews?placeSlug=PetHouse`.                                                                                   |

The shared server-event implementation in [`googleReviewServerEvents.ts`](../Frontend/src/shared/events/googleReviewServerEvents.ts)
uses native `EventSource` with credentials, validates the event payload and matching `placeSlug`,
closes the stream and listeners during cleanup, and refreshes after EventSource reconnects. The
Admin stream is mounted by [`AdminPortal.tsx`](../Frontend/src/features/admin/components/AdminPortal.tsx),
and the public stream is mounted by [`PetHouseReviewPage.tsx`](../Frontend/src/features/maps-review/pages/PetHouseReviewPage.tsx).

The Backend event stream is exposed by [`google.review.events.controller.ts`](../Backend/src/controllers/google.review.events.controller.ts):

- `GET /api/google-reviews/events?placeSlug=PetHouse` is public.
- `GET /api/admin/google-reviews/events?placeSlug=PetHouse` requires an authenticated employee.

Both routes subscribe to the in-process event bus in [`google.review.events.ts`](../Backend/src/services/google.review.events.ts).
The review services publish invalidation after successful persistence for human review creation,
mock review deletion, assignment, and reply. The event contains invalidation metadata rather than
the changed review, so each subscriber refreshes its own REST projection.

The previous `BroadcastChannel`, review-specific `window` event, and local mutation publishers have
been removed.

## Persistence boundary

The Backend persists the underlying mutations independently of the Frontend event:

- `ReviewService.createHumanReview()` calls `createGoogleBusinessReviewRecord()`, which inserts the
  review, media records, and its `external_feedback` projection.
- `assignGoogleReviewRecords()` writes the selected assignment into `external_feedback`.
- `updateMockGoogleBusinessReviewReply()` inserts the sent reply into
  `external_feedback_replies` and reads the updated review projection back.
- The public and admin GET paths read the current persisted projection from PostgreSQL.

This boundary is important: a missing cross-browser update signal is not the same as a confirmed
database write failure. A manual reload can reveal the newer persisted state, as shown in the first
recording.

## Expected behavior

After a successful mutation has been persisted, an already-open affected review page should update
its visible data across the supported Safari and Chrome contexts without requiring the user to
manually reload or re-enter the page.

The expected synchronized results are:

- a newly submitted public review appears in the active Manager review list;
- a Manager assignment appears in the active Staff review list;
- a Staff reply appears in the active Manager review view;
- a Staff reply appears in the active public mock Google review view.

## Implemented solution

Implemented with a single-Backend-process server event path:

1. Added the Backend in-process event bus in [`google.review.events.ts`](../Backend/src/services/google.review.events.ts) and the SSE controller in [`google.review.events.controller.ts`](../Backend/src/controllers/google.review.events.controller.ts).
2. Exposed public and authenticated employee SSE routes for `placeSlug=PetHouse`.
3. Moved invalidation publication into the successful persistence paths for human creation, mock deletion, assignment, and reply.
4. Replaced the browser-local transport with native `EventSource` in [`googleReviewServerEvents.ts`](../Frontend/src/shared/events/googleReviewServerEvents.ts), including credentials, payload validation, cleanup, and reconnect refresh.
5. Kept review data ownership in REST GETs: [`googleReviewStore.ts`](../Frontend/src/features/admin/store/googleReviewStore.ts) refreshes the Admin projection, and [`PetHouseReviewPage.tsx`](../Frontend/src/features/maps-review/pages/PetHouseReviewPage.tsx) refreshes the public projection after a valid server event.

The implemented boundary is browsers connected to the same Backend process. No multi-instance fan-out mechanism is part of this implementation.

## Verification of the implementation

- User-provided [Screen Recording 2026-09-03 at 6.58.40 AM.mov](</Users/heminghan/Desktop/Screen Recording 2026-09-03 at 6.58.40 AM.mov) shows native Safari public review creation appearing in the active Chrome Admin review list. Later in the same recording, the Chrome reply succeeds and the Safari public page displays the owner response.
- User-provided [Screen Recording 2026-09-03 at 7.00.41 AM.mov](</Users/heminghan/Desktop/Screen Recording 2026-09-03 at 7.00.41 AM.mov) shows a Chrome Manager assignment causing the Safari Staff list to display the newly assigned review.
- These recordings provide native Safari/Chrome human/browser evidence for create-to-Manager, assignment-to-Staff, and reply-to-public. They do not separately demonstrate reply-to-an-independently-open Manager page; that transition is covered by source/unit-test evidence, not directly verified in a native browser recording.
- Before the BroadcastChannel deletion phase, the main thread verified Frontend focused SSE/store/public tests: 34/34; Frontend build and oxlint; Backend focused SSE/review tests: 24/24; and review API route tests: 24/24 with the permitted runtime.
- After the deletion phase, the final automated test rerun was intentionally skipped at the user's request. The post-deletion checks were static only: no legacy `BroadcastChannel` or review-specific local-event symbol matches, and `git diff --check` passed.

## Evidence boundary

### Verified evidence

- [`google.review.events.ts`](../Backend/src/services/google.review.events.ts) implements the
  in-process Backend event bus, and [`google.review.events.controller.ts`](../Backend/src/controllers/google.review.events.controller.ts)
  exposes the public and authenticated employee SSE streams.
- The Backend review services publish invalidation after successful persistence for human review
  creation, mock review deletion, assignment, and reply.
- [`googleReviewServerEvents.ts`](../Frontend/src/shared/events/googleReviewServerEvents.ts) uses
  native `EventSource` with credentials, validates payloads, closes on cleanup, and refreshes after
  reconnect. [`googleReviewStore.ts`](../Frontend/src/features/admin/store/googleReviewStore.ts)
  and [`PetHouseReviewPage.tsx`](../Frontend/src/features/maps-review/pages/PetHouseReviewPage.tsx)
  perform event-triggered REST GET refreshes.
- Before the deletion phase, Frontend focused SSE/store/public tests passed 34/34; Backend focused
  SSE/review tests passed 24/24; and review API route tests passed 24/24 with the permitted runtime.
  Frontend build and oxlint also passed.
- The two 2026-09-03 recordings provide native Safari/Chrome human/browser evidence for
  create-to-Manager, assignment-to-Staff, and reply-to-public, as described in the implementation
  verification section.

### User-reported runtime evidence

- The [6.58.40 AM recording](</Users/heminghan/Desktop/Screen Recording 2026-09-03 at 6.58.40 AM.mov)
  shows Safari public review creation in the active Chrome Admin list, followed by a successful
  Chrome reply whose owner response appears on the Safari public page.
- The [7.00.41 AM recording](</Users/heminghan/Desktop/Screen Recording 2026-09-03 at 7.00.41 AM.mov)
  shows Chrome Manager assignment appearing in the Safari Staff list.
- These recordings do not separately demonstrate reply-to-an-independently-open Manager page.

### Inference

The Backend in-process bus plus SSE streams explain how independently open Safari and Chrome pages
can receive an invalidation while sharing one Backend process. The subscriber-owned REST GET then
loads the persisted projection. This is an architectural explanation supported by the source and
the recordings, not a claim about separate deployment instances or arbitrary devices.

### Not verified

- Synchronization across different devices or browser profiles.
- Multi-instance fan-out or synchronization across separate deployment instances.
- Production frequency, affected staff count, and the time that users see stale data.
- Direct native-browser verification of reply-to-an-independently-open Manager page; this transition
  is source/unit-test covered.
- Automated tests rerun after BroadcastChannel deletion; they were intentionally skipped at the
  user's request.

## Related boundary

The existing [Admin Feedback Detail Switching Reload-Like Bug](./admin-feedback-detail-switching-bug.md)
records cross-browser realtime updates as outside that earlier detail-switching fix. This document
records the separate Google review synchronization problem and its implemented SSE solution.

Evidence status: Confirmed unless explicitly labelled as user-reported, inferred, or not verified.
