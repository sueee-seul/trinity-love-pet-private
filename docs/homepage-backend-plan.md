# Backend plan: pet-parent homepage, Vaccination information, and vaccination upload

> **Status:** Phase 2 is implemented. Phase 1 was built on 2026-09-29, but not as §3 describes: the parent gives the certificate after the request, on the Vaccination information page (`PUT /api/petparent/vaccination/:bookingPetId`, one multipart request, no presigned upload). The file type is checked by its first bytes, and the file is kept on the backend's disk (`Backend/storage/vaccination-certificates`), not in the public object storage bucket, and is only streamed by authenticated endpoints. `vaccination_document_url` holds the random file name and no response carries it. See the "Vaccination information" routes in [Backend/README.md](../Backend/README.md). Phase 3 (admission verification) is not built. Stay stories (formerly Phase 3a, §5.2 below) was implemented and then removed. It is not being built yet, so §5.2 is kept only as a historical record and no longer describes live code. A stay under way is neither upcoming nor past and does not change the state (open question 2).

Covers the backend work needed for three frontend pieces:

1. **Step 3 booking info:** the new required vaccination certificate upload (already built in the frontend, held in memory only).
2. **Vaccination information page:** opened from the homepage "Before the stay" checklist (see [homepage-ui-design-prompt.md](homepage-ui-design-prompt.md) §8).
3. **Pet-parent homepage:** five states (A, B1, B2, C1, C2), the checklist and Quick actions (§2, §5 to §7 of the same doc).

The work is split into three phases. Phase 1 is independent and unblocks the most; Phase 2 depends on it for the vaccination checklist item; Phase 3 (Admission verification) still needs a product decision, see [Open questions](#open-questions).

---

## 1. What exists today

| Area             | Where                                                                                                                                        | Notes                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Booking creation | `POST /api/concierge/checkout` ([concierge.checkout.ts](../Backend/src/services/concierge/concierge.checkout.ts))                            | The old `POST /api/petparent/bookings` (card fields, mock charge) was removed on 2026-09-29. The concierge checkout uses the same repository write: one transaction inserts `bookings` → `booking_pets` → services → `booking_pets_caring_info` → `bookings_agreements` → `payment_methods` → `booking_payments`, and sets `status = 'paid'`. A booking never exists in a "half done" state. |
| Owner's pets     | `GET /api/petparent/pets`                                                                                                                    | Booking-flow pet list.                                                                                                                                                                                                                                                                                                                                                                       |
| Owner's stays    | `GET /api/petparent/stays` ([petparent.stays.ts](../Backend/src/services/petparent.stays.ts))                                                | One summary per `booking_pets` row with the parent stay status (`waiting_for_review / approved / staying_now / stay_ended / refused / cancelled`, from the manager's decision and the clock, see `toStayStatus` and Backend/README.md). **No booking id, service type or night count**, so it cannot group multi-pet bookings or fill the hero.                                              |
| Owner's bookings | `GET /api/petparent/bookings`                                                                                                                | Per `booking_pets` row with services, nights, total, `caringInfo` (includes `fullyVaccinated`, not the document), and the manager's decision: `status`, `reviewStatus` and `refusalReason`.                                                                                                                                                                                                  |
| Object storage   | [object.storage.ts](../Backend/src/services/object.storage.ts), [profile.media.storage.ts](../Backend/src/services/profile.media.storage.ts) | S3-compatible (Neon bucket). Presigned **PUT** upload, `headObject` verification, owner-scoped key prefix, public read URL. Profile media is images only, 30 MB.                                                                                                                                                                                                                             |
| Admin bookings   | `GET /api/admin/bookings`                                                                                                                    | Returns `has_vaccination_certificate` and `vaccination_document_uploaded_at` in `booking_caring_info`, never the storage key. Staff open the file with `GET /api/admin/vaccination-certificates/:bookingPetId`.                                                                                                                                                                              |
| Schema           | [neon.sql](../Backend/database/neon.sql)                                                                                                     | `vaccination_document_url` and `vaccination_document_uploaded_at` were added by `Backend/src/data/migrations/20260929_booking_cancel_and_vaccination_document.sql` (owner-approved, applied to the Trinity Neon database). `neon.sql` is owner-controlled and does not list them yet.                                                                                                        |

Not present anywhere: a vaccination upload endpoint, any "admission verification" concept, a homepage/summary endpoint, and any stay-story data.

---

## 2. Frontend needs vs. backend gaps

| Frontend element                                                        | Data needed                                                        | Status                                             |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------- |
| Step 3 upload                                                           | Pre-booking file upload; persist URL on booking                    | **Gap** → Phase 1                                  |
| Vaccination page: question, upload, Save                                | Read/update one pet's vaccination status + document, after booking | **Gap** → Phase 1                                  |
| Vaccination page: "Certificate received 2 Sep" for other pets           | Upload timestamp per pet                                           | **Gap** → new column, Phase 1                      |
| Homepage state A/B/C                                                    | Pet count, upcoming stay, past-stay count                          | Derivable from existing endpoints, but see Phase 2 |
| Homepage greeting                                                       | Owner first name                                                   | `GET /api/parent/profile`                          |
| Your pets                                                               | name, species, breed, age, photo                                   | `GET /api/petparent/pets`                          |
| Hero: "Max's stay is coming up", dates, nights, service, "5 days to go" | Booking id, pets in the booking, service type, nights, days-to-go  | **Gap** (stays endpoint lacks these) → Phase 2     |
| Checklist: Agreement signed, Booking payment completed                  | Row existence / payment status                                     | Derivable, Phase 2                                 |
| Checklist: Vaccination information                                      | `fully_vaccinated` **and** document present                        | Phase 1 data, Phase 2 rule                         |
| Checklist: Admission verification                                       | Unknown                                                            | **Undefined** → Phase 3                            |

---

## 3. Phase 1: Vaccination document (upload and persistence)

### 3.1 Schema

Canonical schema is [neon.sql](../Backend/database/neon.sql) (used by `npm run db:reset`); the files in `Backend/src/data/migrations/` are hand-applied artifacts. Do both:

- Keep the `vaccination_document_url` column already in `neon.sql`, and add a timestamp for the "Certificate received 2 Sep" line:

  ```sql
  ALTER TABLE booking_pets_caring_info
    ADD COLUMN IF NOT EXISTS vaccination_document_url TEXT,
    ADD COLUMN IF NOT EXISTS vaccination_document_uploaded_at TIMESTAMPTZ;
  ```

  (Fold both into the `CREATE TABLE` in `neon.sql` if that file is meant to stay a full schema rather than an append log.)

- Add `Backend/src/data/migrations/20260921_add_vaccination_document_to_caring_info.sql` with the statement above so already-provisioned Neon databases can be updated.
- Invariant to enforce in code (a `CHECK` is optional): `vaccination_document_url IS NOT NULL` only when `fully_vaccinated = true`.
- Check [validate-postgres-api-test-schema.mjs](../Backend/scripts/validate-postgres-api-test-schema.mjs) still passes against the new columns.

### 3.2 Upload endpoint (presigned PUT)

The booking is created in one request at payment time, so the certificate has to be uploaded **before** a booking exists. Reuse the profile-media pattern rather than sending files through the API (the JSON body limit is 2 MB).

`POST /api/petparent/vaccination-documents/upload-url`: `requirePetParent`, `requireTrustedOrigin`

```jsonc
// request
{ "fileName": "max-vaccination.pdf", "contentType": "application/pdf", "size": 1843200 }
// response
{ "uploadUrl": "https://…", "objectKey": "vaccination/<ownerId>/<uuid>/max-vaccination.pdf",
  "expiresIn": 300, "headers": { "Content-Type": "application/pdf" } }
```

- **Validation (zod, strict):** `contentType` in `application/pdf`, `image/jpeg`, `image/png`, `image/heic`, `image/heif`; `size` integer, `1 … 10 * 1024 * 1024`; `fileName` 1 to 255. Extension must agree with the content type. Browsers often report an empty MIME type for HEIC, so the frontend should derive `contentType` from the extension (it already accepts by extension).
- **New module** `vaccination.document.storage.ts`, modelled on `profile.media.storage.ts`: constants, key builder (`vaccination/{ownerId}/{uuid}/{sanitisedName}`), `assertVaccinationDocumentKey(key, ownerId)` (prefix + no `.`/`..` segments), `assertStoredObject` (`headObject` → content type allowed, `0 < length ≤ 10 MB`).
- **Hard size limit:** a presigned PUT does not enforce size, only the after-the-fact `headObject` check does. If a hard cap matters, switch to a presigned POST with `content-length-range` (adds `@aws-sdk/s3-presigned-post`); otherwise accept the `headObject` check plus a bucket lifecycle rule.
- **Cleanup:** `DELETE /api/petparent/vaccination-documents/upload` (same as `profile-media`'s cleanup) for when the parent clicks Remove/Replace before submitting. Also add a lifecycle rule expiring unreferenced `vaccination/` objects after ~7 days for abandoned wizards.

### 3.3 Privacy: private storage, signed reads (decision needed)

Certificates carry the owner's name and vet details. Profile media is served from a public URL with `Cache-Control: public, immutable`; do **not** copy that for certificates.

Recommendation: private prefix, store the **object key** (or a URL that is never served directly), and hand out **short-lived presigned GET URLs** (5 to 15 min) wherever a document is returned. Add `createPresignedGetObjectUrl(key, ttl)` to `object.storage.ts` (`@aws-sdk/s3-request-presigner` is already a dependency). Send `Cache-Control: private, no-store` on uploads.

Impact: the `GET /api/admin/bookings` change made earlier returns the raw column value; with this approach [manager.booking.ts](../Backend/src/services/manager.booking.ts) must sign it before responding. The response shape does not change, only the value becomes a temporary URL. Update [admin-bookings-api.md](admin-bookings-api.md) to say the URL expires.

### 3.4 `POST /api/petparent/bookings` changes

> **Removed:** this endpoint was deleted on 2026-09-29, so this section is only a record. New bookings come through the concierge checkout.

In `bookingPetInfoSchema` add `vaccinationDocumentKey: z.string().nullable()` (the object key from 3.2, matching 3.3) and refine per pet:

- `fullyVaccinated === true` → document required, else `422 VALIDATION_FAILED` ("Upload a vaccination certificate for <pet>").
- `fullyVaccinated !== true` → document must be `null`.
- Key must pass `assertVaccinationDocumentKey(key, actor.id)` and `assertStoredObject` (ownership and existence) **before** the transaction starts.
- Persist `vaccination_document_url` and `vaccination_document_uploaded_at = now()` in the existing `booking_pets_caring_info` `INSERT`.

Also thread the field through `BookingPetInfoInput`, `CreateBookingPetInput.info`, and `MyBookingCaringInfo` (returned as a signed URL or `hasVaccinationDocument: boolean`, see 3.6).

### 3.5 Vaccination information page endpoints (post-booking)

Both scoped to a `booking_pets.uuid`; the service verifies the stay belongs to the caller (join through `bookings.pet_owners_uuid`) and returns `404` rather than `403` for someone else's id.

`GET /api/petparent/bookings/:bookingPetId/vaccination`

```jsonc
{
  "bookingPetId": "…",
  "petName": "Max",
  "stay": { "dropOffAt": "…", "pickUpAt": "…", "serviceType": "Overnight boarding" },
  "fullyVaccinated": true,
  "document": { "url": "<signed>", "uploadedAt": "2026-09-02T…" }, // null when none
  "otherPets": [
    { "bookingPetId": "…", "petName": "Luna", "status": "received", "receivedAt": "…" },
  ],
}
```

`PUT /api/petparent/bookings/:bookingPetId/vaccination`

```jsonc
{ "fullyVaccinated": true, "vaccinationDocumentKey": "<objectKey from 3.2>" } // or false + null
```

- Yes requires a valid, owned, existing object; No clears the document and deletes the old object (best effort, after commit).
- Replacing a document deletes the previous object after commit.
- Only allowed while the stay has not started (`drop_off_time > now()`); after that return `409 STAY_ALREADY_STARTED`. (Open question 4.)
- Returns the refreshed checklist state for that pet so the frontend can flip the row to Done without refetching.

### 3.6 Read paths

| Endpoint                                                                          | Change                                                                        |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `GET /api/petparent/bookings`                                                     | Add `vaccinationDocument: { url, uploadedAt } \| null` to `caringInfo`        |
| `GET /api/admin/bookings`                                                         | Sign `vaccination_document_url` (3.3); add `vaccination_document_uploaded_at` |
| Google-review investigation / chatbot repositories that select `fully_vaccinated` | No change needed                                                              |

### 3.7 Tests (vitest; follow existing `*.test.ts` layout)

- Unit: content-type/size/extension validation; key prefix and traversal rejection; `assertStoredObject` failure cases (missing object, wrong type, too large); booking schema refinements (Yes without document, No with document).
- Service: booking creation persists the document and timestamp; PUT vaccination Yes/No/replace; another owner's `bookingPetId` returns 404.
- API (`api.postgres.*`): create booking with and without a certificate; admin bookings returns the field.
- Mock `object.storage.ts`; no real S3 in unit tests.

### 3.8 Frontend follow-ups this unlocks

- Step 3 currently keeps a `File` in state and never sends it. On Continue (or on file selection) request an upload URL, `PUT` the file, keep the `objectKey`, and send it in `info[].vaccinationDocumentKey` at step 5. `File` also cannot survive a refresh, so store `objectKey` rather than the `File` after upload.
- Build the Vaccination information page against 3.5.

---

## 4. Phase 2: Homepage aggregate endpoint

### 4.1 Why one endpoint

The homepage state (A / B1 / B2 / C1 / C2), "days to go", the multi-pet hero title and the checklist are business rules. Computing them in the frontend from `/pets` + `/stays` + `/bookings` means three requests, duplicated date logic, and a stays payload that lacks the booking id and service type. One read-only endpoint keeps the rules server-side and testable.

`GET /api/petparent/home`: `requirePetParent`, read-only.

### 4.2 Response

```jsonc
{
  "state": "C2", // 'A' | 'B1' | 'B2' | 'C1' | 'C2'
  "owner": { "firstName": "Phuong" },
  "pets": [
    {
      "id": "…",
      "name": "Max",
      "species": "dog",
      "breed": "Labrador",
      "ageYears": 4,
      "photoUrl": null,
    },
  ],
  "hasPastStays": true,
  "upcomingStay": {
    // null in states A and B*
    "bookingId": "…",
    "confirmationNumber": "…",
    "status": "paid",
    "dropOffAt": "…",
    "pickUpAt": "…",
    "nights": 4,
    "daysToGo": 5,
    "serviceType": "Overnight boarding",
    "pets": [{ "bookingPetId": "…", "petId": "…", "name": "Max" }],
    "checklist": [
      { "key": "agreement", "label": "Agreement signed", "status": "done" },
      { "key": "payment", "label": "Booking payment completed", "status": "done" },
      {
        "key": "vaccination",
        "label": "Vaccination information",
        "status": "outstanding",
        "bookingPetIds": ["…"],
      },
      { "key": "admission", "label": "Admission verification", "status": "outstanding" },
    ],
  },
  "stayStories": [/* Phase 3; [] until then */],
}
```

The checklist always has all four items in this fixed order (the design forbids reordering). Labels are supplied by the server so the frontend does not duplicate them; the frontend still owns Quick-action labels, greeting copy and layout.

### 4.3 State resolution

Work on `booking_pets` of bookings with `status IN ('paid','confirmed')` for this owner, grouped by `bookings.uuid`. Each pet first gets its parent stay status from `toStayStatus` (the manager's decision plus the clock):

```
pets = owner's pets
upcoming = pending or approved pets with drop_off_time > now(), grouped by booking, soonest first  → hero owner = first
past     = approved pets whose stay ended (status stay_ended)
refused pets with drop_off_time > now() → needsAttention ("Try other dates"); cancelled pets show nowhere

no pets                          → A
upcoming exists, no past         → C1        upcoming exists, has past → C2
no upcoming, no past             → B1        no upcoming, has past     → B2
```

If a booking has several pets, `upcomingStay.pets` lists all of them (hero reads "Max and Luna's stay is coming up"). "Days to go" and "upcoming" must be computed in the **facility's timezone**: `scheduled_at`-style columns in this codebase store wall-clock digits (see the comment in `petparent.livecare.ts`), and `drop_off_time` is written by the concierge checkout with `newZealandWallClockToDate` in Auckland time (the old `combineDateAndTime` was removed with the six-step form on 2026-09-29). Verify how it is stored before writing the query, and add a test around midnight.

An in-progress stay (`drop_off_time <= now() < pick_up_time`) is not covered by the design; see Open question 2.

### 4.4 Checklist rules

| Item          | `done` when                                                                                               | Notes                                                                                                                                                                                                                                                |
| ------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `agreement`   | a `bookings_agreements` row exists for the booking                                                        | Always true today, since it is written in the same transaction as the booking. Implement it anyway so the item is real if booking creation is ever split.                                                                                            |
| `payment`     | a `booking_payments` row with `status = 'succeeded'` exists                                               | Same caveat.                                                                                                                                                                                                                                         |
| `vaccination` | **every** pet on the booking has `fully_vaccinated = true` **and** `vaccination_document_url IS NOT NULL` | Matches the design (Done only after Yes plus an upload). `bookingPetIds` lists the pets still outstanding so the row links to the right pet. Existing bookings with `fully_vaccinated = true` and no document read as outstanding (Open question 1). |
| `admission`   | Phase 3                                                                                                   | Return `outstanding` (non-tappable) until defined.                                                                                                                                                                                                   |

The hero's status pill follows the manager's decision, not `bookings.status`: "Waiting for review" until the manager approved every pet on the booking, then "Approved" (see `toStayStatus`).

### 4.5 Implementation notes

- New `petparent.home.ts` service and `petparent.home.repository.ts`; controller and route mounted at `/api/petparent/home` in [server.ts](../Backend/src/server.ts). Keep the state-resolution and checklist functions **pure** (input rows → output) so they are unit-tested without a database.
- Reuse `toStayStatus`, `nightsBetweenTimestamps` and `toConfirmationNumber` rather than re-deriving them.
- Add `bookingId`, `serviceType` and `nights` to `GET /api/petparent/stays` as a non-breaking extension, for the "past stays" and "View booking" screens.
- Tests: one fixture per state (A, B1, B2, C1, C2), multi-pet booking, two upcoming bookings (soonest wins), vaccination partially complete, another owner's data never leaks.

---

## 5. Phase 3: Admission verification

Admission verification still needs a product decision before any code, so it stays a sketch.

### 5.1 Admission verification

Today there is no such concept. The design describes it as a checklist item that is outstanding until done, and requires every outstanding item to be tappable and resolvable in-app, but does not say what the parent does for it. Two plausible readings:

- **Staff-side verification** (matches the _Code of Welfare_ "assessment on admittance" cited in §8.5): staff check the pet, and the vaccination certificate, at drop-off. Add `booking_pets.admission_verified_at TIMESTAMPTZ` and `admission_verified_by UUID REFERENCES employees(users_uuid)`, a staff action (`POST /api/admin/bookings/:bookingPetId/admission-verification`) and optionally an approve/reject step on the uploaded certificate. The parent-facing row would be informational, so the design's "always tappable" rule needs an exception.
- **Parent-side pre-admission step**: the parent supplies something more (e.g. vet contact, emergency contact). That needs a form spec from design.

### 5.2 Stay stories: removed, not currently planned

This was built (AI-written narrative + up to three photos per completed stay,
`booking_pets.narrative`/`narrative_updated_at`, a background generation
worker, `GET /api/petparent/stay-stories/:bookingPetId`, and a homepage
section) and has since been fully removed. It is not being implemented yet.
The columns were dropped in
`20260923_drop_narrative_from_booking_pets.sql`. `state` (B2/C2) and
`hasPastStays` are unaffected: they were always based on completed stays, not
on stories. If this is revisited, see the original design in git history
around commit `6bdc86a` (the commit that first added the homepage and stay
stories) for the prior schema, generation-prompt constraints and read-path
details.

---

## 6. Cross-cutting

- **Auth:** every route uses `requirePetParent`; uploads and mutations also use `requireTrustedOrigin`. Ownership is always checked by joining to `bookings.pet_owners_uuid` / `pets.pet_owners_uuid`, never by trusting an id in the URL.
- **Errors:** use `AppError(message, code, status)`; new codes `VALIDATION_FAILED` (422), `NOT_FOUND` (404), `STAY_ALREADY_STARTED` (409).
- **Config:** object storage env vars already exist (`AWS_ENDPOINT_URL_S3`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `NEON_S3_BUCKET`). Confirm the bucket supports private objects and presigned GET, and configure CORS for browser `PUT` from the frontend origins.
- **Docs to update:** [admin-bookings-api.md](admin-bookings-api.md) (URL field and expiry), the route reference in [Backend/README.md](../Backend/README.md), and a new `petparent-home-api.md` when Phase 2 lands.

## 7. Suggested order

1. Phase 1: migration, upload URL endpoint, booking schema and persistence, admin signing, tests. Then the Step 3 wiring on the frontend.
2. Phase 1b: `GET`/`PUT …/vaccination` for the Vaccination information page.
3. Phase 2: `GET /api/petparent/home` with agreement, payment and vaccination checklist items; admission item returned as outstanding.
4. Phase 3: Admission verification, after question 5 below is answered.

---

## Open questions

1. **Bookings without a certificate.** Existing rows with `fully_vaccinated = true` and no document: show the checklist item as outstanding (strict, matches the design's "only after upload"), or as done (lenient, nobody is nagged about old bookings)? Recommendation: strict for bookings whose stay has not started.
2. **In-progress stays.** The design defines no state for a stay that is currently under way (Quick actions mention Live Care "when a stay is active"). Should an active stay own the hero, with a Live Care card in place of the checklist? Needs a design.
3. **Private vs public certificates** (3.3). Recommendation is private with signed URLs; needs a check that the Neon bucket supports it.
4. **Editing after the stay starts.** Block updates once drop-off has passed (proposed), or allow staff-only changes?
5. **Admission verification:** what is it, who performs it, and what does the parent see? (5.1)
6. **Certificate review.** Does staff need to approve or reject a certificate, or is the upload itself enough for the checklist to turn Done? The design says upload is enough; a staff-approval step would add a third state.
