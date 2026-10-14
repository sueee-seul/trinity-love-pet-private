# Booking notifications

In-app notices tell a pet parent what happened to their booking request, and tell managers that a
new request is waiting. They live in the bell in the header. There is no email or push yet.

## What is sent, and when

| Event               | To                   | When                                                          | Title               | Example text                                                                                                               |
| ------------------- | -------------------- | ------------------------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Request received    | The parent           | Checkout has saved the booking                                | Request received    | We got your request PB-ABC123 for Max and Bella, 12 to 15 Oct 2026. Nothing is booked until our manager approves each pet. |
| New booking request | Every active manager | Checkout has saved the booking                                | New booking request | Max and Bella, 12 to 15 Oct 2026. Reference PB-ABC123.                                                                     |
| Approved            | The parent           | A manager approves a pet that was not approved                | Approved            | Max's stay, 12 to 15 Oct 2026, is approved. Your boarding pass is in My stays.                                             |
| Not accepted        | The parent           | A manager refuses a pet, or changes the reason of a refusal   | Not accepted        | We can't take Max on 12 to 15 Oct 2026. Reason: We are full that week.                                                     |
| Back in review      | The parent           | A manager undoes a decision (the pet was not waiting already) | Back in review      | Our manager has reopened Max's request for 12 to 15 Oct 2026. It is waiting for review again.                              |

- The titles "Approved" and "Not accepted" are the words the stay pages use for those statuses
  (`STAY_STATUS_LABELS` in `Backend/src/services/stay-status.ts`), so the bell and
  My stays never name one decision two ways.
- Dates are Auckland days, written like the stay pages write them ("28 Sep to 2 Oct 2026").
- A notice never calls a request booked or confirmed before approval (Fair Trading Act s9, s11).
- Pressing the same decision twice sends one notice: approving an approved pet, or saving the
  same refusal reason again, tells the parent nothing new.
- Every parent notice opens My stays (`/parent/stays`), which shows the live status. A notice is
  a record of what happened at the time and is never rewritten, so an older notice cannot leave the
  parent on a stale answer. A manager notice opens Bookings (`/admin/bookings`).

The words are in `Backend/src/services/booking.notification.messages.ts`; the rules for when a
decision is news are in `Backend/src/services/booking.notifications.ts`.

## How they are written

A notice is a courtesy on top of the event. A failure to write one is logged with ids and the
error name only (the text holds pet names and a refusal reason) and never undoes or blocks the
request or the decision.

- **Decisions** (`Backend/src/repositories/manager.booking.review.repository.ts`): the decision
  and its notice share one transaction. The booking pet row is locked, the decision is saved, and
  the notice is composed from the status the decision replaced. The notice insert runs inside a
  savepoint: if it fails, the transaction rolls back to the savepoint and the decision still
  commits.
- **Checkout** (`notifyBookingRequested`, called from
  `Backend/src/services/concierge/concierge.checkout.ts`): right after the booking is saved. The
  shared booking write closes its own transaction, and the notice needs the pet names it has just
  saved. The parent notice and the manager notices are written independently, so one failing does
  not stop the other. The call never throws, so a guest whose request was saved always gets their
  receipt.

## Where they are stored

The existing `notification` and `pet_owners_notification` tables hold them. No column was added.

| Column                              | Parent notice                                                                                 | Manager notice            |
| ----------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------- |
| `notification.category`             | `booking`                                                                                     | `booking`                 |
| `notification.notification_setting` | `booking_request_received`, `booking_approved`, `booking_refused` or `booking_back_in_review` | `booking_request_created` |
| `notification.booking_uuid`         | the booking                                                                                   | the booking               |
| `notification.summary_content`      | the text                                                                                      | the text                  |
| `notification.assignee_uuid`        | empty                                                                                         | the manager               |
| `pet_owners_notification`           | one row that links the notice to its owner                                                    | none                      |

A parent notice and its owner link are written in one statement, so neither exists without the
other. Manager notices go to every employee with `staff_role = 'manager'` and
`staff_status = 'active'`, the same managers the Google Review notices reach.

`notification.assignee_uuid` has no delete rule, so a manager's notices would block removing that
manager. Removing a staff member (`removeStaff` in
`Backend/src/repositories/staff.write.repository.ts`) therefore deletes the notices assigned to
them in the same transaction. Parent notices have no assignee and are never touched.

## Parent API

All three routes need a pet parent session (`requirePetParent`: a staff account is refused even
if it also owns pets). The two writes also check the request's `Origin` first. The owner always
comes from the session, and ownership is part of every SQL statement through
`pet_owners_notification`, so another parent's notice reads exactly like one that does not exist.

| Method and path                               | Body or query                                   | Answer                                                                                      |
| --------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `GET /api/petparent/notifications`            | `limit` 1 to 50, default 20; nothing else       | `{ items, unreadCount }`, newest first. `unreadCount` counts every unread notice.           |
| `PATCH /api/petparent/notifications/:id/read` | none                                            | `{ id, readAt }`; the first read time is kept. `404 NOTIFICATION_NOT_FOUND` for another id. |
| `PATCH /api/petparent/notifications/read-all` | `{ through?: ISO date and time }`; nothing else | `{ updatedIds, readAt }`                                                                    |

`through` is the newest notice the bell showed. Only notices up to it are marked read, so one that
arrives while the bell is open stays unread. Each item is
`{ id, kind, title, body, facts, createdAt, readAt }`; the types are in
`Backend/src/contracts/booking.notification.contract.ts` and
`Frontend/src/features/pet-parent/types/notifications.ts`.

`facts` is what the English sentence says: its template (`confirmed`, `received`, `approved`,
`refused`, `reopened` or `moved`), the reference, pet names, Auckland stay days and, for a refusal,
the stored reason. The table keeps only the sentence (no column was added), so
`Backend/src/services/booking.notification.facts.ts` reads it back with the same shapes the
messages write, including the older wording ("is approved", "Nothing is booked until…"). A sentence
it cannot read gives `facts: null`. The tests write every message and read it back.

## The parent bell

`Frontend/src/features/pet-parent/components/PetParentNotificationPopover.tsx`, with its state in
`notifications/useParentNotifications.ts` and its list in `notifications/ParentNotificationPanel.tsx`.

- It is in the desktop header. The phone header has no bell (docs/homepage-ui-design-prompt.md).
  CSS hides the desktop header on phones but React still mounts it, so the navbar renders the bell
  only from the `md` width up (`useMediaQuery` in `Frontend/src/shared/hooks/`). A phone loads no
  notices it cannot show.
- It loads once when it mounts, so the count shows on every page.
- It opens on a click only, never on hover, because opening it marks the notices read. Opening
  loads the newest notices again and marks the ones shown as read. They stay marked "New" (a dot,
  bold title and "New:" for screen readers) while the bell is open.
- Following a notice marks it read if opening could not, closes the bell and opens My stays.
- It has a loading state, an error state with "Try again", and an empty state.
- The unread count is part of the button's name ("Open notifications, 2 unread"); the red badge
  only shows it. There is no live region.
- English shows each notice as written. Chinese words it from `facts`
  (`notifications/noticeWords.ts`): pet names, Chinese dates, a preset refusal reason in Chinese,
  and "see My stays" for anything else, including a reason typed in English and money, which was
  the policy of its day. A notice with no facts gets a general line for its kind.

## The manager bell

The Google Review bell (docs/manager-google-review-notifications.md) also lists "New booking
request" notices. `GET /api/admin/google-review-notifications` returns both kinds in one list
(`ManagerNotification`), and the read and read-all routes cover both. Each item names its source
("Google Reviews" or "Bookings"). A booking request has no event stream, so the bell refreshes each
time it opens.

## Not yet done

1. **Email and push.** Only the in-app bell exists. Email waits for a mail provider (see
   ai-booking-concierge.md, "Not yet done", item 1).
2. **Accounts made by the concierge** have no password and sign back in by email code, which is not
   wired yet. Until it is, those parents cannot open the bell.
3. **The 48 hour pre-arrival reminder** is only a card on Home: from 48 hours before an approved
   pet's drop-off, `GET /api/petparent/home` works out a "Get ready" card when the page is read
   (see "Get ready before drop-off" in Backend/README.md). The bell gets no row for it, because no
   job runner exists to write a timed notice. The "withdrawn or changed" notice to staff is not
   built.
4. **Retention.** Notices are kept with no end date. A written retention period is needed (Privacy
   Act IPP 9), with the other privacy documents.
5. **The manager API path** is still named `google-review-notifications` although it now carries
   booking requests too.
6. **Phones.** A parent on a phone cannot see notices yet, because the design has no bell in the
   phone header. The owner needs to choose a phone entry point, for example a bell in the phone
   header or a notices card on My stays.
