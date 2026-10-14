-- Seed Character Set 02: five synthetic Asian pet parents and their mock Google reviews.
--
-- This migration is app-owned fixture data. It does not call Google, Gmail, or an
-- external AI provider. It intentionally creates Google-shaped review records and
-- linked external_feedback rows, not internal `feedback` rows.
--
-- Apply with a direct Neon connection and the ignored local variable file:
--   psql -X -v ON_ERROR_STOP=1 --single-transaction \
--     --file=docs/character_generator/02-five-pet-parents-variables.local.sql \
--     --file=Backend/src/data/migrations/20260902_seed_five_google_review_characters.sql \
--     "$DATABASE_URL_UNPOOLED"
--
-- The local variable file supplies only plaintext passwords. This migration stores
-- only bcrypt hashes in users.password_hash.

\if :{?dry_run}
\else
\set dry_run 0
\endif

\if :{?mei_password}
\else
\set mei_password ''
\endif
\if :{?hana_password}
\else
\set hana_password ''
\endif
\if :{?priya_password}
\else
\set priya_password ''
\endif
\if :{?daniel_password}
\else
\set daniel_password ''
\endif
\if :{?arjun_password}
\else
\set arjun_password ''
\endif

-- Stable app-owned fixture IDs. These do not represent provider IDs.
\set mei_user_uuid '00000000-0000-4000-8000-000000000801'
\set hana_user_uuid '00000000-0000-4000-8000-000000000802'
\set priya_user_uuid '00000000-0000-4000-8000-000000000803'
\set daniel_user_uuid '00000000-0000-4000-8000-000000000804'
\set arjun_user_uuid '00000000-0000-4000-8000-000000000805'

\set mei_pet_uuid '00000000-0000-4000-8000-000000000811'
\set hana_pet_uuid '00000000-0000-4000-8000-000000000812'
\set priya_pet_uuid '00000000-0000-4000-8000-000000000813'
\set daniel_pet_uuid '00000000-0000-4000-8000-000000000814'
\set arjun_pet_uuid '00000000-0000-4000-8000-000000000815'

\set mei_booking_uuid '00000000-0000-4000-8000-000000000821'
\set hana_booking_uuid '00000000-0000-4000-8000-000000000822'
\set priya_booking_uuid '00000000-0000-4000-8000-000000000823'
\set daniel_booking_uuid '00000000-0000-4000-8000-000000000824'
\set arjun_booking_uuid '00000000-0000-4000-8000-000000000825'

\set mei_booking_pet_uuid '00000000-0000-4000-8000-000000000831'
\set hana_booking_pet_uuid '00000000-0000-4000-8000-000000000832'
\set priya_booking_pet_uuid '00000000-0000-4000-8000-000000000833'
\set daniel_booking_pet_uuid '00000000-0000-4000-8000-000000000834'
\set arjun_booking_pet_uuid '00000000-0000-4000-8000-000000000835'

\set mei_reviewer_uuid '00000000-0000-4000-8000-000000000841'
\set hana_reviewer_uuid '00000000-0000-4000-8000-000000000842'
\set priya_reviewer_uuid '00000000-0000-4000-8000-000000000843'
\set daniel_reviewer_uuid '00000000-0000-4000-8000-000000000844'
\set arjun_reviewer_uuid '00000000-0000-4000-8000-000000000845'

\set mei_review_uuid '00000000-0000-4000-8000-000000000851'
\set hana_review_uuid '00000000-0000-4000-8000-000000000852'
\set priya_review_uuid '00000000-0000-4000-8000-000000000853'
\set daniel_review_uuid '00000000-0000-4000-8000-000000000854'
\set arjun_review_uuid '00000000-0000-4000-8000-000000000855'

\set mei_external_feedback_uuid '00000000-0000-4000-8000-000000000861'
\set hana_external_feedback_uuid '00000000-0000-4000-8000-000000000862'
\set priya_external_feedback_uuid '00000000-0000-4000-8000-000000000863'
\set daniel_external_feedback_uuid '00000000-0000-4000-8000-000000000864'
\set arjun_external_feedback_uuid '00000000-0000-4000-8000-000000000865'

\set hana_medication_uuid '00000000-0000-4000-8000-000000000871'
\set daniel_medication_uuid '00000000-0000-4000-8000-000000000872'

\set pethouse_facility_uuid '00000000-0000-4000-8000-000000000306'
\set pethouse_location_uuid '00000000-0000-4000-8000-000000000401'
\set daycare_service_uuid '00000000-0000-4000-8000-000000000702'
\set standard_boarding_service_uuid '00000000-0000-4000-8000-000000000701'
\set wellness_service_uuid '00000000-0000-4000-8000-000000000704'
\set enrichment_service_uuid '00000000-0000-4000-8000-000000000705'
\set deluxe_suite_service_uuid 'a555438f-5f66-4e3c-8c3a-53b49ff8ede9'
\set house_food_service_uuid 'c68589a8-c0a7-41cc-a94b-41b52230e063'
\set medication_service_uuid '8c14185a-3170-4c6b-a856-e575b1e9b354'
\set grooming_service_uuid 'e1dbebe1-122d-48d5-892d-a9038b0ff0f0'

-- Keep passwords in session-local settings so the DO block can fail closed
-- without putting them into tracked SQL text.
SET app.seed_mei_password TO :'mei_password';
SET app.seed_hana_password TO :'hana_password';
SET app.seed_priya_password TO :'priya_password';
SET app.seed_daniel_password TO :'daniel_password';
SET app.seed_arjun_password TO :'arjun_password';

\if :dry_run
SELECT input_name, status
FROM (
    VALUES
        ('mei_password', CASE WHEN NULLIF(:'mei_password', '') IS NULL THEN 'MISSING' ELSE 'READY' END),
        ('hana_password', CASE WHEN NULLIF(:'hana_password', '') IS NULL THEN 'MISSING' ELSE 'READY' END),
        ('priya_password', CASE WHEN NULLIF(:'priya_password', '') IS NULL THEN 'MISSING' ELSE 'READY' END),
        ('daniel_password', CASE WHEN NULLIF(:'daniel_password', '') IS NULL THEN 'MISSING' ELSE 'READY' END),
        ('arjun_password', CASE WHEN NULLIF(:'arjun_password', '') IS NULL THEN 'MISSING' ELSE 'READY' END),
        ('PetHouse facility', CASE WHEN EXISTS (
            SELECT 1 FROM facilities
            WHERE uuid = :'pethouse_facility_uuid'::uuid AND name = 'PetHouse'
        ) THEN 'READY' ELSE 'MISSING' END),
        ('PetHouse Google location', CASE WHEN EXISTS (
            SELECT 1 FROM google_business_locations
            WHERE uuid = :'pethouse_location_uuid'::uuid
              AND facility_uuid = :'pethouse_facility_uuid'::uuid
              AND google_location_id = 'mock-pethouse-location'
        ) THEN 'READY' ELSE 'MISSING' END)
) AS checks(input_name, status)
ORDER BY input_name;
\quit
\endif

DO $$
BEGIN
    IF NULLIF(current_setting('app.seed_mei_password', true), '') IS NULL
       OR NULLIF(current_setting('app.seed_hana_password', true), '') IS NULL
       OR NULLIF(current_setting('app.seed_priya_password', true), '') IS NULL
       OR NULLIF(current_setting('app.seed_daniel_password', true), '') IS NULL
       OR NULLIF(current_setting('app.seed_arjun_password', true), '') IS NULL THEN
        RAISE EXCEPTION 'Missing one or more local character password variables';
    END IF;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM facilities
        WHERE uuid = '00000000-0000-4000-8000-000000000306'::uuid
          AND name = 'PetHouse'
    ) THEN
        RAISE EXCEPTION 'Missing dependency: PetHouse facility';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM google_business_locations
        WHERE uuid = '00000000-0000-4000-8000-000000000401'::uuid
          AND facility_uuid = '00000000-0000-4000-8000-000000000306'::uuid
          AND google_location_id = 'mock-pethouse-location'
    ) THEN
        RAISE EXCEPTION 'Missing dependency: PetHouse Google location';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM services WHERE uuid = '00000000-0000-4000-8000-000000000701'::uuid AND name = 'Standard boarding' AND category = 'Boarding' AND price_unit = 'per night') THEN
        RAISE EXCEPTION 'Missing dependency: Standard boarding service';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM services WHERE uuid = '00000000-0000-4000-8000-000000000702'::uuid AND name = 'Daycare session' AND category = 'Daycare' AND price_unit = 'per day') THEN
        RAISE EXCEPTION 'Missing dependency: Daycare session service';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM services WHERE uuid = '00000000-0000-4000-8000-000000000704'::uuid AND name = 'Wellness check' AND category = 'Wellness' AND price_unit = 'per check') THEN
        RAISE EXCEPTION 'Missing dependency: Wellness check service';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM services WHERE uuid = '00000000-0000-4000-8000-000000000705'::uuid AND name = 'Enrichment session' AND category = 'Activity' AND price_unit = 'per session') THEN
        RAISE EXCEPTION 'Missing dependency: Enrichment session service';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM services WHERE uuid = 'a555438f-5f66-4e3c-8c3a-53b49ff8ede9'::uuid AND name = 'Deluxe suite' AND category = 'boarding_rate' AND price_unit = 'per night') THEN
        RAISE EXCEPTION 'Missing dependency: Deluxe suite service';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM services WHERE uuid = 'c68589a8-c0a7-41cc-a94b-41b52230e063'::uuid AND name = 'House food' AND category = 'food' AND price_unit = 'per stay') THEN
        RAISE EXCEPTION 'Missing dependency: House food service';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM services WHERE uuid = '8c14185a-3170-4c6b-a856-e575b1e9b354'::uuid AND name = 'Medication administration' AND category = 'addon' AND price_unit = 'per day') THEN
        RAISE EXCEPTION 'Missing dependency: Medication administration service';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM services WHERE uuid = 'e1dbebe1-122d-48d5-892d-a9038b0ff0f0'::uuid AND name = 'Grooming session' AND category = 'addon' AND price_unit = 'per stay') THEN
        RAISE EXCEPTION 'Missing dependency: Grooming session service';
    END IF;
END;
$$;

-- Fail closed if a stable fixture ID has been claimed by a different identity.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM (VALUES
            ('00000000-0000-4000-8000-000000000801'::uuid, 'mei_lin_petparent', 'mei.lin.wagstay.demo@gmail.com'),
            ('00000000-0000-4000-8000-000000000802'::uuid, 'hana_park_petparent', 'hana.park.wagstay.demo@gmail.com'),
            ('00000000-0000-4000-8000-000000000803'::uuid, 'priya_nair_petparent', 'priya.nair.wagstay.demo@gmail.com'),
            ('00000000-0000-4000-8000-000000000804'::uuid, 'daniel_chen_petparent', 'daniel.chen.wagstay.demo@gmail.com'),
            ('00000000-0000-4000-8000-000000000805'::uuid, 'arjun_patel_petparent', 'arjun.patel.wagstay.demo@gmail.com')
        ) AS expected(uuid, username, email)
        JOIN users u ON u.uuid = expected.uuid
        WHERE u.username <> expected.username OR lower(u.email) <> lower(expected.email)
    ) THEN
        RAISE EXCEPTION 'A character user UUID is already occupied by different data';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM (VALUES
            ('mei_lin_petparent', 'mei.lin.wagstay.demo@gmail.com'),
            ('hana_park_petparent', 'hana.park.wagstay.demo@gmail.com'),
            ('priya_nair_petparent', 'priya.nair.wagstay.demo@gmail.com'),
            ('daniel_chen_petparent', 'daniel.chen.wagstay.demo@gmail.com'),
            ('arjun_patel_petparent', 'arjun.patel.wagstay.demo@gmail.com')
        ) AS expected(username, email)
        JOIN users u ON lower(u.username) = lower(expected.username)
        WHERE lower(u.email) <> lower(expected.email)
    ) OR EXISTS (
        SELECT 1
        FROM (VALUES
            ('mei_lin_petparent', 'mei.lin.wagstay.demo@gmail.com'),
            ('hana_park_petparent', 'hana.park.wagstay.demo@gmail.com'),
            ('priya_nair_petparent', 'priya.nair.wagstay.demo@gmail.com'),
            ('daniel_chen_petparent', 'daniel.chen.wagstay.demo@gmail.com'),
            ('arjun_patel_petparent', 'arjun.patel.wagstay.demo@gmail.com')
        ) AS expected(username, email)
        JOIN users u ON lower(u.email) = lower(expected.email)
        WHERE lower(u.username) <> lower(expected.username)
    ) THEN
        RAISE EXCEPTION 'A character username or email is already used by different data';
    END IF;
END;
$$;

INSERT INTO users (
    uuid, username, avatar_url, email, phone, password_hash, display_name, is_employee, is_pet_owner, created_at
)
VALUES
    ('00000000-0000-4000-8000-000000000801', 'mei_lin_petparent', '/maps-review/characters/02/mei-lin-avatar.png', 'mei.lin.wagstay.demo@gmail.com', '+64 21 555 1201', crypt(current_setting('app.seed_mei_password'), gen_salt('bf', 12)), 'Mei Lin', FALSE, TRUE, TIMESTAMPTZ '2026-07-20 09:00:00+12'),
    ('00000000-0000-4000-8000-000000000802', 'hana_park_petparent', '/maps-review/characters/02/hana-park-avatar.png', 'hana.park.wagstay.demo@gmail.com', '+64 21 555 1202', crypt(current_setting('app.seed_hana_password'), gen_salt('bf', 12)), 'Hana Park', FALSE, TRUE, TIMESTAMPTZ '2026-07-22 09:00:00+12'),
    ('00000000-0000-4000-8000-000000000803', 'priya_nair_petparent', '/maps-review/characters/02/priya-nair-avatar.png', 'priya.nair.wagstay.demo@gmail.com', '+64 21 555 1203', crypt(current_setting('app.seed_priya_password'), gen_salt('bf', 12)), 'Priya Nair', FALSE, TRUE, TIMESTAMPTZ '2026-07-27 09:00:00+12'),
    ('00000000-0000-4000-8000-000000000804', 'daniel_chen_petparent', '/maps-review/characters/02/daniel-chen-avatar.png', 'daniel.chen.wagstay.demo@gmail.com', '+64 21 555 1204', crypt(current_setting('app.seed_daniel_password'), gen_salt('bf', 12)), 'Daniel Chen', FALSE, TRUE, TIMESTAMPTZ '2026-08-02 09:00:00+12'),
    ('00000000-0000-4000-8000-000000000805', 'arjun_patel_petparent', '/maps-review/characters/02/arjun-patel-avatar.png', 'arjun.patel.wagstay.demo@gmail.com', '+64 21 555 1205', crypt(current_setting('app.seed_arjun_password'), gen_salt('bf', 12)), 'Arjun Patel', FALSE, TRUE, TIMESTAMPTZ '2026-08-05 09:00:00+12')
ON CONFLICT (uuid) DO UPDATE SET
    username = EXCLUDED.username,
    avatar_url = EXCLUDED.avatar_url,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    password_hash = EXCLUDED.password_hash,
    display_name = EXCLUDED.display_name,
    is_employee = EXCLUDED.is_employee,
    is_pet_owner = EXCLUDED.is_pet_owner,
    created_at = EXCLUDED.created_at;

INSERT INTO pet_owners (
    users_uuid, emergency_contact_number, first_name, last_name, address, date_of_birth
)
VALUES
    ('00000000-0000-4000-8000-000000000801', '+64 21 555 9201', 'Mei', 'Lin', '18 Tui Road, Mount Eden, Auckland 1024', DATE '1992-04-18'),
    ('00000000-0000-4000-8000-000000000802', '+64 21 555 9202', 'Hana', 'Park', '42 Kauri Avenue, Epsom, Auckland 1023', DATE '1988-09-27'),
    ('00000000-0000-4000-8000-000000000803', '+64 21 555 9203', 'Priya', 'Nair', '7 Pohutukawa Lane, Newmarket, Auckland 1023', DATE '1990-01-13'),
    ('00000000-0000-4000-8000-000000000804', '+64 21 555 9204', 'Daniel', 'Chen', '29 Rimu Street, Grey Lynn, Auckland 1021', DATE '1986-06-22'),
    ('00000000-0000-4000-8000-000000000805', '+64 21 555 9205', 'Arjun', 'Patel', '63 Kowhai Crescent, Onehunga, Auckland 1061', DATE '1989-11-05')
ON CONFLICT (users_uuid) DO UPDATE SET
    emergency_contact_number = EXCLUDED.emergency_contact_number,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    address = EXCLUDED.address,
    date_of_birth = EXCLUDED.date_of_birth;

INSERT INTO pets (
    uuid, pet_owners_uuid, image_url, name, breed, age, weight, species, status, date_of_birth,
    gender, diet_notes, allergies, behaviour_notes, created_at, updated_at, place, colour,
    desexed, vet_name, vet_phone, health_notes, emergency_contact, microchip_number
)
VALUES
    ('00000000-0000-4000-8000-000000000811', '00000000-0000-4000-8000-000000000801', '/maps-review/characters/02/miso-avatar.png', 'Miso', 'Ragdoll', 3, 4.8, 'cat', 'checked out', DATE '2023-02-09', FALSE, 'Wet food in the morning and measured dry food in the evening.', 'No known allergies.', 'Calm, affectionate, and slow to settle in unfamiliar rooms; prefers quiet handling.', TIMESTAMPTZ '2026-07-21 09:10:00+12', TIMESTAMPTZ '2026-08-14 15:20:00+12', 'PetHouse', 'seal point', TRUE, 'Dr Emily Wong', '+64 9 555 7201', 'Healthy adult cat. Synthetic annual wellness record; no current condition requiring treatment.', 'Daniel Lin, +64 21 555 9201', 'SYN-02-001-MISO'),
    ('00000000-0000-4000-8000-000000000812', '00000000-0000-4000-8000-000000000802', '/maps-review/characters/02/nori-avatar.png', 'Nori', 'British Shorthair', 6, 5.6, 'cat', 'checked out', DATE '2019-11-14', FALSE, 'Measured renal-support wet food split into two meals each day.', 'No known food allergies; avoid tuna-based treats.', 'Gentle and observant; accepts medication when mixed with a small amount of wet food.', TIMESTAMPTZ '2026-07-23 09:10:00+12', TIMESTAMPTZ '2026-08-17 14:35:00+12', 'PetHouse', 'blue-grey', TRUE, 'Dr Sarah Patel', '+64 9 555 7202', 'Synthetic managed thyroid condition with a stable routine and no reported acute symptoms.', 'Joon Park, +64 21 555 9202', 'SYN-02-002-NORI'),
    ('00000000-0000-4000-8000-000000000813', '00000000-0000-4000-8000-000000000803', '/maps-review/characters/02/kavi-avatar.png', 'Kavi', 'Maine Coon', 4, 6.9, 'cat', 'checked out', DATE '2021-06-03', TRUE, 'Long-hair formula dry food with a small wet-food topper at dinner.', 'No known allergies.', 'Friendly with familiar people; enjoys supervised brushing and calm window spaces.', TIMESTAMPTZ '2026-07-28 09:10:00+12', TIMESTAMPTZ '2026-08-22 16:10:00+12', 'PetHouse', 'brown tabby', TRUE, 'Dr Olivia Rao', '+64 9 555 7203', 'Healthy adult Maine Coon; synthetic dental and coat-care notes are routine only.', 'Anika Nair, +64 21 555 9203', 'SYN-02-003-KAVI'),
    ('00000000-0000-4000-8000-000000000814', '00000000-0000-4000-8000-000000000804', '/maps-review/characters/02/yuki-avatar.png', 'Yuki', 'Shiba Inu', 5, 10.2, 'dog', 'checked out', DATE '2021-01-28', FALSE, 'Measured adult dog food twice daily; no table scraps.', 'Synthetic mild environmental sensitivity; avoid strongly scented grooming products.', 'Alert but polite; needs a short quiet break after handling and settles with familiar cues.', TIMESTAMPTZ '2026-08-03 09:10:00+12', TIMESTAMPTZ '2026-08-25 13:45:00+12', 'PetHouse', 'red sesame', TRUE, 'Dr Michael Tan', '+64 9 555 7204', 'Synthetic mild atopic dermatitis managed under a stable veterinary plan; no acute symptoms described.', 'Rachel Chen, +64 21 555 9204', 'SYN-02-004-YUKI'),
    ('00000000-0000-4000-8000-000000000815', '00000000-0000-4000-8000-000000000805', '/maps-review/characters/02/tashi-avatar.png', 'Tashi', 'Border Collie', 2, 19.8, 'dog', 'checked out', DATE '2024-03-19', TRUE, 'High-energy adult dog food split into breakfast and dinner with measured training treats.', 'No known allergies.', 'Curious and energetic; responds well to structured enrichment and short rest periods.', TIMESTAMPTZ '2026-08-06 09:10:00+12', TIMESTAMPTZ '2026-08-29 15:30:00+12', 'PetHouse', 'black and white', TRUE, 'Dr Aroha Singh', '+64 9 555 7205', 'Healthy young adult Border Collie; synthetic exercise and rest guidance is routine only.', 'Neha Patel, +64 21 555 9205', 'SYN-02-005-TASHI')
ON CONFLICT (uuid) DO UPDATE SET
    pet_owners_uuid = EXCLUDED.pet_owners_uuid,
    image_url = EXCLUDED.image_url,
    name = EXCLUDED.name,
    breed = EXCLUDED.breed,
    age = EXCLUDED.age,
    weight = EXCLUDED.weight,
    species = EXCLUDED.species,
    status = EXCLUDED.status,
    date_of_birth = EXCLUDED.date_of_birth,
    gender = EXCLUDED.gender,
    diet_notes = EXCLUDED.diet_notes,
    allergies = EXCLUDED.allergies,
    behaviour_notes = EXCLUDED.behaviour_notes,
    updated_at = EXCLUDED.updated_at,
    place = EXCLUDED.place,
    colour = EXCLUDED.colour,
    desexed = EXCLUDED.desexed,
    vet_name = EXCLUDED.vet_name,
    vet_phone = EXCLUDED.vet_phone,
    health_notes = EXCLUDED.health_notes,
    emergency_contact = EXCLUDED.emergency_contact,
    microchip_number = EXCLUDED.microchip_number,
    created_at = EXCLUDED.created_at;

INSERT INTO pet_medications (
    uuid, pet_uuid, name, strength, dose, unit, route, schedule, with_food, instructions,
    prescribed_by, active, created_at, updated_at
)
VALUES
    ('00000000-0000-4000-8000-000000000871', '00000000-0000-4000-8000-000000000812', 'Methimazole', '2.5 mg', 1, 'tablet', 'ORAL', ARRAY['08:00', '20:00']::text[], TRUE, 'Give with a small amount of the scheduled wet food; record each administration.', 'Dr Sarah Patel', TRUE, TIMESTAMPTZ '2026-08-03 09:15:00+12', TIMESTAMPTZ '2026-08-17 14:35:00+12'),
    ('00000000-0000-4000-8000-000000000872', '00000000-0000-4000-8000-000000000814', 'Apoquel', '5.4 mg', 1, 'tablet', 'ORAL', ARRAY['09:00']::text[], FALSE, 'Give once each morning and record administration according to the supplied synthetic care plan.', 'Dr Michael Tan', TRUE, TIMESTAMPTZ '2026-08-12 09:15:00+12', TIMESTAMPTZ '2026-08-25 13:45:00+12')
ON CONFLICT (uuid) DO UPDATE SET
    pet_uuid = EXCLUDED.pet_uuid,
    name = EXCLUDED.name,
    strength = EXCLUDED.strength,
    dose = EXCLUDED.dose,
    unit = EXCLUDED.unit,
    route = EXCLUDED.route,
    schedule = EXCLUDED.schedule,
    with_food = EXCLUDED.with_food,
    instructions = EXCLUDED.instructions,
    prescribed_by = EXCLUDED.prescribed_by,
    active = EXCLUDED.active,
    updated_at = EXCLUDED.updated_at;

INSERT INTO bookings (uuid, pet_owners_uuid, created_at, status)
VALUES
    ('00000000-0000-4000-8000-000000000821', '00000000-0000-4000-8000-000000000801', TIMESTAMPTZ '2026-07-22 09:00:00+12', 'confirmed'),
    ('00000000-0000-4000-8000-000000000822', '00000000-0000-4000-8000-000000000802', TIMESTAMPTZ '2026-07-24 09:00:00+12', 'confirmed'),
    ('00000000-0000-4000-8000-000000000823', '00000000-0000-4000-8000-000000000803', TIMESTAMPTZ '2026-07-29 09:00:00+12', 'confirmed'),
    ('00000000-0000-4000-8000-000000000824', '00000000-0000-4000-8000-000000000804', TIMESTAMPTZ '2026-08-04 09:00:00+12', 'confirmed'),
    ('00000000-0000-4000-8000-000000000825', '00000000-0000-4000-8000-000000000805', TIMESTAMPTZ '2026-08-07 09:00:00+12', 'confirmed')
ON CONFLICT (uuid) DO UPDATE SET
    pet_owners_uuid = EXCLUDED.pet_owners_uuid,
    status = EXCLUDED.status,
    created_at = EXCLUDED.created_at;

INSERT INTO booking_pets (uuid, bookings_uuid, pet_uuid, created_at, drop_off_time, pick_up_time)
VALUES
    ('00000000-0000-4000-8000-000000000831', '00000000-0000-4000-8000-000000000821', '00000000-0000-4000-8000-000000000811', TIMESTAMPTZ '2026-07-22 09:10:00+12', TIMESTAMPTZ '2026-08-10 09:15:00+12', TIMESTAMPTZ '2026-08-14 15:20:00+12'),
    ('00000000-0000-4000-8000-000000000832', '00000000-0000-4000-8000-000000000822', '00000000-0000-4000-8000-000000000812', TIMESTAMPTZ '2026-07-24 09:10:00+12', TIMESTAMPTZ '2026-08-12 11:10:00+12', TIMESTAMPTZ '2026-08-17 14:35:00+12'),
    ('00000000-0000-4000-8000-000000000833', '00000000-0000-4000-8000-000000000823', '00000000-0000-4000-8000-000000000813', TIMESTAMPTZ '2026-07-29 09:10:00+12', TIMESTAMPTZ '2026-08-16 08:40:00+12', TIMESTAMPTZ '2026-08-22 16:10:00+12'),
    ('00000000-0000-4000-8000-000000000834', '00000000-0000-4000-8000-000000000824', '00000000-0000-4000-8000-000000000814', TIMESTAMPTZ '2026-08-04 09:10:00+12', TIMESTAMPTZ '2026-08-21 10:05:00+12', TIMESTAMPTZ '2026-08-25 13:45:00+12'),
    ('00000000-0000-4000-8000-000000000835', '00000000-0000-4000-8000-000000000825', '00000000-0000-4000-8000-000000000815', TIMESTAMPTZ '2026-08-07 09:10:00+12', TIMESTAMPTZ '2026-08-24 12:25:00+12', TIMESTAMPTZ '2026-08-29 15:30:00+12')
ON CONFLICT (uuid) DO UPDATE SET
    bookings_uuid = EXCLUDED.bookings_uuid,
    pet_uuid = EXCLUDED.pet_uuid,
    drop_off_time = EXCLUDED.drop_off_time,
    pick_up_time = EXCLUDED.pick_up_time,
    created_at = EXCLUDED.created_at;

WITH requested(booking_pets_uuid, services_uuid, created_at) AS (
    VALUES
        ('00000000-0000-4000-8000-000000000831'::uuid, 'a555438f-5f66-4e3c-8c3a-53b49ff8ede9'::uuid, TIMESTAMPTZ '2026-08-01 09:20:00+12'),
        ('00000000-0000-4000-8000-000000000831'::uuid, 'c68589a8-c0a7-41cc-a94b-41b52230e063'::uuid, TIMESTAMPTZ '2026-08-01 09:20:01+12'),
        ('00000000-0000-4000-8000-000000000831'::uuid, '00000000-0000-4000-8000-000000000704'::uuid, TIMESTAMPTZ '2026-08-01 09:20:02+12'),
        ('00000000-0000-4000-8000-000000000832'::uuid, '00000000-0000-4000-8000-000000000701'::uuid, TIMESTAMPTZ '2026-08-03 09:20:00+12'),
        ('00000000-0000-4000-8000-000000000832'::uuid, 'c68589a8-c0a7-41cc-a94b-41b52230e063'::uuid, TIMESTAMPTZ '2026-08-03 09:20:01+12'),
        ('00000000-0000-4000-8000-000000000832'::uuid, '8c14185a-3170-4c6b-a856-e575b1e9b354'::uuid, TIMESTAMPTZ '2026-08-03 09:20:02+12'),
        ('00000000-0000-4000-8000-000000000833'::uuid, 'a555438f-5f66-4e3c-8c3a-53b49ff8ede9'::uuid, TIMESTAMPTZ '2026-08-07 09:20:00+12'),
        ('00000000-0000-4000-8000-000000000833'::uuid, 'c68589a8-c0a7-41cc-a94b-41b52230e063'::uuid, TIMESTAMPTZ '2026-08-07 09:20:01+12'),
        ('00000000-0000-4000-8000-000000000833'::uuid, '00000000-0000-4000-8000-000000000704'::uuid, TIMESTAMPTZ '2026-08-07 09:20:02+12'),
        ('00000000-0000-4000-8000-000000000834'::uuid, '00000000-0000-4000-8000-000000000701'::uuid, TIMESTAMPTZ '2026-08-12 09:20:00+12'),
        ('00000000-0000-4000-8000-000000000834'::uuid, 'e1dbebe1-122d-48d5-892d-a9038b0ff0f0'::uuid, TIMESTAMPTZ '2026-08-12 09:20:01+12'),
        ('00000000-0000-4000-8000-000000000834'::uuid, '8c14185a-3170-4c6b-a856-e575b1e9b354'::uuid, TIMESTAMPTZ '2026-08-12 09:20:02+12'),
        ('00000000-0000-4000-8000-000000000835'::uuid, 'a555438f-5f66-4e3c-8c3a-53b49ff8ede9'::uuid, TIMESTAMPTZ '2026-08-15 09:20:00+12'),
        ('00000000-0000-4000-8000-000000000835'::uuid, '00000000-0000-4000-8000-000000000705'::uuid, TIMESTAMPTZ '2026-08-15 09:20:01+12'),
        ('00000000-0000-4000-8000-000000000835'::uuid, '00000000-0000-4000-8000-000000000702'::uuid, TIMESTAMPTZ '2026-08-15 09:20:02+12')
)
INSERT INTO booking_pets_services (
    booking_pets_uuid, services_uuid, quantity, price_at_booking, created_at
)
SELECT requested.booking_pets_uuid, service.uuid, 1, service.price, requested.created_at
FROM requested
JOIN services service ON service.uuid = requested.services_uuid
ON CONFLICT (booking_pets_uuid, services_uuid) DO UPDATE SET
    quantity = EXCLUDED.quantity,
    price_at_booking = EXCLUDED.price_at_booking;

INSERT INTO booking_pets_caring_info (
    booking_pets_uuid, feeding_routine, medication_instructions, first_time_boarding,
    crate_trained, other_notes, allows_socialization, fully_vaccinated, behavior_and_health_notes
)
VALUES
    ('00000000-0000-4000-8000-000000000831', 'Wet food at approximately 08:00 and measured dry food at 18:00.', 'No medication required.', FALSE, FALSE, 'Use a quiet room and allow Miso to approach staff first.', FALSE, TRUE, 'Calm Ragdoll; monitor appetite during the first evening.'),
    ('00000000-0000-4000-8000-000000000832', 'Renal-support wet food at approximately 08:00 and 20:00.', 'Methimazole 2.5 mg, one tablet orally at 08:00 and 20:00 with food.', TRUE, FALSE, 'Keep medication log visible to the assigned care team.', FALSE, TRUE, 'Stable thyroid-care routine; monitor appetite and hydration.'),
    ('00000000-0000-4000-8000-000000000833', 'Long-hair formula food at approximately 08:00 and wet-food topper at 18:30.', 'No medication required.', FALSE, FALSE, 'Offer supervised brushing if Kavi approaches calmly.', FALSE, TRUE, 'Large, social cat; provide a quiet space and monitor coat condition.'),
    ('00000000-0000-4000-8000-000000000834', 'Measured adult dog food at approximately 08:00 and 18:00.', 'Apoquel 5.4 mg, one tablet orally at 09:00; record administration.', FALSE, TRUE, 'Avoid strongly scented grooming products and provide a quiet break after handling.', FALSE, TRUE, 'Alert Shiba Inu with synthetic mild dermatitis; use the supplied grooming notes.'),
    ('00000000-0000-4000-8000-000000000835', 'Adult dog food at approximately 07:30 and 18:00 with measured training treats.', 'No medication required.', TRUE, TRUE, 'Use structured enrichment followed by a quiet rest period.', TRUE, TRUE, 'Energetic Border Collie; balance enrichment with rest.')
ON CONFLICT (booking_pets_uuid) DO UPDATE SET
    feeding_routine = EXCLUDED.feeding_routine,
    medication_instructions = EXCLUDED.medication_instructions,
    first_time_boarding = EXCLUDED.first_time_boarding,
    crate_trained = EXCLUDED.crate_trained,
    other_notes = EXCLUDED.other_notes,
    allows_socialization = EXCLUDED.allows_socialization,
    fully_vaccinated = EXCLUDED.fully_vaccinated,
    behavior_and_health_notes = EXCLUDED.behavior_and_health_notes;

INSERT INTO reviewer_identities (
    uuid, provider, provider_subject, email, display_name, avatar_url, created_at, updated_at
)
VALUES
    ('00000000-0000-4000-8000-000000000841', 'google', 'mock-google-mei-miso-002', 'mei.lin.wagstay.demo@gmail.com', 'Mei Lin', '/maps-review/characters/02/mei-lin-avatar.png', TIMESTAMPTZ '2026-08-15 10:00:00+12', TIMESTAMPTZ '2026-08-15 10:00:00+12'),
    ('00000000-0000-4000-8000-000000000842', 'google', 'mock-google-hana-nori-002', 'hana.park.wagstay.demo@gmail.com', 'Hana Park', '/maps-review/characters/02/hana-park-avatar.png', TIMESTAMPTZ '2026-08-18 09:20:00+12', TIMESTAMPTZ '2026-08-18 09:20:00+12'),
    ('00000000-0000-4000-8000-000000000843', 'google', 'mock-google-priya-kavi-003', 'priya.nair.wagstay.demo@gmail.com', 'Priya Nair', '/maps-review/characters/02/priya-nair-avatar.png', TIMESTAMPTZ '2026-08-23 11:00:00+12', TIMESTAMPTZ '2026-08-23 11:00:00+12'),
    ('00000000-0000-4000-8000-000000000844', 'google', 'mock-google-daniel-yuki-004', 'daniel.chen.wagstay.demo@gmail.com', 'Daniel Chen', '/maps-review/characters/02/daniel-chen-avatar.png', TIMESTAMPTZ '2026-08-26 08:30:00+12', TIMESTAMPTZ '2026-08-26 08:30:00+12'),
    ('00000000-0000-4000-8000-000000000845', 'google', 'mock-google-arjun-tashi-005', 'arjun.patel.wagstay.demo@gmail.com', 'Arjun Patel', '/maps-review/characters/02/arjun-patel-avatar.png', TIMESTAMPTZ '2026-08-30 10:15:00+12', TIMESTAMPTZ '2026-08-30 10:15:00+12')
ON CONFLICT (uuid) DO UPDATE SET
    provider = EXCLUDED.provider,
    provider_subject = EXCLUDED.provider_subject,
    email = EXCLUDED.email,
    display_name = EXCLUDED.display_name,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = EXCLUDED.updated_at;

INSERT INTO google_business_reviews (
    uuid, google_business_location_uuid, google_review_id, google_resource_name,
    reviewer_display_name, reviewer_profile_photo_url, reviewer_is_anonymous, rating, comment,
    google_created_at, google_updated_at, data_origin, created_at, updated_at
)
VALUES
    ('00000000-0000-4000-8000-000000000851', '00000000-0000-4000-8000-000000000401', 'mock-mei-miso-review-002', 'accounts/mock-pethouse-account/locations/mock-pethouse-location/reviews/mock-mei-miso-review-002', 'Mei Lin', '/maps-review/characters/02/mei-lin-avatar.png', FALSE, 5, $$Miso settled beautifully into the Deluxe suite, and the team kept her feeding routine exactly as we requested. The wellness updates were clear and reassuring, and it was obvious that staff gave her the quiet space she needed. I would happily book PetHouse again.$$, TIMESTAMPTZ '2026-08-15 10:00:00+12', TIMESTAMPTZ '2026-08-15 10:00:00+12', 'mock', TIMESTAMPTZ '2026-08-15 10:00:00+12', TIMESTAMPTZ '2026-08-15 10:00:00+12'),
    ('00000000-0000-4000-8000-000000000852', '00000000-0000-4000-8000-000000000401', 'mock-hana-nori-review-002', 'accounts/mock-pethouse-account/locations/mock-pethouse-location/reviews/mock-hana-nori-review-002', 'Hana Park', '/maps-review/characters/02/hana-park-avatar.png', FALSE, 4, $$Nori came home relaxed and well cared for after her first stay. I appreciated how carefully the team followed her food and medication routine, and the check-in communication was thoughtful. The whole process felt organised and reassuring.$$, TIMESTAMPTZ '2026-08-18 09:20:00+12', TIMESTAMPTZ '2026-08-18 09:20:00+12', 'mock', TIMESTAMPTZ '2026-08-18 09:20:00+12', TIMESTAMPTZ '2026-08-18 09:20:00+12'),
    ('00000000-0000-4000-8000-000000000853', '00000000-0000-4000-8000-000000000401', 'mock-priya-kavi-review-003', 'accounts/mock-pethouse-account/locations/mock-pethouse-location/reviews/mock-priya-kavi-review-003', 'Priya Nair', '/maps-review/characters/02/priya-nair-avatar.png', FALSE, 3, $$Kavi was comfortable and the team were kind throughout his stay. For longer cat bookings, it would be helpful to receive a few more individual photo updates, especially for cats who spend most of their time in a quiet room. The wellness information was useful, and this would make it even easier to feel connected while they are away.$$, TIMESTAMPTZ '2026-08-23 11:00:00+12', TIMESTAMPTZ '2026-08-23 11:00:00+12', 'mock', TIMESTAMPTZ '2026-08-23 11:00:00+12', TIMESTAMPTZ '2026-08-23 11:00:00+12'),
    ('00000000-0000-4000-8000-000000000854', '00000000-0000-4000-8000-000000000401', 'mock-daniel-yuki-review-004', 'accounts/mock-pethouse-account/locations/mock-pethouse-location/reviews/mock-daniel-yuki-review-004', 'Daniel Chen', '/maps-review/characters/02/daniel-chen-avatar.png', FALSE, 2, $$Yuki was safe and the staff were polite, but the grooming outcome was disappointing. Her coat still felt strongly scented at pickup and the finish was not what we expected from the Grooming session. The medication routine was handled carefully, but I would like the grooming notes and final check to be clearer before booking this service again.$$, TIMESTAMPTZ '2026-08-26 08:30:00+12', TIMESTAMPTZ '2026-08-26 08:30:00+12', 'mock', TIMESTAMPTZ '2026-08-26 08:30:00+12', TIMESTAMPTZ '2026-08-26 08:30:00+12'),
    ('00000000-0000-4000-8000-000000000855', '00000000-0000-4000-8000-000000000401', 'mock-arjun-tashi-review-005', 'accounts/mock-pethouse-account/locations/mock-pethouse-location/reviews/mock-arjun-tashi-review-005', 'Arjun Patel', '/maps-review/characters/02/arjun-patel-avatar.png', FALSE, 4, $$Tashi had a great stay and came home happy and nicely tired. The mix of enrichment and daycare suited his energy, and the Deluxe suite gave him a comfortable place to rest between activities. The team communicated clearly and made the first booking feel easy.$$, TIMESTAMPTZ '2026-08-30 10:15:00+12', TIMESTAMPTZ '2026-08-30 10:15:00+12', 'mock', TIMESTAMPTZ '2026-08-30 10:15:00+12', TIMESTAMPTZ '2026-08-30 10:15:00+12')
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
    data_origin = EXCLUDED.data_origin,
    updated_at = EXCLUDED.updated_at;

INSERT INTO google_review_media_logs (
    google_business_reviews_uuid, photo_url, created_at
)
VALUES
    ('00000000-0000-4000-8000-000000000851', '/uploads/google-reviews/character-set-02/miso-review.png', TIMESTAMPTZ '2026-08-15 10:01:00+12'),
    ('00000000-0000-4000-8000-000000000852', '/uploads/google-reviews/character-set-02/nori-review.png', TIMESTAMPTZ '2026-08-18 09:21:00+12'),
    ('00000000-0000-4000-8000-000000000853', '/uploads/google-reviews/character-set-02/kavi-review.png', TIMESTAMPTZ '2026-08-23 11:01:00+12'),
    ('00000000-0000-4000-8000-000000000854', '/uploads/google-reviews/character-set-02/yuki-review.png', TIMESTAMPTZ '2026-08-26 08:31:00+12'),
    ('00000000-0000-4000-8000-000000000855', '/uploads/google-reviews/character-set-02/tashi-review.png', TIMESTAMPTZ '2026-08-30 10:16:00+12')
ON CONFLICT (google_business_reviews_uuid, created_at) DO UPDATE SET
    photo_url = EXCLUDED.photo_url;

INSERT INTO external_feedback (
    uuid, google_business_review_uuid, is_read, current_status, ai_insights, created_at, updated_at
)
VALUES
    ('00000000-0000-4000-8000-000000000861', '00000000-0000-4000-8000-000000000851', FALSE, 'received', $$
{"summary":"The reviewer praised Miso's quiet stay, consistent feeding routine, and clear wellness updates.","triageType":"praise","triageConfidence":"high"}
$$::jsonb, TIMESTAMPTZ '2026-08-15 10:05:00+12', TIMESTAMPTZ '2026-08-15 10:05:00+12'),
    ('00000000-0000-4000-8000-000000000862', '00000000-0000-4000-8000-000000000852', FALSE, 'received', $$
{"summary":"The reviewer praised the team for following Nori's food and medication routine during her first stay.","triageType":"praise","triageConfidence":"high"}
$$::jsonb, TIMESTAMPTZ '2026-08-18 09:25:00+12', TIMESTAMPTZ '2026-08-18 09:25:00+12'),
    ('00000000-0000-4000-8000-000000000863', '00000000-0000-4000-8000-000000000853', FALSE, 'received', $$
{"summary":"The reviewer described a comfortable stay and requested more individual photo updates for longer cat bookings.","triageType":"suggestion","triageConfidence":"high"}
$$::jsonb, TIMESTAMPTZ '2026-08-23 11:05:00+12', TIMESTAMPTZ '2026-08-23 11:05:00+12'),
    ('00000000-0000-4000-8000-000000000864', '00000000-0000-4000-8000-000000000854', FALSE, 'received', $$
{"summary":"The reviewer reported a disappointing grooming outcome while noting that Yuki's medication routine was handled carefully.","triageType":"issue","triageConfidence":"medium"}
$$::jsonb, TIMESTAMPTZ '2026-08-26 08:35:00+12', TIMESTAMPTZ '2026-08-26 08:35:00+12'),
    ('00000000-0000-4000-8000-000000000865', '00000000-0000-4000-8000-000000000855', FALSE, 'received', $$
{"summary":"The reviewer praised Tashi's enrichment, daycare, comfortable rest space, and clear communication.","triageType":"praise","triageConfidence":"high"}
$$::jsonb, TIMESTAMPTZ '2026-08-30 10:20:00+12', TIMESTAMPTZ '2026-08-30 10:20:00+12')
ON CONFLICT (uuid) DO UPDATE SET
    google_business_review_uuid = EXCLUDED.google_business_review_uuid,
    is_read = EXCLUDED.is_read,
    current_status = EXCLUDED.current_status,
    ai_insights = EXCLUDED.ai_insights,
    updated_at = EXCLUDED.updated_at;

SELECT
    'Character Set 02 migration completed' AS result,
    (SELECT COUNT(*) FROM users WHERE uuid IN (
        '00000000-0000-4000-8000-000000000801'::uuid,
        '00000000-0000-4000-8000-000000000802'::uuid,
        '00000000-0000-4000-8000-000000000803'::uuid,
        '00000000-0000-4000-8000-000000000804'::uuid,
        '00000000-0000-4000-8000-000000000805'::uuid
    )) AS users_created,
    (SELECT COUNT(*) FROM pets WHERE uuid IN (
        '00000000-0000-4000-8000-000000000811'::uuid,
        '00000000-0000-4000-8000-000000000812'::uuid,
        '00000000-0000-4000-8000-000000000813'::uuid,
        '00000000-0000-4000-8000-000000000814'::uuid,
        '00000000-0000-4000-8000-000000000815'::uuid
    )) AS pets_created,
    (SELECT COUNT(*) FROM google_business_reviews WHERE uuid IN (
        '00000000-0000-4000-8000-000000000851'::uuid,
        '00000000-0000-4000-8000-000000000852'::uuid,
        '00000000-0000-4000-8000-000000000853'::uuid,
        '00000000-0000-4000-8000-000000000854'::uuid,
        '00000000-0000-4000-8000-000000000855'::uuid
    )) AS reviews_created;
