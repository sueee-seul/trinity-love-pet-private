# Manager Google Review Notifications

This document describes the implemented notification flow for a new app-owned, Google-shaped
review created from the pet-parent-facing Maps review flow. It is an implementation guide for
engineers working on the Backend or manager Frontend.

The current notification is a manager action cue. It contains a short reviewer/rating summary rather
than the full review; creating it does not launch AI review processing.

## Scope and ownership

This document covers:

- a human/pet-parent reviewer creating a review through `POST /api/google-reviews`;
- notification creation for every active manager;
- the manager notification API and persisted read state;
- the manager bell dropdown, review index refresh, and direct review-detail navigation.

The same bell also lists "New booking request" notices for managers. Those are described in
[booking-notifications.md](booking-notifications.md); they share the list, read and read-all
routes below, and each row names its source ("Google Reviews" or "Bookings").

The following are intentionally outside this feature:

- Internal Feedback notifications;
- a standalone notification page;
- an outbox, retry worker, or notification delivery service;
- live Google Business Profile ingestion or publication;
- linking the Google reviewer identity to an app pet parent or pet.

The current reviewer identity is still stored in the separate Maps reviewer identity boundary. The
notification uses the stored Google reviewer display name. Pet and app-account identity linkage can
be added later without changing the notification surface described here.

## End-to-end flow

```text
Pet-parent-facing Maps review flow
        |
        | POST /api/google-reviews
        v
ReviewService.createHumanReview()
        |
        | save review photos before the database operation
        v
createGoogleBusinessReviewRecord()
        |
        | one PostgreSQL transaction
        |---------------------------------------------
        | google_business_reviews                      |
        | google_review_media_logs                     |
        | external_feedback                            |
        | review_received timeline event               |
        | one notification row per active manager      |
        |---------------------------------------------
        v
COMMIT
        |
        | publishGoogleReviewEvent({ changeType: "created" })
        |
        +--> manager Admin SSE refreshes the review index
        +--> manager Admin SSE refreshes the notification dropdown
```

The review response is returned after the transaction commits. No investigation marker is written
and no Google Review AI worker runs.

The main write path is implemented in
[review.service.ts](../Backend/src/services/review.service.ts) and
[review.repository.ts](../Backend/src/repositories/review.repository.ts).

## Transactional persistence

For a human review, `ReviewService.createHumanReview()` passes
`notifyActiveManagers: true` to `createGoogleBusinessReviewRecord()`. The repository then writes
the review and its workflow markers through the existing transaction helper.

### Review records

The transaction creates:

1. One `google_business_reviews` row with `data_origin = 'mock'`.
2. Any uploaded `google_review_media_logs` rows.
3. One `external_feedback` row linked to the review.
4. For human reviews, a `review_received` event and one notification per active manager. This flow
   does not depend on AI processing.

### Notification receipt records

When notification creation is enabled, the repository first inserts a separate
`feedback_timeline_events` row with:

- `step = 'review_received'`;
- `external_feedback_uuid` pointing to the review's external feedback row;
- an event payload containing the review UUID and place slug.

It then selects recipients from `users` and `employees` using all of these conditions:

```sql
u.is_employee = TRUE
AND e.staff_role = 'manager'
AND e.staff_status = 'active'
```

The result is global manager fan-out. The query does not restrict the recipient list to a facility
or to the manager who created the review.

For every selected manager, the repository inserts one `notification` row with:

| Field                          | Value                                                            |
| ------------------------------ | ---------------------------------------------------------------- |
| `notification_setting`         | `google_review_created`                                          |
| `category`                     | `google_review`                                                  |
| `assignee_uuid`                | The active manager's employee/user UUID                          |
| `summary_content`              | `New review from {reviewer name}: {rating} stars · {place slug}` |
| `feedback_timeline_event_uuid` | The `review_received` event UUID                                 |
| `read_at`                      | Initially `NULL`                                                 |

The notification repository is in
[google.review.notification.repository.ts](../Backend/src/repositories/google.review.notification.repository.ts).

If no active manager exists, the `review_received` event is kept but no notification rows are
inserted. If the notification insert fails, the surrounding transaction fails as well; the review
and notification are not split into separate successful commits. There is deliberately no outbox
or retry mechanism in the current scope.

The schema already contains the notification `read_at` field and the
`feedback_timeline_event_uuid` linkage. This feature does not modify
[`Backend/database/neon.sql`](../Backend/database/neon.sql), add a column, or introduce a new
migration.

## Review processing boundary

For a human review, the transaction writes a `review_received` timeline event as the durable receipt
used by the notification repository and manager notification API. No dispatch marker or AI result
is written for Google Reviews. The review event stream refreshes the list independently.

The manager notification is inserted in that transaction, so it becomes available as soon as the
review commits.

## Backend notification API

The routes are mounted at `/api/admin/google-review-notifications` and are implemented by
[admin.google.review.notification.routes.ts](../Backend/src/routes/admin.google.review.notification.routes.ts),
[admin.google.review.notification.controller.ts](../Backend/src/controllers/admin.google.review.notification.controller.ts),
and [admin.google.review.notification.service.ts](../Backend/src/services/admin.google.review.notification.service.ts).

Every route is protected by `requireManager`. Mutation routes also require `requireTrustedOrigin`.
The manager UUID is taken from the authenticated session; it is never accepted from the browser as
a scope selector.

### List notifications

```text
GET /api/admin/google-review-notifications?limit=10&cursor=<cursor>
```

Query parameters:

| Parameter | Contract                                                                                              |
| --------- | ----------------------------------------------------------------------------------------------------- |
| `limit`   | Optional integer from 1 to 20. Defaults to 10.                                                        |
| `cursor`  | Optional opaque cursor. It encodes the last notification `created_at` and UUID for keyset pagination. |

The repository reads notifications through this relationship:

```text
notification
  -> feedback_timeline_events (step = review_received)
  -> external_feedback
  -> google_business_reviews
  -> google_business_locations
```

The list is scoped to the authenticated manager's assigned notification rows and the current
app-owned `PetHouse` location. Deleted reviews are excluded. The response contains the page items,
the manager's current unread count, and the next cursor:

```json
{
  "code": 200,
  "data": {
    "items": [
      {
        "id": "<notification-uuid>",
        "type": "google_review_created",
        "category": "google_review",
        "title": "New review from <Google reviewer name>",
        "body": "<rating> stars · PetHouse",
        "reviewerName": "<Google reviewer name>",
        "rating": 5,
        "createdAt": "<ISO timestamp>",
        "readAt": null,
        "target": {
          "kind": "google_review",
          "reviewId": "<review-uuid>",
          "placeSlug": "PetHouse"
        }
      }
    ],
    "unreadCount": 1,
    "nextCursor": null
  }
}
```

The service builds the manager-facing title and body from database fields. The database stores the
reviewer display name and rating; it does not store an AI-generated notification summary.

### Mark one notification read

```text
PATCH /api/admin/google-review-notifications/:id/read
```

The `:id` value must be a UUID. The update is scoped to the authenticated manager and the Google
Review notification category/setting. It uses `COALESCE(read_at, now())`, so opening an already-read
notification does not change its original read timestamp.

### Read all

```text
PATCH /api/admin/google-review-notifications/read-all
```

This is the short manager UI action labelled `Read all`. It updates every unread Google Review
notification assigned to the current manager and returns the updated notification IDs and the
statement timestamp. It does not change notifications belonging to another manager.

The read repository is in
[admin.google.review.notification.repository.ts](../Backend/src/repositories/admin.google.review.notification.repository.ts).

## Frontend behavior

### Server-event refresh

The existing admin Google Review SSE stream is reused. After a valid `created` event:

- `loadGoogleReviewPage(true)` refreshes the review index snapshot;
- a manager-only callback calls `loadGoogleReviewNotifications(true)` for the bell.

This keeps the review index and notification dropdown on the same post-commit event without adding
a second event transport. Reconnect behavior remains owned by the existing shared SSE helper.

The manager-aware refresh is in
[googleReviewStore.ts](../Frontend/src/features/admin/store/googleReviewStore.ts), while the
event validation and stream lifecycle remain in
[googleReviewServerEvents.ts](../Frontend/src/shared/events/googleReviewServerEvents.ts).

### Notification store

[googleReviewNotificationStore.ts](../Frontend/src/features/admin/store/googleReviewNotificationStore.ts)
owns the client projection:

- initial list loading and request sharing;
- cursor-page append behavior;
- unread count;
- one-row read updates;
- `Read all` updates;
- explicit error state;
- reset on employee logout and a revision guard against stale responses after reset.

The API boundary validates the response shape before the store accepts it. The API adapter is
[googleReviewNotificationsApi.ts](../Frontend/src/features/admin/api/googleReviewNotificationsApi.ts).

### Manager bell dropdown

`AdminNavbar` renders `AdminNotificationPopover` only when the resolved role is `manager`. Staff do
not receive the bell in the employee header.

The dropdown uses click-to-open behavior and supports outside-click and Escape closing. It shows a
small, bounded list rather than a separate notification page.

Each item contains this hierarchy:

```text
Google Reviews                         source
New review from <reviewer name>        action-oriented title
<rating> stars · PetHouse              compact context
<relative time>                        recency
```

The copy intentionally omits the full review text, AI result, urgency, and pet identity. The row
should help a manager decide where to go next; the review detail page remains the place for the
full content and investigation state.

Clicking an unread row starts the read-state request and navigates directly to:

```text
/admin/google-reviews/:reviewId
```

The manager review detail page loads the review projection and manager-selected type. The dropdown
does not navigate through a notification page.

The UI is implemented in
[AdminNotificationPopover.tsx](../Frontend/src/features/admin/components/AdminNotificationPopover.tsx)
and [NotificationPopover.tsx](../Frontend/src/shared/components/ui/NotificationPopover.tsx).

### Read and unread presentation

The server owns the persisted state. The Frontend derives the visual state from
`notification.readAt`:

| State  | Presentation                                                               |
| ------ | -------------------------------------------------------------------------- |
| Unread | Darker `bg-surface-deep` background, unread dot, and stronger title weight |
| Read   | Lighter `bg-surface-card` background and no unread dot                     |

There is no `Unread` text label. The background shade is the primary distinction requested for the
manager UI. `Read all` persists the state; it is not a local-only visual shortcut.

The former `AdminNotificationsPage` and `MOCK_NOTIFICATIONS` fixture have been removed. The legacy
`/admin/notifications` path redirects to `/admin` so old bookmarks do not open a dead screen.

## Failure and consistency behavior

The feature intentionally has a small failure boundary:

- database writes for the review, timeline events, and notifications share one transaction;
- a failed notification insert causes the transaction to fail rather than silently claiming that
  the manager was notified;
- Agent processing is asynchronous and is not part of the review response transaction after the
  dispatch marker is written;
- SSE refresh is a UI synchronization mechanism after commit, not the source of notification
  durability;
- read and read-all failures remain visible in the Frontend error state and do not fabricate a
  persisted read timestamp.

There is no retry behavior at the notification persistence or delivery layer. A future retry/outbox
design would need a separate product decision because it would change the current transaction and
failure semantics.

## Verification evidence

The implemented behavior is covered by focused tests in addition to the existing review tests:

- Backend notification repository tests:
  [google.review.notification.repository.test.ts](../Backend/src/__tests__/google.review.notification.repository.test.ts)
- Backend notification API authorization and contract tests:
  [admin.google.review.notification.api.test.ts](../Backend/src/__tests__/admin.google.review.notification.api.test.ts)
- Frontend notification API contract tests:
  [googleReviewNotificationsApi.test.ts](../Frontend/src/features/admin/api/__tests__/googleReviewNotificationsApi.test.ts)
- Frontend notification store tests:
  [googleReviewNotificationStore.test.ts](../Frontend/src/features/admin/store/__tests__/googleReviewNotificationStore.test.ts)
- Frontend manager bell and direct-detail interaction tests:
  [AdminNavbar.test.tsx](../Frontend/src/features/admin/components/__tests__/AdminNavbar.test.tsx)
- Frontend SSE-to-notification refresh coverage:
  [googleReviewStore.test.ts](../Frontend/src/features/admin/store/__tests__/googleReviewStore.test.ts)

The document describes local source and test evidence. It does not claim a browser session, a live
Google provider integration, or a production notification delivery run.
