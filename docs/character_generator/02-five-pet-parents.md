# Character Set 02: Five Google-Review Pet Parents

## Scenario boundary

This is a synthetic fixture set for the app-owned Google review surface. Every character is a
registered app user with a completed pet-owner profile, one pet, one past stay, one synthetic
Google reviewer identity, one mock Google Business Review, one linked `external_feedback` case,
and one distinct review image.

The five stays may overlap. Each stay still has a strict `check_in < check_out` relationship, all
ten stay endpoints are distinct, and each Google review is dated after its own checkout. The
characters use the existing PetHouse facility and current service catalog. They do not represent
real people, real Gmail accounts, real Google activity, or real medical records.

The owner gender split is visual character metadata only. The canonical schema does not store a
pet-owner gender field. Pet gender is a separate pet-profile field.

## Set summary

| Character               | Owner presentation | Pet   | Species / breed         | Active medication | Review direction | Rating | Stay window       |
| ----------------------- | ------------------ | ----- | ----------------------- | ----------------- | ---------------- | -----: | ----------------- |
| `mei-lin-miso-001`      | Asian woman        | Miso  | Cat / Ragdoll           | No                | Praise           |      5 | 10 to 14 Aug 2026 |
| `hana-park-nori-002`    | Asian woman        | Nori  | Cat / British Shorthair | Yes               | Praise           |      4 | 12 to 17 Aug 2026 |
| `priya-nair-kavi-003`   | Asian woman        | Kavi  | Cat / Maine Coon        | No                | Suggestion       |      3 | 16 to 22 Aug 2026 |
| `daniel-chen-yuki-004`  | Asian man          | Yuki  | Dog / Shiba Inu         | Yes               | Issue            |      2 | 21 to 25 Aug 2026 |
| `arjun-patel-tashi-005` | Asian man          | Tashi | Dog / Border Collie     | No                | Praise           |      4 | 24 to 29 Aug 2026 |

The three cat breeds and two dog breeds are intentionally distinct. The pet avatar and review
image are separate assets for every character.

## Shared data rules

- `account_state`: `registered_wagstay_user`
- `pet_owner_profile`: required
- `reviewer_provider`: `google`
- `reviewer_identity`: synthetic provider subject; same-person scenario context only because the
  schema has no FK between `users` and `reviewer_identities`
- `target_surface`: `google_business_reviews` plus `external_feedback`
- `internal_feedback`: intentionally not created
- `booking.status`: `confirmed`, the schema-supported status used for these past synthetic stays
- `data_origin`: `mock`
- `review_language`: English, NZ spelling and tone
- `medical_data`: synthetic fixture data only; not clinical guidance and not evidence of a real
  treatment event

## Character 01: Mei Lin and Miso

```yaml
scenario_key: mei-lin-miso-001
owner:
  display_name: Mei Lin
  first_name: Mei
  last_name: Lin
  presentation: Asian woman
  account_state: registered_wagstay_user
  pet_owner_profile: required
  synthetic_username: mei_lin_petparent
  synthetic_email: mei.lin.wagstay.demo@gmail.com
  synthetic_phone: +64 21 555 1201
  synthetic_address: 18 Tui Road, Mount Eden, Auckland 1024
  date_of_birth: 1992-04-18
  emergency_contact_number: +64 21 555 9201
  emergency_contact_name: Daniel Lin
pet:
  name: Miso
  species: cat
  breed: Ragdoll
  sex: female
  age_years: 3
  date_of_birth: 2023-02-09
  weight_kg: 4.8
  colour: seal point
  microchip_number: SYN-02-001-MISO
  status_after_stay: checked out
  image_asset: Frontend/public/maps-review/characters/02/miso-avatar.png
  diet_notes: Wet food in the morning and measured dry food in the evening.
  allergies: No known allergies.
  behaviour_notes: Calm, affectionate, and slow to settle in unfamiliar rooms; prefers quiet handling.
  health_notes: Healthy adult cat. Synthetic annual wellness record; no current condition requiring treatment.
  vet_name: Dr Emily Wong
  vet_phone: +64 9 555 7201
  emergency_contact: Daniel Lin, +64 21 555 9201
  desexed: true
medical:
  active_medication: false
  medication_summary: No active medication required during this stay.
  medication_rows: []
booking:
  facility: PetHouse
  status: confirmed
  check_in: 2026-08-10T09:15:00+12:00
  check_out: 2026-08-14T15:20:00+12:00
  service_usage_truth: verified_service_user
  services:
    - Deluxe suite
    - House food
    - Wellness check
  caring_info:
    feeding_routine: Wet food at approximately 08:00 and measured dry food at 18:00.
    medication_instructions: No medication required.
    first_time_boarding: false
    crate_trained: false
    other_notes: Use a quiet room and allow Miso to approach staff first.
    allows_socialization: false
    fully_vaccinated: true
    behavior_and_health_notes: Calm Ragdoll; monitor appetite during the first evening.
review:
  reviewer_display_name: Mei Lin
  reviewer_provider: google
  google_created_at: 2026-08-15T10:00:00+12:00
  content_direction: Praise
  rating: 5
  triage_type: praise
  triage_confidence: high
  attached_asset: Backend/storage/google-reviews/character-set-02/miso-review.png
  text: >-
    Miso settled beautifully into the Deluxe suite, and the team kept her feeding routine exactly
    as we requested. The wellness updates were clear and reassuring, and it was obvious that staff
    gave her the quiet space she needed. I would happily book PetHouse again.
```

## Character 02: Hana Park and Nori

```yaml
scenario_key: hana-park-nori-002
owner:
  display_name: Hana Park
  first_name: Hana
  last_name: Park
  presentation: Asian woman
  account_state: registered_wagstay_user
  pet_owner_profile: required
  synthetic_username: hana_park_petparent
  synthetic_email: hana.park.wagstay.demo@gmail.com
  synthetic_phone: +64 21 555 1202
  synthetic_address: 42 Kauri Avenue, Epsom, Auckland 1023
  date_of_birth: 1988-09-27
  emergency_contact_number: +64 21 555 9202
  emergency_contact_name: Joon Park
pet:
  name: Nori
  species: cat
  breed: British Shorthair
  sex: female
  age_years: 6
  date_of_birth: 2019-11-14
  weight_kg: 5.6
  colour: blue-grey
  microchip_number: SYN-02-002-NORI
  status_after_stay: checked out
  image_asset: Frontend/public/maps-review/characters/02/nori-avatar.png
  diet_notes: Measured renal-support wet food split into two meals each day.
  allergies: No known food allergies; avoid tuna-based treats.
  behaviour_notes: Gentle and observant; accepts medication when mixed with a small amount of wet food.
  health_notes: Synthetic managed thyroid condition with a stable routine and no reported acute symptoms.
  vet_name: Dr Sarah Patel
  vet_phone: +64 9 555 7202
  emergency_contact: Joon Park, +64 21 555 9202
  desexed: true
medical:
  active_medication: true
  medication_summary: Stable synthetic thyroid-care routine; staff medication administration is selected for the stay.
  medication_rows:
    - name: Methimazole
      strength: 2.5 mg
      dose: 1
      unit: tablet
      route: ORAL
      schedule: [08:00, 20:00]
      with_food: true
      instructions: Give with a small amount of the scheduled wet food; record each administration.
      prescribed_by: Dr Sarah Patel
      active: true
booking:
  facility: PetHouse
  status: confirmed
  check_in: 2026-08-12T11:10:00+12:00
  check_out: 2026-08-17T14:35:00+12:00
  service_usage_truth: verified_service_user
  services:
    - Standard boarding
    - House food
    - Medication administration
  caring_info:
    feeding_routine: Renal-support wet food at approximately 08:00 and 20:00.
    medication_instructions: Methimazole 2.5 mg, one tablet orally at 08:00 and 20:00 with food.
    first_time_boarding: true
    crate_trained: false
    other_notes: Keep medication log visible to the assigned care team.
    allows_socialization: false
    fully_vaccinated: true
    behavior_and_health_notes: Stable thyroid-care routine; monitor appetite and hydration.
review:
  reviewer_display_name: Hana Park
  reviewer_provider: google
  google_created_at: 2026-08-18T09:20:00+12:00
  content_direction: Praise
  rating: 4
  triage_type: praise
  triage_confidence: high
  attached_asset: Backend/storage/google-reviews/character-set-02/nori-review.png
  text: >-
    Nori came home relaxed and well cared for after her first stay. I appreciated how carefully the
    team followed her food and medication routine, and the check-in communication was thoughtful.
    The whole process felt organised and reassuring.
```

## Character 03: Priya Nair and Kavi

```yaml
scenario_key: priya-nair-kavi-003
owner:
  display_name: Priya Nair
  first_name: Priya
  last_name: Nair
  presentation: Asian woman
  account_state: registered_wagstay_user
  pet_owner_profile: required
  synthetic_username: priya_nair_petparent
  synthetic_email: priya.nair.wagstay.demo@gmail.com
  synthetic_phone: +64 21 555 1203
  synthetic_address: 7 Pohutukawa Lane, Newmarket, Auckland 1023
  date_of_birth: 1990-01-13
  emergency_contact_number: +64 21 555 9203
  emergency_contact_name: Anika Nair
pet:
  name: Kavi
  species: cat
  breed: Maine Coon
  sex: male
  age_years: 4
  date_of_birth: 2021-06-03
  weight_kg: 6.9
  colour: brown tabby
  microchip_number: SYN-02-003-KAVI
  status_after_stay: checked out
  image_asset: Frontend/public/maps-review/characters/02/kavi-avatar.png
  diet_notes: Long-hair formula dry food with a small wet-food topper at dinner.
  allergies: No known allergies.
  behaviour_notes: Friendly with familiar people; enjoys supervised brushing and calm window spaces.
  health_notes: Healthy adult Maine Coon; synthetic dental and coat-care notes are routine only.
  vet_name: Dr Olivia Rao
  vet_phone: +64 9 555 7203
  emergency_contact: Anika Nair, +64 21 555 9203
  desexed: true
medical:
  active_medication: false
  medication_summary: No active medication required during this stay.
  medication_rows: []
booking:
  facility: PetHouse
  status: confirmed
  check_in: 2026-08-16T08:40:00+12:00
  check_out: 2026-08-22T16:10:00+12:00
  service_usage_truth: verified_service_user
  services:
    - Deluxe suite
    - House food
    - Wellness check
  caring_info:
    feeding_routine: Long-hair formula food at approximately 08:00 and wet-food topper at 18:30.
    medication_instructions: No medication required.
    first_time_boarding: false
    crate_trained: false
    other_notes: Offer supervised brushing if Kavi approaches calmly.
    allows_socialization: false
    fully_vaccinated: true
    behavior_and_health_notes: Large, social cat; provide a quiet space and monitor coat condition.
review:
  reviewer_display_name: Priya Nair
  reviewer_provider: google
  google_created_at: 2026-08-23T11:00:00+12:00
  content_direction: Suggestion
  rating: 3
  triage_type: suggestion
  triage_confidence: high
  attached_asset: Backend/storage/google-reviews/character-set-02/kavi-review.png
  text: >-
    Kavi was comfortable and the team were kind throughout his stay. For longer cat bookings, it
    would be helpful to receive a few more individual photo updates, especially for cats who spend
    most of their time in a quiet room. The wellness information was useful, and this would make it
    even easier to feel connected while they are away.
```

## Character 04: Daniel Chen and Yuki

```yaml
scenario_key: daniel-chen-yuki-004
owner:
  display_name: Daniel Chen
  first_name: Daniel
  last_name: Chen
  presentation: Asian man
  account_state: registered_wagstay_user
  pet_owner_profile: required
  synthetic_username: daniel_chen_petparent
  synthetic_email: daniel.chen.wagstay.demo@gmail.com
  synthetic_phone: +64 21 555 1204
  synthetic_address: 29 Rimu Street, Grey Lynn, Auckland 1021
  date_of_birth: 1986-06-22
  emergency_contact_number: +64 21 555 9204
  emergency_contact_name: Rachel Chen
pet:
  name: Yuki
  species: dog
  breed: Shiba Inu
  sex: female
  age_years: 5
  date_of_birth: 2021-01-28
  weight_kg: 10.2
  colour: red sesame
  microchip_number: SYN-02-004-YUKI
  status_after_stay: checked out
  image_asset: Frontend/public/maps-review/characters/02/yuki-avatar.png
  diet_notes: Measured adult dog food twice daily; no table scraps.
  allergies: Synthetic mild environmental sensitivity; avoid strongly scented grooming products.
  behaviour_notes: Alert but polite; needs a short quiet break after handling and settles with familiar cues.
  health_notes: Synthetic mild atopic dermatitis managed under a stable veterinary plan; no acute symptoms described.
  vet_name: Dr Michael Tan
  vet_phone: +64 9 555 7204
  emergency_contact: Rachel Chen, +64 21 555 9204
  desexed: true
medical:
  active_medication: true
  medication_summary: Stable synthetic dermatology routine; medication administration is selected for the stay.
  medication_rows:
    - name: Apoquel
      strength: 5.4 mg
      dose: 1
      unit: tablet
      route: ORAL
      schedule: [09:00]
      with_food: false
      instructions: Give once each morning and record administration; stop and escalate only if the supplied care plan indicates a reaction.
      prescribed_by: Dr Michael Tan
      active: true
booking:
  facility: PetHouse
  status: confirmed
  check_in: 2026-08-21T10:05:00+12:00
  check_out: 2026-08-25T13:45:00+12:00
  service_usage_truth: verified_service_user
  services:
    - Standard boarding
    - Grooming session
    - Medication administration
  caring_info:
    feeding_routine: Measured adult dog food at approximately 08:00 and 18:00.
    medication_instructions: Apoquel 5.4 mg, one tablet orally at 09:00; record administration.
    first_time_boarding: false
    crate_trained: true
    other_notes: Avoid strongly scented grooming products and provide a quiet break after handling.
    allows_socialization: false
    fully_vaccinated: true
    behavior_and_health_notes: Alert Shiba Inu with synthetic mild dermatitis; use the supplied grooming notes.
review:
  reviewer_display_name: Daniel Chen
  reviewer_provider: google
  google_created_at: 2026-08-26T08:30:00+12:00
  content_direction: Issue
  rating: 2
  triage_type: issue
  triage_confidence: medium
  attached_asset: Backend/storage/google-reviews/character-set-02/yuki-review.png
  text: >-
    Yuki was safe and the staff were polite, but the grooming outcome was disappointing. Her coat
    still felt strongly scented at pickup and the finish was not what we expected from the Grooming
    session. The medication routine was handled carefully, but I would like the grooming notes and
    final check to be clearer before booking this service again.
```

## Character 05: Arjun Patel and Tashi

```yaml
scenario_key: arjun-patel-tashi-005
owner:
  display_name: Arjun Patel
  first_name: Arjun
  last_name: Patel
  presentation: Asian man
  account_state: registered_wagstay_user
  pet_owner_profile: required
  synthetic_username: arjun_patel_petparent
  synthetic_email: arjun.patel.wagstay.demo@gmail.com
  synthetic_phone: +64 21 555 1205
  synthetic_address: 63 Kowhai Crescent, Onehunga, Auckland 1061
  date_of_birth: 1989-11-05
  emergency_contact_number: +64 21 555 9205
  emergency_contact_name: Neha Patel
pet:
  name: Tashi
  species: dog
  breed: Border Collie
  sex: male
  age_years: 2
  date_of_birth: 2024-03-19
  weight_kg: 19.8
  colour: black and white
  microchip_number: SYN-02-005-TASHI
  status_after_stay: checked out
  image_asset: Frontend/public/maps-review/characters/02/tashi-avatar.png
  diet_notes: High-energy adult dog food split into breakfast and dinner with measured training treats.
  allergies: No known allergies.
  behaviour_notes: Curious and energetic; responds well to structured enrichment and short rest periods.
  health_notes: Healthy young adult Border Collie; synthetic exercise and rest guidance is routine only.
  vet_name: Dr Aroha Singh
  vet_phone: +64 9 555 7205
  emergency_contact: Neha Patel, +64 21 555 9205
  desexed: true
medical:
  active_medication: false
  medication_summary: No active medication required during this stay.
  medication_rows: []
booking:
  facility: PetHouse
  status: confirmed
  check_in: 2026-08-24T12:25:00+12:00
  check_out: 2026-08-29T15:30:00+12:00
  service_usage_truth: verified_service_user
  services:
    - Deluxe suite
    - Enrichment session
    - Daycare session
  caring_info:
    feeding_routine: Adult dog food at approximately 07:30 and 18:00 with measured training treats.
    medication_instructions: No medication required.
    first_time_boarding: true
    crate_trained: true
    other_notes: Use structured enrichment followed by a quiet rest period.
    allows_socialization: true
    fully_vaccinated: true
    behavior_and_health_notes: Energetic Border Collie; balance enrichment with rest.
review:
  reviewer_display_name: Arjun Patel
  reviewer_provider: google
  google_created_at: 2026-08-30T10:15:00+12:00
  content_direction: Praise
  rating: 4
  triage_type: praise
  triage_confidence: high
  attached_asset: Backend/storage/google-reviews/character-set-02/tashi-review.png
  text: >-
    Tashi had a great stay and came home happy and nicely tired. The mix of enrichment and daycare
    suited his energy, and the Deluxe suite gave him a comfortable place to rest between activities.
    The team communicated clearly and made the first booking feel easy.
```

## Asset manifest

The owner and pet avatar paths are tracked frontend public assets. Review images are tracked under
the backend Google-review storage directory so the existing `/uploads/google-reviews` route can
serve them in development. The same image must not be reused across the pet avatar and review
attachment roles.

| Character           | Owner avatar                                                       | Pet avatar                                                   | Review image                                                       |
| ------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------------ |
| Mei Lin / Miso      | `Frontend/public/maps-review/characters/02/mei-lin-avatar.png`     | `Frontend/public/maps-review/characters/02/miso-avatar.png`  | `Backend/storage/google-reviews/character-set-02/miso-review.png`  |
| Hana Park / Nori    | `Frontend/public/maps-review/characters/02/hana-park-avatar.png`   | `Frontend/public/maps-review/characters/02/nori-avatar.png`  | `Backend/storage/google-reviews/character-set-02/nori-review.png`  |
| Priya Nair / Kavi   | `Frontend/public/maps-review/characters/02/priya-nair-avatar.png`  | `Frontend/public/maps-review/characters/02/kavi-avatar.png`  | `Backend/storage/google-reviews/character-set-02/kavi-review.png`  |
| Daniel Chen / Yuki  | `Frontend/public/maps-review/characters/02/daniel-chen-avatar.png` | `Frontend/public/maps-review/characters/02/yuki-avatar.png`  | `Backend/storage/google-reviews/character-set-02/yuki-review.png`  |
| Arjun Patel / Tashi | `Frontend/public/maps-review/characters/02/arjun-patel-avatar.png` | `Frontend/public/maps-review/characters/02/tashi-avatar.png` | `Backend/storage/google-reviews/character-set-02/tashi-review.png` |

## Database mapping proposal

For each character, the later migration will create one row in `users`, `pet_owners`, `pets`,
`bookings`, `booking_pets`, and `reviewer_identities`; the selected services will create one row
per service in `booking_pets_services`; all care fields will be populated in
`booking_pets_caring_info`; and the review will create one row in `google_business_reviews`, one
row in `external_feedback`, and one row in `google_review_media_logs`.

The later migration must resolve live service UUIDs and copy the current service price into
`price_at_booking`. It must use the password values only as local psql variables or parameterized
inputs and persist only `crypt(..., gen_salt('bf', 12))` output in `users.password_hash`.

## Consistency checks

- Identity state: five registered app users, five one-to-one pet-owner profiles, and five pets.
- Owner presentation: three women and two men; this is not a new database gender field.
- Pet diversity: three distinct cat breeds and two distinct dog breeds.
- Medical context: two active synthetic medication rows with matching care instructions; three
  explicit no-medication cases.
- Stay timing: every check-in is earlier than its own check-out; no two endpoint timestamps are
  equal; stays are allowed to overlap.
- Review timing: every Google review timestamp is after its own checkout.
- Review coverage: three Praise, one Suggestion, and one Issue; Google review rows will retain only
  the review text and rating, while triage direction belongs in the synthetic external feedback AI
  metadata.
- Asset separation: owner avatar, pet avatar, and review image are separate roles and paths.
- Provenance: every row and asset is synthetic/mock; no real provider ingestion is implied.
- Unresolved before migration: live UUIDs for PetHouse, services, and the five new records; these
  will be resolved in the migration preflight rather than invented in this document.
