# In-stay changes: the contract for the parent chat

**Audience:** the engineer wiring the parent AI chat to act on a stay (Scenario 11 outcome 5).
**Status:** wired in on branch `fix`, 2026-10-07. Wagstay does not collect pets, so there is no
early pick-up and the parent wording is check-in and check-out. Section 1 (extend, add-on,
check-out time) is what `Backend/src/services/conversation.stay-changes.ts` does in the parent
chat, ahead of `generateAiTurn`; and, before the stay starts, cancelling and moving the dates
(`previewCancellation`/`cancelByGuest`, `previewReschedule`/`rescheduleByGuest`) go through the
same quote, Confirm and apply.

## 1. The one rule: price first, then confirm, then apply

Every change that moves money has a preview (`GET`) and an apply (`POST` or `PATCH`). The preview
returns the exact amount; the apply takes that amount back as `expectedAmount` (or `expectedFee`,
`expectedTotal`) and refuses with `409` when the price moved in between. The chat must:

1. Call the preview and quote the amount to the parent in their words.
2. Wait for the parent to confirm (a typed "yes" or a tapped confirm) in the same conversation.
3. Call the apply with the previewed amount. The tool result is the only thing that may say
   "confirmed" or "charged"; the model never says it on its own.
4. On `409`, read `details[0].amount` from the error body, quote the new amount and ask again.

All endpoints need the signed-in pet owner's session cookie; the owner id is never in the body. The
server checks the stay belongs to that owner and answers `404` otherwise. Idempotency is server
side: a repeated apply within the same second cannot charge twice (the ledger key is the booking,
the change and its ordinal), and a repeated apply after a success returns a `409` with the current
state, never a second charge.

## 2. Endpoints (`/api/petparent/...`, `Backend/src/routes/petparent.booking.routes.ts`)

| Change           | Preview                                       | Apply                                                  | Body of the apply                                      | Refusal code (409)         |
| ---------------- | --------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------ | -------------------------- |
| Extend the stay  | `GET /bookings/:bookingId/extension?endDate=` | `POST /bookings/:bookingId/extension`                  | `{ endDate, expectedAmount }`                          | `EXTENSION_PRICE_CHANGED`  |
| Add-on for a day | `GET /bookings/:bookingId/add-ons`            | `POST /bookings/:bookingId/pets/:bookingPetId/add-ons` | `{ serviceId, date, quantity (1..5), expectedAmount }` | `ADD_ON_PRICE_CHANGED`     |
| Change the times | none (free)                                   | `PATCH /bookings/:bookingId/pets/:bookingPetId/times`  | `{ dropOffTime?, pickUpTime? }` HH:mm, at least one    | none                       |
| Cancel           | `GET /bookings/:bookingId/cancellation`       | `POST /bookings/:bookingId/cancel`                     | `{ expectedFee? }`                                     | `CANCELLATION_FEE_CHANGED` |
| Move the dates   | `GET /bookings/:bookingId/reschedule?...`     | `POST /bookings/:bookingId/reschedule`                 | new dates plus `expectedTotal`                         | `RESCHEDULE_PRICE_CHANGED` |

Shapes are in `Backend/src/contracts/booking.change.contract.ts` (`ExtensionPreview`,
`AddOnCatalogue`, `ChangeTimesResult`, `CancellationPreview`, `ReschedulePreview` and their
`...Result` types). `ExtensionPreview`, `AddOnCatalogue` and both results carry `settlement`:
`'card'` when the saved card is charged, `'desk'` when the booking has no saved card and the amount is
added to the bill, recorded in `booking_charges` with `processor = 'desk'`, and paid at the desk at
check-out. Say "This will be added to your bill. You pay it at the desk when you check out." for
`'desk'`. A message asking to leave early is answered with "contact our team"; nothing is priced. Other refusals the chat should expect and say in
plain words: `402` card declined (nothing changed), `409` stay not under way or ended, `409` no room
on one of the added nights (the body names the nights), `400` outside the 60-night cap.

Every apply already writes the parent's bell notice and receipt email and the manager's notice; the
chat only needs to tell the parent what the tool result says.

## 3. Reading the stay (no money)

- Daily updates and the stay report: `GET /api/petparent/stays/:bookingPetId/summaries`.
