-- Seed Character Set 01: Andrew and Pikkle.
--
-- This is a psql-compatible data migration draft. It intentionally does not
-- contain Andrew's plaintext password. Supply the ignored local credential
-- through psql's `andrew_password` variable when running it.
--
-- Required psql variables:
--   andrew_password
--   andrew_avatar_url
--   pikkle_photo_1_url
--   pikkle_photo_2_url
--
-- Dry-run report (no writes):
--   psql --set=dry_run=1 --file=<this-file> <direct-test-connection>
--
-- Transactional validation (writes are rolled back by the caller):
--   psql --set=dry_run=0 --single-transaction --file=<this-file> <direct-test-connection>
--
-- A normal apply should use a direct, non-pooled Neon connection and the
-- caller should use --single-transaction. This file deliberately has no
-- COMMIT so the dry-run wrapper can roll it back safely.

\if :{?dry_run}
\else
\set dry_run 0
\endif

\if :{?andrew_password}
\else
\set andrew_password ''
\endif

\if :{?andrew_avatar_url}
\else
\set andrew_avatar_url ''
\endif

\if :{?pikkle_photo_1_url}
\else
\set pikkle_photo_1_url ''
\endif

\if :{?pikkle_photo_2_url}
\else
\set pikkle_photo_2_url ''
\endif

-- Fixed IDs make this character fixture re-runnable and easy to inspect.
-- They are app-owned synthetic IDs, not provider IDs.
\set andrew_user_uuid '00000000-0000-4000-8000-000000000601'
\set pikkle_pet_uuid '00000000-0000-4000-8000-000000000602'
\set andrew_booking_uuid '00000000-0000-4000-8000-000000000603'
\set pikkle_booking_pet_uuid '00000000-0000-4000-8000-000000000604'
\set andrew_reviewer_uuid '00000000-0000-4000-8000-000000000605'
\set andrew_review_uuid '00000000-0000-4000-8000-000000000606'
\set pethouse_facility_uuid '00000000-0000-4000-8000-000000000306'
\set pethouse_location_uuid '00000000-0000-4000-8000-000000000401'
\set deluxe_suite_service_uuid 'a555438f-5f66-4e3c-8c3a-53b49ff8ede9'
\set house_food_service_uuid 'c68589a8-c0a7-41cc-a94b-41b52230e063'
\set extra_playtime_service_uuid 'bd259cc8-031e-4ff8-be89-000701046ca4'

-- psql does not expand variables inside PostgreSQL dollar-quoted DO bodies.
-- Keep these values session-scoped so the validation blocks can read them
-- without embedding secrets in the migration source.
SET app.seed_andrew_password TO :'andrew_password';
SET app.seed_andrew_avatar_url TO :'andrew_avatar_url';
SET app.seed_pikkle_photo_1_url TO :'pikkle_photo_1_url';
SET app.seed_pikkle_photo_2_url TO :'pikkle_photo_2_url';
SET app.seed_andrew_user_uuid TO :'andrew_user_uuid';
SET app.seed_pethouse_facility_uuid TO :'pethouse_facility_uuid';
SET app.seed_pethouse_location_uuid TO :'pethouse_location_uuid';
SET app.seed_deluxe_suite_service_uuid TO :'deluxe_suite_service_uuid';
SET app.seed_house_food_service_uuid TO :'house_food_service_uuid';
SET app.seed_extra_playtime_service_uuid TO :'extra_playtime_service_uuid';

-- Dry-run mode reports missing inputs and database dependencies without
-- creating any rows. The asset values must be persisted URLs, not local
-- Frontend/src/assets paths or browser blob URLs.
\if :dry_run
WITH required_inputs(input_name, is_missing) AS (
    VALUES
        ('andrew_password', NULLIF(:'andrew_password', '') IS NULL),
        ('andrew_avatar_url', NULLIF(:'andrew_avatar_url', '') IS NULL),
        ('pikkle_photo_1_url', NULLIF(:'pikkle_photo_1_url', '') IS NULL),
        ('pikkle_photo_2_url', NULLIF(:'pikkle_photo_2_url', '') IS NULL)
),
database_dependencies(input_name, is_missing) AS (
    VALUES
        ('PetHouse facility', NOT EXISTS (
            SELECT 1
            FROM facilities
            WHERE uuid = :'pethouse_facility_uuid'::uuid
              AND name = 'PetHouse'
        )),
        ('PetHouse Google location', NOT EXISTS (
            SELECT 1
            FROM google_business_locations
            WHERE uuid = :'pethouse_location_uuid'::uuid
              AND facility_uuid = :'pethouse_facility_uuid'::uuid
              AND google_location_id = 'mock-pethouse-location'
        )),
        ('Deluxe suite service', NOT EXISTS (
            SELECT 1
            FROM services
            WHERE uuid = :'deluxe_suite_service_uuid'::uuid
              AND name = 'Deluxe suite'
              AND category = 'boarding_rate'
        )),
        ('House food service', NOT EXISTS (
            SELECT 1
            FROM services
            WHERE uuid = :'house_food_service_uuid'::uuid
              AND name = 'House food'
              AND category = 'food'
        )),
        ('Extra playtime service', NOT EXISTS (
            SELECT 1
            FROM services
            WHERE uuid = :'extra_playtime_service_uuid'::uuid
              AND name = 'Extra playtime'
              AND category = 'addon'
        )),
        ('Andrew email conflict', EXISTS (
            SELECT 1
            FROM users
            WHERE lower(email) = lower('andrew.c@gmail.com')
              AND uuid <> :'andrew_user_uuid'::uuid
        )),
        ('Andrew username conflict', EXISTS (
            SELECT 1
            FROM users
            WHERE lower(username) = lower('andrew.pikkle')
              AND uuid <> :'andrew_user_uuid'::uuid
        )),
        ('Andrew user UUID conflict', EXISTS (
            SELECT 1
            FROM users
            WHERE uuid = :'andrew_user_uuid'::uuid
              AND lower(email) <> lower('andrew.c@gmail.com')
        )),
        ('Pikkle pet UUID conflict', EXISTS (
            SELECT 1
            FROM pets
            WHERE uuid = :'pikkle_pet_uuid'::uuid
              AND name <> 'Pikkle'
        )),
        ('Andrew reviewer UUID conflict', EXISTS (
            SELECT 1
            FROM reviewer_identities
            WHERE uuid = :'andrew_reviewer_uuid'::uuid
              AND NOT (provider = 'google' AND provider_subject = 'mock-google-andrew-pikkle-001')
        )),
        ('Andrew review UUID conflict', EXISTS (
            SELECT 1
            FROM google_business_reviews
            WHERE uuid = :'andrew_review_uuid'::uuid
        ))
)
SELECT input_name,
       CASE WHEN is_missing THEN 'MISSING_OR_CONFLICT' ELSE 'READY' END AS status
FROM (
    SELECT * FROM required_inputs
    UNION ALL
    SELECT * FROM database_dependencies
) AS checks
ORDER BY CASE WHEN is_missing THEN 0 ELSE 1 END, input_name;

SELECT CASE
    WHEN EXISTS (
        SELECT 1
        FROM (
            SELECT NULLIF(:'andrew_password', '') IS NULL AS is_missing
            UNION ALL SELECT NULLIF(:'andrew_avatar_url', '') IS NULL
            UNION ALL SELECT NULLIF(:'pikkle_photo_1_url', '') IS NULL
            UNION ALL SELECT NULLIF(:'pikkle_photo_2_url', '') IS NULL
        ) AS input_checks
        WHERE is_missing
    ) THEN 'DRY RUN: missing local inputs remain'
    ELSE 'DRY RUN: local inputs are present; inspect dependency rows above'
END AS dry_run_summary;
\quit
\endif

-- Fail closed outside report mode if a required secret or persisted media URL
-- was not supplied.
DO $$
BEGIN
    IF NULLIF(current_setting('app.seed_andrew_password', true), '') IS NULL THEN
        RAISE EXCEPTION 'Missing psql variable: andrew_password';
    END IF;
    IF NULLIF(current_setting('app.seed_andrew_avatar_url', true), '') IS NULL THEN
        RAISE EXCEPTION 'Missing psql variable: andrew_avatar_url';
    END IF;
    IF NULLIF(current_setting('app.seed_pikkle_photo_1_url', true), '') IS NULL THEN
        RAISE EXCEPTION 'Missing psql variable: pikkle_photo_1_url';
    END IF;
    IF NULLIF(current_setting('app.seed_pikkle_photo_2_url', true), '') IS NULL THEN
        RAISE EXCEPTION 'Missing psql variable: pikkle_photo_2_url';
    END IF;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM facilities
        WHERE uuid = current_setting('app.seed_pethouse_facility_uuid', true)::uuid
          AND name = 'PetHouse'
    ) THEN
        RAISE EXCEPTION 'Missing dependency: PetHouse facility';
    END IF;
    IF NOT EXISTS (
        SELECT 1
        FROM google_business_locations
        WHERE uuid = current_setting('app.seed_pethouse_location_uuid', true)::uuid
          AND facility_uuid = current_setting('app.seed_pethouse_facility_uuid', true)::uuid
          AND google_location_id = 'mock-pethouse-location'
    ) THEN
        RAISE EXCEPTION 'Missing dependency: PetHouse Google location';
    END IF;
    IF NOT EXISTS (
        SELECT 1
        FROM services
        WHERE uuid = current_setting('app.seed_deluxe_suite_service_uuid', true)::uuid
          AND name = 'Deluxe suite'
          AND category = 'boarding_rate'
    ) THEN
        RAISE EXCEPTION 'Missing dependency: Deluxe suite service';
    END IF;
    IF NOT EXISTS (
        SELECT 1
        FROM services
        WHERE uuid = current_setting('app.seed_house_food_service_uuid', true)::uuid
          AND name = 'House food'
          AND category = 'food'
    ) THEN
        RAISE EXCEPTION 'Missing dependency: House food service';
    END IF;
    IF NOT EXISTS (
        SELECT 1
        FROM services
        WHERE uuid = current_setting('app.seed_extra_playtime_service_uuid', true)::uuid
          AND name = 'Extra playtime'
          AND category = 'addon'
    ) THEN
        RAISE EXCEPTION 'Missing dependency: Extra playtime service';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM users
        WHERE lower(email) = lower('andrew.c@gmail.com')
          AND uuid <> current_setting('app.seed_andrew_user_uuid', true)::uuid
    ) THEN
        RAISE EXCEPTION 'Conflict: andrew.c@gmail.com belongs to another users UUID';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM users
        WHERE lower(username) = lower('andrew.pikkle')
          AND uuid <> current_setting('app.seed_andrew_user_uuid', true)::uuid
    ) THEN
        RAISE EXCEPTION 'Conflict: andrew.pikkle belongs to another users UUID';
    END IF;
END;
$$;

INSERT INTO users (
    uuid,
    username,
    avatar_url,
    email,
    phone,
    password_hash,
    display_name,
    is_employee,
    is_pet_owner
)
VALUES (
    :'andrew_user_uuid'::uuid,
    'andrew.pikkle',
    NULLIF(:'andrew_avatar_url', ''),
    'andrew.c@gmail.com',
    '+64 21 555 0178',
    crypt(:'andrew_password', gen_salt('bf', 12)),
    'Andrew',
    FALSE,
    TRUE
)
ON CONFLICT (uuid) DO UPDATE SET
    username = EXCLUDED.username,
    avatar_url = EXCLUDED.avatar_url,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    password_hash = EXCLUDED.password_hash,
    display_name = EXCLUDED.display_name,
    is_employee = EXCLUDED.is_employee,
    is_pet_owner = EXCLUDED.is_pet_owner;

INSERT INTO pet_owners (
    users_uuid,
    emergency_contact_number,
    first_name,
    last_name,
    address
)
VALUES (
    :'andrew_user_uuid'::uuid,
    '+64 21 555 0178',
    'Andrew',
    'Carter',
    '12 Kowhai Street, Grey Lynn, Auckland 1021'
)
ON CONFLICT (users_uuid) DO UPDATE SET
    emergency_contact_number = EXCLUDED.emergency_contact_number,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    address = EXCLUDED.address;

INSERT INTO pets (
    uuid,
    pet_owners_uuid,
    image_url,
    name,
    breed,
    age,
    weight,
    species,
    diet_notes,
    allergies,
    behaviour_notes,
    colour
)
VALUES (
    :'pikkle_pet_uuid'::uuid,
    :'andrew_user_uuid'::uuid,
    NULL,
    'Pikkle',
    'Labrador Retriever',
    4,
    31.4,
    'dog',
    'House food served as two measured meals each day.',
    'No known allergies.',
    'Friendly and energetic; enjoys structured play and settles well after exercise.',
    'golden yellow'
)
ON CONFLICT (uuid) DO UPDATE SET
    pet_owners_uuid = EXCLUDED.pet_owners_uuid,
    image_url = EXCLUDED.image_url,
    name = EXCLUDED.name,
    breed = EXCLUDED.breed,
    age = EXCLUDED.age,
    weight = EXCLUDED.weight,
    species = EXCLUDED.species,
    diet_notes = EXCLUDED.diet_notes,
    allergies = EXCLUDED.allergies,
    behaviour_notes = EXCLUDED.behaviour_notes,
    colour = EXCLUDED.colour;

INSERT INTO bookings (uuid, pet_owners_uuid, status)
VALUES (
    :'andrew_booking_uuid'::uuid,
    :'andrew_user_uuid'::uuid,
    'confirmed'
)
ON CONFLICT (uuid) DO UPDATE SET
    pet_owners_uuid = EXCLUDED.pet_owners_uuid,
    status = EXCLUDED.status;

INSERT INTO booking_pets (
    uuid,
    bookings_uuid,
    pet_uuid,
    drop_off_time,
    pick_up_time
)
VALUES (
    :'pikkle_booking_pet_uuid'::uuid,
    :'andrew_booking_uuid'::uuid,
    :'pikkle_pet_uuid'::uuid,
    TIMESTAMPTZ '2026-07-26 12:00:00+12',
    TIMESTAMPTZ '2026-08-07 15:00:00+12'
)
ON CONFLICT (uuid) DO UPDATE SET
    bookings_uuid = EXCLUDED.bookings_uuid,
    pet_uuid = EXCLUDED.pet_uuid,
    drop_off_time = EXCLUDED.drop_off_time,
    pick_up_time = EXCLUDED.pick_up_time;

INSERT INTO booking_pets_services (
    booking_pets_uuid,
    services_uuid,
    quantity,
    price_at_booking
)
SELECT
    :'pikkle_booking_pet_uuid'::uuid,
    service.uuid,
    1,
    service.price
FROM services AS service
WHERE service.uuid IN (
    :'deluxe_suite_service_uuid'::uuid,
    :'house_food_service_uuid'::uuid,
    :'extra_playtime_service_uuid'::uuid
)
ON CONFLICT (booking_pets_uuid, services_uuid) DO UPDATE SET
    quantity = EXCLUDED.quantity,
    price_at_booking = EXCLUDED.price_at_booking;

INSERT INTO booking_pets_caring_info (
    booking_pets_uuid,
    feeding_routine,
    allows_socialization,
    behavior_and_health_notes
)
VALUES (
    :'pikkle_booking_pet_uuid'::uuid,
    'House food at approximately 08:00 and 18:00.',
    TRUE,
    'Friendly adult Labrador; benefits from structured exercise and rest.'
)
ON CONFLICT (booking_pets_uuid) DO UPDATE SET
    feeding_routine = EXCLUDED.feeding_routine,
    allows_socialization = EXCLUDED.allows_socialization,
    behavior_and_health_notes = EXCLUDED.behavior_and_health_notes;

INSERT INTO reviewer_identities (
    uuid,
    provider,
    provider_subject,
    email,
    display_name,
    avatar_url
)
VALUES (
    :'andrew_reviewer_uuid'::uuid,
    'google',
    'mock-google-andrew-pikkle-001',
    'andrew.c@gmail.com',
    'Andrew',
    NULLIF(:'andrew_avatar_url', '')
)
ON CONFLICT (uuid) DO UPDATE SET
    provider = EXCLUDED.provider,
    provider_subject = EXCLUDED.provider_subject,
    email = EXCLUDED.email,
    display_name = EXCLUDED.display_name,
    avatar_url = EXCLUDED.avatar_url;

INSERT INTO google_business_reviews (
    uuid,
    google_business_location_uuid,
    google_review_id,
    google_resource_name,
    reviewer_display_name,
    reviewer_profile_photo_url,
    reviewer_is_anonymous,
    rating,
    comment,
    google_created_at,
    google_updated_at,
    data_origin
)
VALUES (
    :'andrew_review_uuid'::uuid,
    :'pethouse_location_uuid'::uuid,
    'mock-andrew-pikkle-review-001',
    'accounts/mock-pethouse-account/locations/mock-pethouse-location/reviews/mock-andrew-pikkle-review-001',
    'Andrew',
    NULLIF(:'andrew_avatar_url', ''),
    FALSE,
    5,
    'We booked Pikkle into the Deluxe suite from 26 July to 7 August, and the whole stay felt thoughtfully organised. The private space and webcam access gave us peace of mind, while the extra playtime suited his energy perfectly. The team kept his house-food routine consistent, and Pikkle came home happy, relaxed, and wonderfully tired. We would happily book PetHouse again.',
    TIMESTAMPTZ '2026-08-10 12:00:00+12',
    TIMESTAMPTZ '2026-08-10 12:00:00+12',
    'mock'
)
ON CONFLICT (uuid) DO UPDATE SET
    google_business_location_uuid = EXCLUDED.google_business_location_uuid,
    google_review_id = EXCLUDED.google_review_id,
    google_resource_name = EXCLUDED.google_resource_name,
    reviewer_display_name = EXCLUDED.reviewer_display_name,
    reviewer_profile_photo_url = EXCLUDED.reviewer_profile_photo_url,
    reviewer_is_anonymous = EXCLUDED.reviewer_is_anonymous,
    rating = EXCLUDED.rating,
    comment = EXCLUDED.comment,
    google_created_at = EXCLUDED.google_created_at,
    google_updated_at = EXCLUDED.google_updated_at,
    data_origin = EXCLUDED.data_origin;

-- The existing media-log key is (review_uuid, created_at), so use explicit
-- distinct timestamps for the two photos instead of transaction-stable now().
INSERT INTO google_review_media_logs (
    google_business_reviews_uuid,
    photo_url,
    created_at
)
VALUES
    (
        :'andrew_review_uuid'::uuid,
        NULLIF(:'pikkle_photo_1_url', ''),
        TIMESTAMPTZ '2026-08-10 12:01:00+12'
    ),
    (
        :'andrew_review_uuid'::uuid,
        NULLIF(:'pikkle_photo_2_url', ''),
        TIMESTAMPTZ '2026-08-10 12:02:00+12'
    )
ON CONFLICT (google_business_reviews_uuid, created_at) DO UPDATE SET
    photo_url = EXCLUDED.photo_url;

SELECT
    'Andrew/Pikkle character migration completed' AS result,
    :'andrew_user_uuid'::uuid AS user_uuid,
    :'pikkle_pet_uuid'::uuid AS pet_uuid,
    :'andrew_booking_uuid'::uuid AS booking_uuid,
    :'andrew_review_uuid'::uuid AS review_uuid;
