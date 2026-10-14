-- Synthetic Asuna/Mia evidence-loop scenario for the bounded Google Review investigation.
--
-- This file is intentionally data-only. It does not alter the schema, runtime
-- configuration, or any unrelated rows. Apply it against the configured
-- SELF_DATABASE_URL with psql -v asuna_password_hash='<bcrypt-hash>'.
-- The one-time plaintext password is generated outside this SQL file; only its
-- bcrypt hash is supplied to and stored by the seed.

\if :{?asuna_password_hash}
\else
\set asuna_password_hash ''
\endif

SET app.seed_asuna_password_hash TO :'asuna_password_hash';

DO $$
BEGIN
    IF NULLIF(current_setting('app.seed_asuna_password_hash', true), '') IS NULL THEN
        RAISE EXCEPTION 'asuna_password_hash is required and must be supplied at execution time';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'booking_pets'
          AND column_name = 'manager_review_status'
    ) THEN
        RAISE EXCEPTION 'The target database does not expose booking_pets.manager_review_status';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM google_business_locations
        WHERE uuid = '00000000-0000-4000-8000-000000000401'::uuid
          AND google_location_id = 'mock-pethouse-location'
    ) THEN
        RAISE EXCEPTION 'The PetHouse Google location fixture is missing';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM services
        WHERE uuid IN (
            'a555438f-5f66-4e3c-8c3a-53b49ff8ede9'::uuid,
            'c68589a8-c0a7-41cc-a94b-41b52230e063'::uuid,
            'bd259cc8-031e-4ff8-be89-000701046ca4'::uuid,
            'e1dbebe1-122d-48d5-892d-a9038b0ff0f0'::uuid,
            '8c14185a-3170-4c6b-a856-e575b1e9b354'::uuid
        )
    ) <> 5 THEN
        RAISE EXCEPTION 'One or more requested Asuna/Mia services are missing';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM users
        WHERE (lower(username) = lower('Asuna') OR lower(email) = lower('asuna.wagstay.demo@gmail.com'))
          AND uuid <> '321fd231-d122-4a58-a344-f396531c1785'::uuid
    ) THEN
        RAISE EXCEPTION 'Asuna username or synthetic email is already owned by another user';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM reviewer_identities
        WHERE provider = 'google'
          AND provider_subject = 'mock-google-asuna-mia-20260920'
          AND uuid <> 'ecfe5c9b-d6cd-4f77-af8a-1042144a06ad'::uuid
    ) THEN
        RAISE EXCEPTION 'The synthetic Asuna Google reviewer identity is already occupied';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM google_business_reviews
        WHERE google_review_id = 'mock-asuna-mia-review-20260920'
          AND uuid <> '00cdac15-3755-48eb-b29f-a2bf0cdb9bca'::uuid
    ) THEN
        RAISE EXCEPTION 'The synthetic Asuna Google review ID is already occupied';
    END IF;
END;
$$;

BEGIN;

INSERT INTO users (
    uuid,
    username,
    email,
    password_hash,
    display_name,
    is_employee,
    is_pet_owner,
    created_at
)
VALUES (
    '321fd231-d122-4a58-a344-f396531c1785'::uuid,
    'Asuna',
    'asuna.wagstay.demo@gmail.com',
    current_setting('app.seed_asuna_password_hash'),
    'Asuna',
    false,
    true,
    TIMESTAMPTZ '2026-08-25 09:00:00+12'
)
ON CONFLICT (uuid) DO UPDATE SET
    username = EXCLUDED.username,
    email = EXCLUDED.email,
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
    '321fd231-d122-4a58-a344-f396531c1785'::uuid,
    '+64 21 000 0001',
    'Asuna',
    'Synthetic',
    'Synthetic test address, Auckland'
)
ON CONFLICT (users_uuid) DO UPDATE SET
    emergency_contact_number = EXCLUDED.emergency_contact_number,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    address = EXCLUDED.address;

INSERT INTO pets (
    uuid,
    pet_owners_uuid,
    name,
    breed,
    species,
    status,
    created_at,
    updated_at,
    place,
    health_notes
)
VALUES (
    '6b4e4e8a-c942-410b-bf6c-f7ad019ff61b'::uuid,
    '321fd231-d122-4a58-a344-f396531c1785'::uuid,
    'Mia',
    'British Shorthair',
    'cat',
    'checked out',
    TIMESTAMPTZ '2026-08-25 09:10:00+12',
    TIMESTAMPTZ '2026-09-18 15:30:00+12',
    'PetHouse',
    'Synthetic scenario: injury occurred during the second stay on 2026-09-16.'
)
ON CONFLICT (uuid) DO UPDATE SET
    pet_owners_uuid = EXCLUDED.pet_owners_uuid,
    name = EXCLUDED.name,
    breed = EXCLUDED.breed,
    species = EXCLUDED.species,
    status = EXCLUDED.status,
    updated_at = EXCLUDED.updated_at,
    place = EXCLUDED.place,
    health_notes = EXCLUDED.health_notes;

INSERT INTO bookings (
    uuid,
    pet_owners_uuid,
    created_at,
    status
)
VALUES
    (
        '270d0ed9-919f-4567-9bd1-1156c8aae757'::uuid,
        '321fd231-d122-4a58-a344-f396531c1785'::uuid,
        TIMESTAMPTZ '2026-08-20 09:00:00+12',
        'paid'
    ),
    (
        '4316cf5b-9735-492a-81e4-cfefeb87360c'::uuid,
        '321fd231-d122-4a58-a344-f396531c1785'::uuid,
        TIMESTAMPTZ '2026-09-01 09:00:00+12',
        'paid'
    )
ON CONFLICT (uuid) DO UPDATE SET
    pet_owners_uuid = EXCLUDED.pet_owners_uuid,
    created_at = EXCLUDED.created_at,
    status = EXCLUDED.status;

INSERT INTO booking_pets (
    uuid,
    bookings_uuid,
    pet_uuid,
    created_at,
    drop_off_time,
    pick_up_time,
    manager_review_status,
    refusal_reason
)
VALUES
    (
        '5f0600f3-75cd-4748-8462-031749c04bc9'::uuid,
        '270d0ed9-919f-4567-9bd1-1156c8aae757'::uuid,
        '6b4e4e8a-c942-410b-bf6c-f7ad019ff61b'::uuid,
        TIMESTAMPTZ '2026-08-20 09:10:00+12',
        TIMESTAMPTZ '2026-09-08 09:00:00+12',
        TIMESTAMPTZ '2026-09-10 15:00:00+12',
        'approved',
        NULL
    ),
    (
        '37e98f8f-9922-492c-9e91-dabb8d9e3202'::uuid,
        '4316cf5b-9735-492a-81e4-cfefeb87360c'::uuid,
        '6b4e4e8a-c942-410b-bf6c-f7ad019ff61b'::uuid,
        TIMESTAMPTZ '2026-09-01 09:10:00+12',
        TIMESTAMPTZ '2026-09-14 09:00:00+12',
        TIMESTAMPTZ '2026-09-18 15:00:00+12',
        'approved',
        NULL
    )
ON CONFLICT (uuid) DO UPDATE SET
    bookings_uuid = EXCLUDED.bookings_uuid,
    pet_uuid = EXCLUDED.pet_uuid,
    drop_off_time = EXCLUDED.drop_off_time,
    pick_up_time = EXCLUDED.pick_up_time,
    manager_review_status = EXCLUDED.manager_review_status,
    refusal_reason = EXCLUDED.refusal_reason;

WITH requested(booking_pets_uuid, services_uuid, created_at) AS (
    VALUES
        (
            '5f0600f3-75cd-4748-8462-031749c04bc9'::uuid,
            'a555438f-5f66-4e3c-8c3a-53b49ff8ede9'::uuid,
            TIMESTAMPTZ '2026-08-20 09:20:00+12'
        ),
        (
            '5f0600f3-75cd-4748-8462-031749c04bc9'::uuid,
            'c68589a8-c0a7-41cc-a94b-41b52230e063'::uuid,
            TIMESTAMPTZ '2026-08-20 09:20:01+12'
        ),
        (
            '37e98f8f-9922-492c-9e91-dabb8d9e3202'::uuid,
            'a555438f-5f66-4e3c-8c3a-53b49ff8ede9'::uuid,
            TIMESTAMPTZ '2026-09-01 09:20:00+12'
        ),
        (
            '37e98f8f-9922-492c-9e91-dabb8d9e3202'::uuid,
            'c68589a8-c0a7-41cc-a94b-41b52230e063'::uuid,
            TIMESTAMPTZ '2026-09-01 09:20:01+12'
        ),
        (
            '37e98f8f-9922-492c-9e91-dabb8d9e3202'::uuid,
            'e1dbebe1-122d-48d5-892d-a9038b0ff0f0'::uuid,
            TIMESTAMPTZ '2026-09-01 09:20:02+12'
        ),
        (
            '37e98f8f-9922-492c-9e91-dabb8d9e3202'::uuid,
            'bd259cc8-031e-4ff8-be89-000701046ca4'::uuid,
            TIMESTAMPTZ '2026-09-01 09:20:03+12'
        ),
        (
            '37e98f8f-9922-492c-9e91-dabb8d9e3202'::uuid,
            '8c14185a-3170-4c6b-a856-e575b1e9b354'::uuid,
            TIMESTAMPTZ '2026-09-01 09:20:04+12'
        )
)
INSERT INTO booking_pets_services (
    booking_pets_uuid,
    services_uuid,
    quantity,
    price_at_booking,
    created_at
)
SELECT requested.booking_pets_uuid, service.uuid, 1, service.price, requested.created_at
FROM requested
JOIN services AS service ON service.uuid = requested.services_uuid
ON CONFLICT (booking_pets_uuid, services_uuid) DO UPDATE SET
    quantity = EXCLUDED.quantity,
    price_at_booking = EXCLUDED.price_at_booking,
    created_at = EXCLUDED.created_at;

INSERT INTO booking_pets_caring_info (
    booking_pets_uuid,
    feeding_routine,
    medication_instructions,
    other_notes
)
VALUES
    (
        '5f0600f3-75cd-4748-8462-031749c04bc9'::uuid,
        'House food during the stay.',
        NULL,
        'The first stay completed smoothly.'
    ),
    (
        '37e98f8f-9922-492c-9e91-dabb8d9e3202'::uuid,
        'Three meals per day.',
        'Two doses per day.',
        'Follow the supplied feeding and medication instructions during the stay.'
    )
ON CONFLICT (booking_pets_uuid) DO UPDATE SET
    feeding_routine = EXCLUDED.feeding_routine,
    medication_instructions = EXCLUDED.medication_instructions,
    other_notes = EXCLUDED.other_notes;

INSERT INTO tasks (
    uuid,
    employees_uuid,
    title,
    category,
    task_type,
    created_at,
    status,
    issue,
    scheduled_at,
    pet_uuid,
    priority,
    description,
    completed_at
)
VALUES
    (
        'e6672f40-736e-4f75-8a55-b4d93507b4dd'::uuid,
        NULL,
        'Daily care — 2026-09-14',
        'wellness',
        'staff',
        TIMESTAMPTZ '2026-09-14 17:00:00+12',
        'completed',
        NULL,
        TIMESTAMPTZ '2026-09-14 17:00:00+12',
        '6b4e4e8a-c942-410b-bf6c-f7ad019ff61b'::uuid,
        'mid',
        'Daily care was completed as planned.',
        TIMESTAMPTZ '2026-09-14 17:05:00+12'
    ),
    (
        '85565c0c-fae1-4d34-ac61-3225d6821f0a'::uuid,
        NULL,
        'Daily care — 2026-09-15',
        'wellness',
        'staff',
        TIMESTAMPTZ '2026-09-15 17:00:00+12',
        'completed',
        NULL,
        TIMESTAMPTZ '2026-09-15 17:00:00+12',
        '6b4e4e8a-c942-410b-bf6c-f7ad019ff61b'::uuid,
        'mid',
        'Daily care was completed as planned.',
        TIMESTAMPTZ '2026-09-15 17:05:00+12'
    ),
    (
        '75299c8c-e00d-45de-9764-a9dce01b0550'::uuid,
        NULL,
        'Feeding (morning)',
        'feeding',
        'pet',
        TIMESTAMPTZ '2026-09-16 08:00:00+12',
        'completed',
        'Three-meal instruction followed for this meal.',
        TIMESTAMPTZ '2026-09-16 08:00:00+12',
        '6b4e4e8a-c942-410b-bf6c-f7ad019ff61b'::uuid,
        'mid',
        'House food.',
        TIMESTAMPTZ '2026-09-16 08:10:00+12'
    ),
    (
        '9c92b9b4-d20a-40fb-8eed-422249c7759e'::uuid,
        NULL,
        'Feeding (midday)',
        'feeding',
        'pet',
        TIMESTAMPTZ '2026-09-16 13:00:00+12',
        'completed',
        'Three-meal instruction followed for this meal.',
        TIMESTAMPTZ '2026-09-16 13:00:00+12',
        '6b4e4e8a-c942-410b-bf6c-f7ad019ff61b'::uuid,
        'mid',
        'House food.',
        TIMESTAMPTZ '2026-09-16 13:10:00+12'
    ),
    (
        'ae71905f-88c0-4c4f-bdb5-c1d8c405679a'::uuid,
        NULL,
        'Injury incident',
        'incident',
        'staff',
        TIMESTAMPTZ '2026-09-16 18:10:00+12',
        'completed',
        'Wound required veterinary attention.',
        TIMESTAMPTZ '2026-09-16 18:10:00+12',
        '6b4e4e8a-c942-410b-bf6c-f7ad019ff61b'::uuid,
        'urgent',
        'Mia was injured after a dispute with another cat.',
        TIMESTAMPTZ '2026-09-16 18:15:00+12'
    ),
    (
        '296e0d73-50d7-42eb-a819-a52f45fbadb8'::uuid,
        NULL,
        'Owner notification attempt',
        'communication',
        'staff',
        TIMESTAMPTZ '2026-09-16 18:20:00+12',
        'completed',
        'No response to the phone call.',
        TIMESTAMPTZ '2026-09-16 18:20:00+12',
        '6b4e4e8a-c942-410b-bf6c-f7ad019ff61b'::uuid,
        'high',
        'Called Asuna to notify her about Mia''s injury and the need for veterinary care.',
        TIMESTAMPTZ '2026-09-16 18:22:00+12'
    ),
    (
        '6b7fa190-e6e2-4303-8871-6b0f9e3f5b8e'::uuid,
        NULL,
        'Veterinary transfer',
        'incident',
        'staff',
        TIMESTAMPTZ '2026-09-16 18:35:00+12',
        'completed',
        'Transport proceeded after the notification call received no response.',
        TIMESTAMPTZ '2026-09-16 18:35:00+12',
        '6b4e4e8a-c942-410b-bf6c-f7ad019ff61b'::uuid,
        'urgent',
        'Mia was taken to a veterinary clinic after the injury.',
        TIMESTAMPTZ '2026-09-16 18:40:00+12'
    ),
    (
        'd356819d-6efe-4a94-b0c4-0e263c9d23e0'::uuid,
        NULL,
        'Feeding (evening)',
        'feeding',
        'pet',
        TIMESTAMPTZ '2026-09-16 18:00:00+12',
        'cancelled',
        'Not completed because Mia was at a veterinary clinic after the injury; no feeding record was entered for this meal.',
        TIMESTAMPTZ '2026-09-16 18:00:00+12',
        '6b4e4e8a-c942-410b-bf6c-f7ad019ff61b'::uuid,
        'high',
        'House food.',
        NULL
    ),
    (
        'c41918b1-0ec1-4228-b232-3920c9a691b7'::uuid,
        NULL,
        'Daily care — 2026-09-17',
        'wellness',
        'staff',
        TIMESTAMPTZ '2026-09-17 17:00:00+12',
        'completed',
        NULL,
        TIMESTAMPTZ '2026-09-17 17:00:00+12',
        '6b4e4e8a-c942-410b-bf6c-f7ad019ff61b'::uuid,
        'mid',
        'Daily care was completed as planned.',
        TIMESTAMPTZ '2026-09-17 17:05:00+12'
    ),
    (
        '4f49395c-22c8-41df-84bf-57f7d52f759c'::uuid,
        NULL,
        'Checkout observation',
        'incident',
        'staff',
        TIMESTAMPTZ '2026-09-18 15:00:00+12',
        'completed',
        'Parent expressed dissatisfaction at checkout.',
        TIMESTAMPTZ '2026-09-18 15:00:00+12',
        '6b4e4e8a-c942-410b-bf6c-f7ad019ff61b'::uuid,
        'high',
        'Mia was checked out with a bandaged wound; Asuna was unhappy at pickup.',
        TIMESTAMPTZ '2026-09-18 15:05:00+12'
    )
ON CONFLICT (uuid) DO UPDATE SET
    employees_uuid = EXCLUDED.employees_uuid,
    title = EXCLUDED.title,
    category = EXCLUDED.category,
    task_type = EXCLUDED.task_type,
    created_at = EXCLUDED.created_at,
    status = EXCLUDED.status,
    issue = EXCLUDED.issue,
    scheduled_at = EXCLUDED.scheduled_at,
    pet_uuid = EXCLUDED.pet_uuid,
    priority = EXCLUDED.priority,
    description = EXCLUDED.description,
    completed_at = EXCLUDED.completed_at;

INSERT INTO feeding_logs (tasks_uuid, eaten_amount, medication_given, notes)
VALUES
    (
        '75299c8c-e00d-45de-9764-a9dce01b0550'::uuid,
        'complete',
        NULL,
        'Morning feeding completed.'
    ),
    (
        '9c92b9b4-d20a-40fb-8eed-422249c7759e'::uuid,
        'complete',
        NULL,
        'Midday feeding completed.'
    )
ON CONFLICT (tasks_uuid) DO UPDATE SET
    eaten_amount = EXCLUDED.eaten_amount,
    medication_given = EXCLUDED.medication_given,
    notes = EXCLUDED.notes;

INSERT INTO reviewer_identities (
    uuid,
    provider,
    provider_subject,
    email,
    display_name,
    avatar_url,
    created_at,
    updated_at
)
VALUES (
    'ecfe5c9b-d6cd-4f77-af8a-1042144a06ad'::uuid,
    'google',
    'mock-google-asuna-mia-20260920',
    'asuna.wagstay.demo@gmail.com',
    'Asuna',
    NULL,
    TIMESTAMPTZ '2026-09-20 10:00:00+12',
    TIMESTAMPTZ '2026-09-20 10:00:00+12'
)
ON CONFLICT (uuid) DO UPDATE SET
    provider = EXCLUDED.provider,
    provider_subject = EXCLUDED.provider_subject,
    email = EXCLUDED.email,
    display_name = EXCLUDED.display_name,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = EXCLUDED.updated_at;

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
    data_origin,
    created_at,
    updated_at
)
VALUES (
    '00cdac15-3755-48eb-b29f-a2bf0cdb9bca'::uuid,
    '00000000-0000-4000-8000-000000000401'::uuid,
    'mock-asuna-mia-review-20260920',
    'accounts/mock-pethouse-account/locations/mock-pethouse-location/reviews/mock-asuna-mia-review-20260920',
    'Asuna',
    NULL,
    false,
    1,
    $review$Staff made decisions without waiting for my response, then asked me to pay extra medical costs. They did not follow my instructions. At checkout I saw my cat had a bandaged wound, and I was very unhappy.$review$,
    TIMESTAMPTZ '2026-09-20 10:00:00+12',
    TIMESTAMPTZ '2026-09-20 10:00:00+12',
    'mock',
    TIMESTAMPTZ '2026-09-20 10:00:00+12',
    TIMESTAMPTZ '2026-09-20 10:00:00+12'
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
    data_origin = EXCLUDED.data_origin,
    updated_at = EXCLUDED.updated_at;

INSERT INTO external_feedback (
    uuid,
    google_business_review_uuid,
    is_read,
    current_status,
    created_at,
    updated_at
)
VALUES (
    '69e20f27-ff41-4708-8767-5fbae66eb905'::uuid,
    '00cdac15-3755-48eb-b29f-a2bf0cdb9bca'::uuid,
    false,
    'received',
    TIMESTAMPTZ '2026-09-20 10:05:00+12',
    TIMESTAMPTZ '2026-09-20 10:05:00+12'
)
ON CONFLICT (uuid) DO UPDATE SET
    google_business_review_uuid = EXCLUDED.google_business_review_uuid,
    is_read = EXCLUDED.is_read,
    current_status = EXCLUDED.current_status,
    updated_at = EXCLUDED.updated_at;

INSERT INTO feedback_timeline_events (
    uuid,
    external_feedback_uuid,
    step,
    created_at,
    event_payload
)
VALUES (
    '4d14221c-e790-47f7-b4c8-c65ef536797f'::uuid,
    '69e20f27-ff41-4708-8767-5fbae66eb905'::uuid,
    'investigation_requested',
    TIMESTAMPTZ '2026-09-20 10:05:00+12',
    jsonb_build_object(
        'contractVersion', '2.0',
        'eventType', 'investigation_requested',
        'requestId', '889ba063-5ab2-44aa-ac81-a7249e546352',
        'runId', '783f4a3f-06f1-47fd-87d1-08b6a13f4c2a',
        'reviewUuid', '00cdac15-3755-48eb-b29f-a2bf0cdb9bca',
        'outputLanguage', 'en-NZ',
        'status', 'queued'
    )
)
ON CONFLICT (uuid) DO UPDATE SET
    external_feedback_uuid = EXCLUDED.external_feedback_uuid,
    step = EXCLUDED.step,
    created_at = EXCLUDED.created_at,
    event_payload = EXCLUDED.event_payload;

COMMIT;
