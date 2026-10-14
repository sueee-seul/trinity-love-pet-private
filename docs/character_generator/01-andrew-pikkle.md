# Character Set 01: Andrew and Pikkle

## Scenario introduction

Andrew is a registered WagStay user and completed pet-owner profile who has genuinely used the service. His pet is Pikkle, an adult golden Labrador Retriever. Andrew brings Pikkle to stay from **26 July 2026 at 12:00** until **7 August 2026 at 15:00**. The booking uses three services: **Deluxe suite**, **House food**, and **Extra playtime**.

After the stay, Andrew publishes a **Praise**-direction Google Business Review on **10 August 2026**. The review is accompanied by two lifestyle photos of Pikkle: one outdoors in a garden and one resting indoors. This is a synthetic character-set scenario for later data matching; this document does not create database rows or claim that the scenario is live customer data.

## Character identity

```yaml
scenario_key: andrew-pikkle-001
owner:
  display_name: Andrew
  first_name: Andrew
  last_name: Carter
  account_state: registered_wagstay_user
  pet_owner_profile: required
  reviewer_identity: required
  reviewer_provider: google
  reviewer_identity_association: same-person scenario context; neon.sql has no FK between users and reviewer_identities
  synthetic_username: andrew.pikkle
  synthetic_email: andrew.c@gmail.com
  synthetic_phone: +64 21 555 0178
  synthetic_address: 12 Kowhai Street, Grey Lynn, Auckland 1021
  credential_file: ./andrew-credentials.local.md (ignored; local-only)
  password_handling: provision separately and store only as password_hash
  avatar_asset: ../../Frontend/src/assets/andrew-avatar.png
pet:
  name: Pikkle
  species: dog
  breed: Labrador Retriever
  display_breed: Labrador
  age_years: 4
  weight_kg: 31.4
  colour: golden yellow
  diet_notes: House food served as two measured meals each day.
  allergies: No known allergies.
  behaviour_notes: Friendly and energetic; enjoys structured play and settles well after exercise.
  persisted_pet_record: expected in a later data-match fixture, not created by this document
```

The surname, contact details, and Pikkle's numeric profile values are synthetic placeholders needed to make a future `users`, `pet_owners`, and `pets` mapping complete. Andrew remains the user-facing display name requested for this scenario. The supplied login credential is stored only in the ignored local file [`andrew-credentials.local.md`](andrew-credentials.local.md); the database mapping must store only its password hash.

## Pet image assets

These are visual identity references and intended review attachments. They are not automatically `pets.image_url` values and are not database rows yet.

| Asset                                                                                                | Scene                                      | Intended role                                   |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------- |
| [`andrew-avatar.png`](../../Frontend/src/assets/andrew-avatar.png)                                   | Andrew head-and-shoulders profile portrait | User/avatar asset reference                     |
| [`golden-labrador-pikkle-garden.png`](../../Frontend/src/assets/golden-labrador-pikkle-garden.png)   | Pikkle standing calmly in a garden         | Review photo attachment and character reference |
| [`golden-labrador-pikkle-resting.png`](../../Frontend/src/assets/golden-labrador-pikkle-resting.png) | Pikkle resting indoors after play          | Review photo attachment and character reference |

When these images are later submitted through the review modal, the persisted representation is a URL in `google_review_media_logs.photo_url`. The image type does not need its own stored field.

## Booking and service context

```yaml
booking:
  status: confirmed
  drop_off_time: 2026-07-26T12:00:00+12:00
  pick_up_time: 2026-08-07T15:00:00+12:00
  calculated_stay_nights: 12
  service_usage_truth: verified_service_user
  services:
    - name: Deluxe suite
      applies_to: Pikkle
    - name: House food
      applies_to: Pikkle
    - name: Extra playtime
      applies_to: Pikkle
  care_context:
    feeding_routine: House food at approximately 08:00 and 18:00.
    allows_socialization: true
    behaviour_and_health_notes: Friendly adult Labrador; benefits from structured exercise and rest.
```

The booking status is `confirmed` because that is the schema-supported booking status that can represent this scenario. `neon.sql` does not define a completed booking status, so `confirmed` alone must not be treated as proof of completed care outside this human-provided scenario. The actual service association must later be represented by one `booking_pets_services` row per selected service, using the service UUID and `price_at_booking` snapshot. This document does not invent service UUIDs, prices, or currency.

## Review context

```yaml
review:
  target_surface: google_business_reviews
  content_direction: Praise
  rating: 5
  published_at: 2026-08-10
  data_origin: mock
  reviewer: Andrew
  subject_pet: Pikkle
  attached_photo_assets:
    - golden-labrador-pikkle-garden.png
    - golden-labrador-pikkle-resting.png
```

`Praise` is the scenario's content direction. It is not a column in `google_business_reviews`. This scenario targets the Google-shaped review surface, not the internal `feedback` table. An internal feedback row would be a separate artifact and would require its own `pet_uuid`, `pet_owners_uuid`, rating details, and feedback timeline context.

### Draft content direction

The review should sound like a real, specific post-stay recommendation. It should mention the three selected services without reading like a service catalogue. The positive evidence should connect the private suite and webcam access with Andrew's peace of mind, connect Extra playtime with Pikkle's energy, and connect House food with continuity of Pikkle's routine.

Proposed draft:

> We booked Pikkle into the Deluxe suite from 26 July to 7 August, and the whole stay felt thoughtfully organised. The private space and webcam access gave us peace of mind, while the extra playtime suited his energy perfectly. The team kept his house-food routine consistent, and Pikkle came home happy, relaxed, and wonderfully tired. We would happily book PetHouse again.

## Later `neon.sql` data match

The future fixture/data-match step should map the character to these schema relationships:

```text
users
└── pet_owners
    └── pets (Pikkle)
        └── booking_pets
            └── booking_pets_services
                └── services

reviewer_identities (Google identity for Andrew)
└── google_business_reviews (Andrew's mock Google review)
    └── google_review_media_logs (two persisted photo URLs)
```

| Schema object              | Match requirement for this scenario                                                                                                                                                             |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`                    | Andrew's registered WagStay account; username and email must be unique.                                                                                                                         |
| `pet_owners`               | One-to-one profile extension keyed by the same user UUID; required contact fields use the synthetic placeholders above unless replaced.                                                         |
| `reviewer_identities`      | `provider = 'google'`; the reviewer identity represents Andrew's Google account. The schema does not provide a direct FK to `users`, so the same-person relationship remains scenario metadata. |
| `pets`                     | Pikkle belongs to Andrew's `pet_owners` UUID; species is dog and breed is Labrador Retriever.                                                                                                   |
| `bookings`                 | Belongs to Andrew's pet-owner UUID and uses `status = 'confirmed'`.                                                                                                                             |
| `booking_pets`             | Connects the booking to Pikkle and stores the 12:00 drop-off and 15:00 pick-up timestamps.                                                                                                      |
| `booking_pets_services`    | Three per-pet associations: Deluxe suite, House food, and Extra playtime. Preserve `price_at_booking` when the actual service rows are resolved.                                                |
| `booking_pets_caring_info` | Optional stay-care context for feeding routine and socialization; only supplied or approved details should be populated.                                                                        |
| `google_business_reviews`  | Stores the mock Google-shaped review, rating, comment, reviewer display data, and 10 August timestamps. It does not store `Praise` as a category.                                               |
| `google_review_media_logs` | Stores two review attachment URLs only; image bytes and a separate image type field are not part of this mapping.                                                                               |
| `feedback`                 | Intentionally not used for this Google review scenario.                                                                                                                                         |

## Consistency rules for future generation

- Andrew is both an app user and a Google reviewer in this scenario, but the two identity tables remain separate in the schema.
- Pikkle's service experience is verified by the human-supplied stay scenario and must later be represented by the booking/service chain; the review text itself is not the evidence source.
- The 26 July 12:00 to 7 August 15:00 window is treated as 12 nights. If a later booking rule uses a different billing boundary, that rule must be stated separately.
- The review is synthetic and app-owned, so future fixture data should use `data_origin = 'mock'`; it must not be described as a live Google Business Profile ingestion.
- The two Labrador images are review attachments and character references, not reviewer avatars and not automatic pet-profile rows.
- No database record, migration, detection result, service-user alert, or external Google action is created by this character-set document.

## Open values for later data matching

- Actual `users.uuid`, `pet_owners.users_uuid`, `pets.uuid`, booking UUID, and service UUIDs.
- A local-only password provisioning step if this character must be used for login; the plaintext value is kept only in [`andrew-credentials.local.md`](andrew-credentials.local.md), and the database must store its hash.
- The actual service prices and `price_at_booking`; `neon.sql` has no currency column on `services`.
- The exact Google `provider_subject` and reviewer identity UUID if this remains a database fixture rather than a text-only scenario.
- The exact `google_business_location_uuid` for the target facility when the facility row is resolved.
- Whether the future fixture should also create a separate internal `feedback` record in addition to this Google Business Review.
