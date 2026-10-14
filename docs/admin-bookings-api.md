# Admin bookings API: `GET /api/admin/bookings`

**Audience:** engineers building or consuming the manager/admin bookings view.
**Status:** describes the endpoint as currently implemented.

---

## 1. Summary

|               |                                                                                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Method & path | `GET /api/admin/bookings`                                                                                                                                          |
| Auth          | Session cookie; caller must be an employee (managers and staff). Staff also work the desk; decisions stay manager-only (section 2)                                 |
| Query params  | None                                                                                                                                                               |
| Request body  | None                                                                                                                                                               |
| Success       | `200`: JSON array of booking records                                                                                                                               |
| Purpose       | Gives managers and staff a flat, read-only list of every **paid** booking, one entry per pet, with full customer, pet, care-instruction, and priced-service detail |

Implementation, top to bottom:

- Route: [`Backend/src/routes/manager.booking.routes.ts`](../Backend/src/routes/manager.booking.routes.ts), mounted at `/api/admin/bookings` in [`server.ts`](../Backend/src/server.ts)
- Auth gate: `requireEmployee` for this list and the desk, `requireManager` for decisions, in [`Backend/src/common/middlewares/auth.middleware.ts`](../Backend/src/common/middlewares/auth.middleware.ts)
- Controller: [`Backend/src/controllers/manager.booking.controller.ts`](../Backend/src/controllers/manager.booking.controller.ts)
- Service: [`Backend/src/services/manager.booking.ts`](../Backend/src/services/manager.booking.ts) (pass-through)
- Repository / SQL: [`Backend/src/repositories/manager.booking.repository.ts`](../Backend/src/repositories/manager.booking.repository.ts)

## 2. Authentication & authorization

The list, recording an arrival and finishing check-in take `requireEmployee`: staff work the desk,
and the charge at check-in is worked out by the server from the rules, so nobody chooses an
amount. Decisions that need judgement take `requireManager`: approving, refusing or undoing a
review, cancelling or moving a stay without a fee, and turning a pet away at the desk
(`'wagstay_unable'`, refused with `403 FORBIDDEN` for staff in the controller). Most stays are
confirmed at checkout (see `docs/ai-booking-concierge.md`), so a manager only reviews the stays
the checkout rule sends to them. The guards are layered:

1. `requireAuth`: reads the session cookie, verifies the token, loads the user. Missing/invalid session → `401 UNAUTHENTICATED`.
2. `requireEmployee`: the session user must have `is_employee = true`. Otherwise → `403 FORBIDDEN`.
3. `requireManager`: on top of that, `employee_role` must equal `'manager'`. A non-manager employee (e.g. regular staff) also gets `403 FORBIDDEN`.

There is no query parameter or body-based identification. The caller is entirely determined by the session cookie.

## 3. What counts as "a booking" here

The SQL selects from `booking_pets`, **one row per pet per booking**, filtered to `bookings.status = 'paid'` only. Draft/in-progress checkouts a pet parent hasn't completed never appear here.

This means:

- A booking with 3 pets produces **3 array entries**, each with the same `booking_id` but a different `booking_pets_uuid`, `pet`, `dates`, and `services`.
- Rows are sorted newest-first by `booking_pets.created_at`.
- There is no pagination and no filtering (by date range, customer, or status). Every paid booking-pet row is returned on every call.

## 4. Response shape

`200 OK` → `ManagerBookingRecord[]`:

```jsonc
[
  {
    "booking_pets_uuid": "790a43ec-477d-4e20-8686-b6d7ce8dcb7c",
    "booking_id": "2b2ccd9b-24a6-416d-923e-b588810cfaf1",
    "customer": {
      "id": "ce87d8f4-cf49-41ff-b9d3-6d1d5d98e804",
      "name": "Jane Rivera",
      "contact": { "email": "jane@example.com", "phone": null },
    },
    "pet": {
      "id": "eae99de9-47aa-4ac2-8ab9-5c41a191f3ef",
      "name": "Luna",
      "type": "cat",
      "details": {
        "breed": "Ragdoll",
        "age": 3,
        "weight": 4.8,
        "gender": false,
        "colour": "Cream and brown",
        "status": "incoming",
        "diet_notes": "Wet food in the morning and dry food in the evening",
        "allergies": "None",
        "behaviour_notes": "Calm, affectionate, and friendly with people",
        "desexed": true,
        "microchip_number": "985141234567890",
        "vet_name": "Dr. Emily Johnson",
        "vet_phone": "0219876543",
        "health_notes": "Healthy, regular vaccinations",
      },
    },
    "booking": {
      "dates": { "check_in": "2026-09-15", "check_out": "2026-09-17" },
      "booking_caring_info": {
        "feeding_routine": "1 cup dry food and 1 cup wet food",
        "medication_instructions": "2 pills in the morning",
        "first_time_boarding": true,
        "crate_trained": true,
        "other_notes": "",
        "allows_socialization": true,
        "fully_vaccinated": true,
        "behavior_and_health_notes": "",
        "has_vaccination_certificate": true,
        "vaccination_document_uploaded_at": "2026-09-02T01:00:00.000Z",
      },
      "services": {
        "boarding_rate": {
          "services_uuid": "8401b9a1-6fbb-4fa8-b933-d8da0ba433f1",
          "services_name": "Standard boarding",
          "price": 45,
          "priceUnit": "per night",
          "frequency": 2,
        },
        "food": {
          "services_uuid": "2b270f65-a750-47ac-ab7e-c6ac5579ff97",
          "services_name": "Owner-provided food",
          "price": 0,
          "priceUnit": "per day",
          "frequency": 2,
        },
        "addons": [
          {
            "services_uuid": "e1dbebe1-122d-48d5-892d-a9038b0ff0f0",
            "services_name": "Grooming session",
            "price": 35,
            "priceUnit": "per stay",
            "frequency": 1,
          },
          {
            "services_uuid": "8c14185a-3170-4c6b-a856-e575b1e9b354",
            "services_name": "Medication administration",
            "price": 8,
            "priceUnit": "per day",
            "frequency": 2,
          },
          {
            "services_uuid": "b3b8339e-afe3-4a9a-86ed-980dd6857db6",
            "services_name": "Outdoor Walk",
            "price": 30,
            "priceUnit": "per day",
            "frequency": 2,
          },
        ],
      },
      "status": "paid",
      "manager_review_status": "pending",
      "refusal_reason": null,
    },
  },
]
```

### Field reference

| Field                                                          | Type                          | Notes                                                                                                                                                                                                                                                             |
| -------------------------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `booking_pets_uuid`                                            | string                        | Primary key of this array entry, one per pet per booking                                                                                                                                                                                                          |
| `booking_id`                                                   | string                        | Shared across every pet on the same booking                                                                                                                                                                                                                       |
| `customer.id`                                                  | string                        | `users.uuid` of the pet owner                                                                                                                                                                                                                                     |
| `customer.name`                                                | string                        | `first_name` + `last_name`, space-joined                                                                                                                                                                                                                          |
| `customer.contact.email` / `.phone`                            | string / string\|null         | From `users`                                                                                                                                                                                                                                                      |
| `pet.type`                                                     | string                        | Lower-cased `pets.species`                                                                                                                                                                                                                                        |
| `pet.details.*`                                                | mixed, mostly nullable        | Straight passthrough of the `pets` table                                                                                                                                                                                                                          |
| `booking.dates.check_in` / `.check_out`                        | string (`YYYY-MM-DD`) \| null | From `booking_pets.drop_off_time` / `pick_up_time`, date part only (no time-of-day)                                                                                                                                                                               |
| `booking.booking_caring_info.*`                                | mixed, all nullable           | From `booking_pets_caring_info`, left-joined. Every key is present but every value is `null` if the pet has no caring-info row at all, or if that specific field was left blank                                                                                   |
| `booking.booking_caring_info.has_vaccination_certificate`      | boolean                       | `true` when the pet parent uploaded a vaccination certificate for this stay. Never `null`. The private storage key in `vaccination_document_url` is never sent; open the file with `GET /api/admin/vaccination-certificates/:booking_pets_uuid` (any employee)    |
| `booking.booking_caring_info.vaccination_document_uploaded_at` | string (ISO) \| null          | When that certificate was uploaded                                                                                                                                                                                                                                |
| `booking.services.boarding_rate` / `.food`                     | object \| null                | `null` only if the booking somehow has no service in that category. This shouldn't happen since both are required at checkout                                                                                                                                     |
| `booking.services.addons`                                      | array                         | `[]` if no add-ons were selected                                                                                                                                                                                                                                  |
| `booking.status`                                               | string                        | `"paid"` (made before the card guarantee) or `"confirmed"` (a request made with a saved card; each pet's own status says whether it was approved)                                                                                                                 |
| `booking.manager_review_status`                                | string                        | `'pending'` \| `'approved'` \| `'refused'` \| `'cancelled'`. A request's pets start `'pending'` until a manager decides; `'cancelled'` means the guest withdrew or cancelled, or staff cancelled without a fee (§10)                                              |
| `booking.refusal_reason`                                       | string \| null                | The reason for a refusal, or for a cancellation without a fee; `null` otherwise (approving clears it)                                                                                                                                                             |
| `booking.check_in_outcome`                                     | string \| null                | What the desk recorded (§10): `'checked_in'` \| `'no_show'` \| `'wagstay_unable'`; `null` until then                                                                                                                                                              |
| `booking.drop_off_at`                                          | string (ISO, UTC) \| null     | The drop-off instant, so the page knows the Auckland drop-off day                                                                                                                                                                                                 |
| `booking.pet_price`                                            | number                        | This pet's share of the booking in NZD: its recorded lines, nights in Auckland dates. Finishing check-in charges from it                                                                                                                                          |
| `booking.pet_nightly_rate`                                     | number                        | One night of this pet's per-night lines, in NZD. Under the older terms a no-show (or vaccination proof not fixed on drop-off day) costs this, capped at `pet_price`; under the pay-at-request terms it costs half of `pet_price`. The desk shows the amount first |
| `booking.reviewer_name`                                        | string \| null                | The manager who approved or refused; `null` while pending, when confirmed at checkout, or for decisions made before this was recorded                                                                                                                             |
| `booking.card_guarantee`                                       | object \| null                | The saved card behind a booking-page booking; `null` for the classic form. `{ status, amount, captured_amount, test_mode, pays_at_request }`, see below                                                                                                           |

`pays_at_request` is true for bookings agreed under `concierge-terms-2026-10-02` or later (see
[ai-booking-concierge.md](ai-booking-concierge.md#paying-at-request)). For those,
`card_guarantee.status` is `'authorized'` (the full price is held while a pet waits for review, at
most 24 hours), `'succeeded'` with `captured_amount` `null` (the confirmed pets were charged;
`amount` is what was charged; the desk or a cancellation refunds what is not owed), `'canceled'`
(released, nothing confirmed) or `'refunded'` (everything given back).

For older bookings it is `'pending'` (card saved, nothing held: a request waiting for review, or an
approved stay not yet within 48 hours of drop-off), `'authorized'` (the approved pets' total is held),
`'succeeded'` (charged at check-in), `'canceled'` (hold released), or `'failed'` (the hold 48 hours
before drop-off was refused).

`captured_amount` is what Wagstay finally kept at check-in or on a cancellation (0 when nothing was
kept) and stays `null` until then; a booking with a `captured_amount` is settled and its arrivals
can no longer change. `test_mode` is true for the development fake and for Stripe test keys: no
real money moves.

### Priced-service object (`boarding_rate`, `food`, each `addons[]` entry)

| Field           | Type   | Meaning                                                                                                                                                                                                             |
| --------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `services_uuid` | string | `services.uuid`                                                                                                                                                                                                     |
| `services_name` | string | `services.name`                                                                                                                                                                                                     |
| `price`         | number | **Price actually charged at booking time** (`booking_pets_services.price_at_booking`), not the live catalog price. A later catalog price change does not retroactively change what a historical booking shows here. |
| `priceUnit`     | string | `services.price_unit` verbatim, e.g. `"per night"`, `"per day"`, `"per stay"`, `"per walk"` (no current service uses `"per walk"`, see §5)                                                                          |
| `frequency`     | number | How many times `price` applies (see rules below)                                                                                                                                                                    |

## 5. `frequency` calculation

`frequency` is the quantity actually used to compute that service's cost, i.e. `price × frequency` is the line total for that service on that pet's stay.

| `priceUnit` | `frequency`                                                                                                    | Source                                                                                                                                          |
| ----------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `per night` | Number of nights                                                                                               | Pick-up date minus drop-off date, both in Auckland (`AT TIME ZONE 'Pacific/Auckland'`), at least `1`. Defaults to `1` if either date is missing |
| `per day`   | Number of nights (same value as above; the schema doesn't distinguish "day" from "night" for pricing purposes) | Same as above                                                                                                                                   |
| `per stay`  | `1`                                                                                                            | Fixed: charged once regardless of stay length                                                                                                   |
| `per walk`  | Number of walks the pet parent selected                                                                        | `booking_pets_services.quantity`. Kept for a future service; no current service uses this unit                                                  |

Until 2026-09-29 the nights were counted from UTC dates. A drop-off at 10:30 in Auckland is the
previous day in UTC, so most stays showed one night more than was charged.

This mirrors the pricing logic in the pet-parent booking flow (`Frontend/src/features/pet-parent/utils/pricing.ts` and `Backend/src/services/petparent.booking.ts`), so a service's `frequency` here always agrees with what the pet parent was actually charged for it.

**Outdoor Walk was `per walk` until 2026-09-17** (pet parent chose a number of walks; `frequency` was that quantity). It's now `per day`, charged automatically by stay length like Extra Playtime and Medication Administration. The pet parent no longer picks a quantity for it. See `Backend/src/data/migrations/20260917_outdoor_walk_per_day_pricing.sql`.

## 6. Known behaviors worth knowing before you build on this

- **`boarding_rate` / `food` pick one row.** The subquery for each takes the earliest-created `booking_pets_services` row in that category (`ORDER BY created_at LIMIT 1`). The booking flow only ever lets a pet parent select one boarding rate and one food option per pet, so in practice there's only ever one row to pick. But this endpoint doesn't itself enforce or validate that; it just takes the first.
- **Historical, not live, pricing.** `price` and `priceUnit` reflect what was true when the booking was made (`price_at_booking`, `services.price_unit` at read time. Note `priceUnit` itself is read live from `services`, so if a service's _unit_ were ever changed after the fact, old bookings would show the new unit against the old price; only `price` is a true point-in-time snapshot). This already happened once: bookings made while Outdoor Walk was `per walk` now show `frequency` as nights (its new unit) instead of the walk count that was actually charged at the time.
- **No pagination, no filters.** Every paid booking-pet row is returned, unsorted by customer or date range. The caller filters/paginates client-side if needed.
- **Multi-pet bookings are flattened.** Group by `booking_id` on the client if you need one card per booking rather than per pet.

## 7. Approving / refusing a booking

|               |                                                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------------------- |
| Method & path | `PATCH /api/admin/bookings/:id/approve`                                                                       |
| Method & path | `PATCH /api/admin/bookings/:id/refuse`                                                                        |
| Auth          | Same as above: `requireManager`                                                                               |
| `:id`         | `booking_pets_uuid` (not `booking_id`). The review is per pet, not per booking                                |
| Request body  | `approve`: none. `refuse`: `{ "reason": string }` (non-empty, required)                                       |
| Success       | `204 No Content`                                                                                              |
| Errors        | `404` if `:id` doesn't match any `booking_pets` row; `400` if `refuse` is called without a non-empty `reason` |

Approving sets `manager_review_status = 'approved'` and clears `refusal_reason` back to `null`, so a booking that was refused and later re-approved doesn't keep showing the old reason. Refusing sets `manager_review_status = 'refused'` and stores the given `reason`.

Each decision also writes the pet parent's in-app notice ("Approved", or "Not accepted" with the reason) in the same transaction. A notice that cannot be written never undoes the decision. See [booking-notifications.md](booking-notifications.md).

The signed-in manager is recorded as the reviewer (`booking_pets.reviewed_by_uuid`) on approve and
refuse, and cleared on undo or when a guest's date change sends the stay back to review.

On a request paid at request, a decision moves money in the same transaction once no pet on the
booking waits any more: the confirmed pets are charged from the hold and the rest released (with no
pet confirmed, the whole hold is released). Refusing a pet already charged refunds its price; the
last one settles the booking. Undo answers `409 BOOKING_ALREADY_PAID` once the stay is charged: use
"Cancel without a fee" to give the money back. A request nobody decides within 24 hours (or by
drop-off) is refused by the review job with no reviewer; managers get a "Decision due soon" notice in
the bell four hours before.

On an older request made with a saved card, a decision keeps the card in step with the pets Wagstay
agreed to, in the same transaction:

- Approving lets the 48-hour job hold the approved pets' total (at once when drop-off is already
  within 48 hours). If the card already holds an earlier total, that hold is released and the job
  holds the new one.
- Refusing means Wagstay cannot take the pet. Refusing the last pet still on the booking releases
  the card in full (or stops a hold from being placed); refusing one of several approved pets
  releases the hold so the job holds the smaller total.
- Undoing an approval releases the hold in the same way.

A decision answers `409` once the pet has arrived (record "We can't take this pet" at the desk
instead, §10) or once the booking is settled.

- Route: [`Backend/src/routes/manager.booking.routes.ts`](../Backend/src/routes/manager.booking.routes.ts)
- Controller: [`Backend/src/controllers/manager.booking.controller.ts`](../Backend/src/controllers/manager.booking.controller.ts)
- Service: [`Backend/src/services/manager.booking.ts`](../Backend/src/services/manager.booking.ts)
- Repository: [`Backend/src/repositories/manager.booking.repository.ts`](../Backend/src/repositories/manager.booking.repository.ts)

## 8. Undoing a decision

|               |                                                     |
| ------------- | --------------------------------------------------- |
| Method & path | `PATCH /api/admin/bookings/:id/undo`                |
| Auth          | Same as above: `requireManager`                     |
| `:id`         | `booking_pets_uuid`                                 |
| Request body  | None                                                |
| Success       | `204 No Content`                                    |
| Errors        | `404` if `:id` doesn't match any `booking_pets` row |

Reverts `manager_review_status` back to `'pending'` and clears `refusal_reason`. The booking-pet reappears in the Booking tab, and the pet parent gets a "Back in review" notice unless the pet was already waiting ([booking-notifications.md](booking-notifications.md)). If the decision being undone was an approval, **the tasks that approval generated are deleted first**, in the same request.

Undo answers `409` once the pet has arrived, and once the booking is settled (its card hold was
released or charged): the guest then needs to book again.

A refused or cancelled pet no longer counts against the nightly capacity, so its place may have been
booked since. Undoing that refusal, or approving such a pet, first checks its nights under the
capacity lock and answers `409 CONCIERGE_FULLY_BOOKED` with the full nights when one has no room.
Approving or undoing a pet that is pending or approved changes nothing about capacity: it was
already counted.

- Route: [`Backend/src/routes/manager.booking.routes.ts`](../Backend/src/routes/manager.booking.routes.ts)
- Controller: [`Backend/src/controllers/manager.booking.controller.ts`](../Backend/src/controllers/manager.booking.controller.ts): `undoBookingReview`
- Service: [`Backend/src/services/manager.booking.ts`](../Backend/src/services/manager.booking.ts): calls `deleteTasksForBookingPet` then `resetBookingPetReview`
- Repository: [`Backend/src/repositories/manager.booking.repository.ts`](../Backend/src/repositories/manager.booking.repository.ts): `resetBookingPetReview`
- Task deletion: [`Backend/src/services/task.fromBooking.service.ts`](../Backend/src/services/task.fromBooking.service.ts): `deleteTasksForBookingPet`

### Task generation on approve

Approving (§7) also calls `createTasksForBookingPet(bookingPetsUuid)` ([`task.fromBooking.service.ts`](../Backend/src/services/task.fromBooking.service.ts)), which:

- Reads that booking-pet's services and intake answers ([`findBookingPetTaskInput`](../Backend/src/repositories/task.fromBooking.repository.ts)) and builds task specs ([`task.fromBooking.mapping.ts`](../Backend/src/services/task.fromBooking.mapping.ts)): Feeding (morning/evening, every night), Grooming (once), Extra Playtime / Medication Administration / Outdoor Walk (once per night when applicable).
- Inserts into `tasks` with a dedupe guard on `(pet_uuid, title, scheduled_at)`, so re-approving the same booking-pet is a no-op.
- Publishes a `task-updated` event for that pet so an open Live Care page refreshes (see `docs/task-timeline-booking-scope.md`).

**Known limitation:** `tasks` has no `booking_pets_uuid` column. Both task generation dedup and Undo's deletion identify "this booking's tasks" by date window (`scheduled_at` within `drop_off_time`..`pick_up_time`), not by a real foreign key. If the same pet has two bookings with overlapping stay dates, generation/dedup/deletion can cross between them.

## 9. Downstream effect: one stay status for the pet list and the owner's pages

`manager_review_status` isn't only read here. The Petlist and the Pet Profile header name each pet
by one of its stays with the same rule the owner's pages use (`Backend/src/services/stay-status.ts`),
so staff and owners never call the same stay two things (owner decision of 2026-10-05):

- `PET_ROW_QUERY` in `Backend/src/repositories/pet.repository.ts` picks the stay that says where the
  pet is: one under way, else the next one, else the last one. Only requests that still stand
  (`pending` or `approved`) count; a refused or cancelled request does not say where the pet is.
  That stay's dates are `checkInDate` and `checkOutDate`.
- `status` is that stay's status (`waiting_for_review`, `approved`, `staying_now`, `stay_ended`,
  `did_not_arrive`, `refused` or `cancelled`), or `no_stay`. The desk record decides first: a
  no-show is `did_not_arrive`, a pet Wagstay could not take is `refused`, and a pet checked in is
  `staying_now` from that moment until its pick-up time.
- `pets.status` is no longer read or written. It held one value per pet, set by Check in and Check
  out buttons on the dashboard, and a check-out stuck across later stays. Arrivals are recorded on
  the stay at the desk (§10); `PATCH /api/admin/pets/:id/status` was removed, and a profile update
  no longer accepts a status.

So refusing or undoing a booking not only stops task generation (§7-8). It also changes which stay
names the pet, and its status, on the Petlist and the Pet Profile.

A manager refuses a stay with one of the preset reasons in `Frontend/src/shared/booking/refusalReasons.ts`
(owner decision of 2026-10-05), not free text. The English sentence is stored in
`booking_pets.refusal_reason` as before, and the pet parent pages show it in the parent's language. A
reason typed before the presets has no translation, so the Chinese pages say it was written in English
and show the words only when the parent asks.

The bookings page tabs read Waiting for review, Confirmed, Refused and Cancelled, and a waiting
request is marked OVERDUE once its drop-off date has passed in Auckland.

## 10. The desk: arrivals, finishing check-in, and cancelling without a fee

For requests made on the booking page, guaranteed by a saved card, and only for the pets a manager
approved: a request nobody decided is not a booking and never reaches the desk. The fee rules are in
[`Backend/src/services/booking.fee-policy.ts`](../Backend/src/services/booking.fee-policy.ts); the
desk service is [`Backend/src/services/booking.check-in.ts`](../Backend/src/services/booking.check-in.ts).

|                                                                  | Body                                   | Success                                   |
| ---------------------------------------------------------------- | -------------------------------------- | ----------------------------------------- |
| `PATCH /api/admin/bookings/:id/check-in`                         | `{ "outcome": ... }`                   | `204`                                     |
| `POST /api/admin/bookings/by-booking/:bookingId/finish-check-in` | none                                   | `200 { "result": ..., "amount": number }` |
| `POST /api/admin/bookings/by-booking/:bookingId/cancel`          | `{ "reason": string }`                 | `204`                                     |
| `POST /api/admin/bookings/by-booking/:bookingId/reschedule`      | `{ "startDate", "endDate", "reason" }` | `200` the new dates and total             |

`check-in` and `finish-check-in` need `requireEmployee`, except that only a manager may record
`'wagstay_unable'`; `cancel` and `reschedule` need `requireManager`. `:id` is a
`booking_pets_uuid`; `:bookingId` is a `booking_id`.

**Recording an arrival** (`check-in`) is per approved pet, from the drop-off day in Auckland:
`'checked_in'` (full price for the pet), `'no_show'` (the pet did not come, or its vaccination
certificate could not be supplied that day: half its stay under the pay-at-request terms; under the
older terms first-night recurring services, capped at its total), or `'wagstay_unable'` (nothing). It can be changed until check-in is finished. `409` before the
drop-off day, for a refused or cancelled pet, and for a settled booking.

**Finishing check-in** needs an outcome for every pet still on the booking (`409
CHECK_IN_INCOMPLETE` otherwise). It works out the amount (never more than the hold) and moves money
once, inside a transaction that locks the booking's payment row:

| Payment before                          | Amount due | What happens                                            | `result`      |
| --------------------------------------- | ---------- | ------------------------------------------------------- | ------------- |
| `authorized` (held)                     | > 0        | Captured from the hold; the processor releases the rest | `charged`     |
| `authorized` or `pending`               | 0          | Hold released, or none placed                           | `released`    |
| `pending` (no hold in time)             | > 0        | Charged at once from the saved card                     | `charged`     |
| `pending`                               | > 0        | That charge was declined; take payment at the desk      | `declined`    |
| `failed` (hold refused before drop-off) | any        | Nothing is tried; take payment at the desk              | `card_failed` |
| `succeeded`, nothing settled (paid)     | > 0        | That amount is kept; the rest is refunded to the card   | `charged`     |
| `succeeded`, nothing settled (paid)     | 0          | Everything is refunded                                  | `released`    |

A capture uses the idempotency key `capture-booking-<bookingId>`, a charge
`charge-booking-<bookingId>` and a refund `refund-desk-<payment intent>`, so a retry never moves
money twice. Processor trouble answers
`502 CARD_PROCESSOR_ERROR` and saves nothing; a server without the processor the card was saved
with answers `503`.

**Cancelling without a fee** (`cancel`) is for the exceptions in the booking terms: a civil defence
emergency, a MetService red warning, or a pet a vet says is too unwell to board. It cancels every
pet on the booking that has not arrived (`manager_review_status = 'cancelled'`, the reason in
`refusal_reason`), releases the card hold in full or refunds a paid stay in full, and removes
those pets' tasks. `409` once a pet
has arrived or the booking is settled.

**Moving a stay without a charge** (`reschedule`) is for the same exceptions. It moves every pet on
the booking to the new dates (`YYYY-MM-DD` in Auckland; each pet keeps its time of day), prices them
at the rates booked, and needs room on every new night (`409 CONCIERGE_FULLY_BOOKED` names the full
ones). It does not use the guest's own free change, and the pets keep the decisions staff already
made: the old hold is released, the 48-hour job holds the approved pets' price for the new dates,
and each approved pet gets a care plan for the new dates. The reason has no column of
its own, so it is kept as a notice for every active manager (`notification_setting =
'booking_moved_by_staff'`). Guests move their own stay once from My Stays
(`POST /api/petparent/bookings/:bookingId/reschedule`, see `docs/ai-booking-concierge.md`).

### Approval-based cancellation and date changes (2026-09-30)

Apply `20260930_booking_approval_time.sql` before running this version. The migration is supplied,
not applied to a live database. `booking_pets.approved_at` records real approval transitions;
repeat approval preserves the timestamp and reset/refusal clears it. Historical unknown approval
times remain null and cancellation does not impose a fee on those pets.

Cancellation is calculated for each approved pet: free at least 72 hours before drop-off, within
2 hours of approval, or within 24 hours of approval when approval was at least 72 hours ahead.
Otherwise the fee is one night of recurring services, excluding flat extras and capped at that
pet's total. Pending pets are free to withdraw. No-shows use the same first-night amount, but
staff must record the outcome. Online cancellation stops at drop-off.

A guest moving their own stay releases the old hold and resets the moved pets to pending review:
the manager agreed to the old dates only. Every active manager gets a notice to review it again,
and the parent gets a "Back in review" notice (and an email when SES is set up). No new hold is
placed until the manager approves again, and the old dates' care plans are removed. Staff moving a
stay for an emergency keep their decisions: the old hold is released, the 48-hour job holds the
approved pets' price for the new dates, and approved pets get a care plan for the new dates.
Capacity and the one-free-change limit still apply. The 48-hour reminder states the first-night
fee when one applies (it does not change before drop-off) and always points to the current fee
preview in My Stays; it never promises a free cancellation, which this close to drop-off ends two
hours after approval.

### Online consent and terms version

Apply `20260930_booking_terms_manager_review.sql` and then
`20261001_booking_terms_auto_confirm.sql` before accepting bookings with this release. The current
version is `concierge-terms-2026-10-01`, including emergency veterinary treatment up to NZ$500
when the owner cannot be reached. It does not rewrite old agreements.
Checkout rejects a stale or unavailable version with HTTP 409 `TERMS_VERSION_CHANGED`, before
account creation and again under a terms-row lock inside the booking transaction. The signer
comes from the owner record, never a client-supplied `agreement.fullName`.
New requests require only vaccination proof at drop-off; older bookings retain their consent
checks. The cap is the owner's product decision, not a statutory amount.
Source checked: [MPI temporary housing code, minimum standard 4(g)](https://www.mpi.govt.nz/animals/animal-welfare/codes/all-animal-welfare-codes/code-of-welfare-temporary-housing-of-companion-animals).

### Request and review email delivery

With `CONCIERGE_EMAIL_MODE=ses` and valid SES configuration, request receipt, approval and refusal
events send the same factual content as the parent notice. Emails are sent only after the
booking/decision transaction commits; repeating an unchanged decision produces no email.
The recipient lookup is restricted to the owner of that booking. Missing SES leaves in-app
notices only. Delivery failures are logged without recipient/message content and never undo
the request or decision. This is best-effort delivery; failed event emails have no automatic
retry/outbox. Real SES delivery has not been exercised by the local tests.
