-- Seed the app-owned mock PetHouse facility used by the review page.
-- This is local application data; it is not a Google Maps or Business Profile record.

BEGIN;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM facilities
        WHERE name = 'PetHouse'
          AND uuid <> '00000000-0000-4000-8000-000000000306'::UUID
    ) THEN
        RAISE EXCEPTION
            'A facility named PetHouse already exists with a different UUID';
    END IF;
END;
$$;

INSERT INTO facilities (
    uuid,
    name,
    suburb,
    city,
    size,
    capacity,
    address,
    phone,
    email,
    about
)
VALUES (
    '00000000-0000-4000-8000-000000000306'::UUID,
    'PetHouse',
    'Grey Lynn',
    'Auckland',
    'MEDIUM',
    40,
    '18 PetHouse Lane, Grey Lynn, Auckland 1021',
    '+64 9 555 0306',
    'pethouse@example.test',
    'Mock PetHouse facility for the review page prototype.'
)
ON CONFLICT (uuid) DO NOTHING;

COMMIT;
