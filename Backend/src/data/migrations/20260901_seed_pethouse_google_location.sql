-- Seed the app-owned mock PetHouse Google Business location used by the review page.
-- This is provider-shaped application data; it is not a Google Maps or Business Profile record.

BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM facilities
        WHERE uuid = '00000000-0000-4000-8000-000000000306'::UUID
    ) THEN
        RAISE EXCEPTION
            'The PetHouse facility UUID does not exist';
    END IF;

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

INSERT INTO google_business_locations (
    uuid,
    facility_uuid,
    google_account_id,
    google_location_id,
    google_place_id,
    display_name,
    formatted_address,
    google_maps_uri,
    aggregate_rating,
    user_rating_count,
    data_origin,
    last_observed_at
)
VALUES (
    '00000000-0000-4000-8000-000000000401'::UUID,
    '00000000-0000-4000-8000-000000000306'::UUID,
    'mock-pethouse-account',
    'mock-pethouse-location',
    NULL,
    'PetHouse',
    '18 PetHouse Lane, Grey Lynn, Auckland 1021',
    NULL,
    NULL,
    0,
    'mock',
    NULL
)
ON CONFLICT DO NOTHING;

COMMIT;
