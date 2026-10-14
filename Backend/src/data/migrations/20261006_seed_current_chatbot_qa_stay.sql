-- Current-stay fixture for the Hana Kowalski chatbot QA account.
-- Provides one approved, checked-in stay for Pepper on the scenario date.
BEGIN;

INSERT INTO bookings (uuid, pet_owners_uuid, created_at, status)
SELECT '96060600-0000-4000-8000-000000000007'::uuid,
       pet.pet_owners_uuid,
       TIMESTAMPTZ '2026-10-01 09:00:00+13',
       'paid'
FROM pets pet
JOIN pet_owners owner ON owner.users_uuid = pet.pet_owners_uuid
WHERE lower(owner.first_name) = 'hana'
  AND lower(owner.last_name) = 'kowalski'
  AND lower(pet.name) = 'pepper'
ON CONFLICT (uuid) DO UPDATE
SET pet_owners_uuid = EXCLUDED.pet_owners_uuid,
    status = EXCLUDED.status;

INSERT INTO booking_pets (
  uuid, bookings_uuid, pet_uuid, created_at, drop_off_time, pick_up_time,
  manager_review_status, check_in_outcome, check_in_recorded_at
)
SELECT '96060600-0000-4000-8000-000000000008'::uuid,
       '96060600-0000-4000-8000-000000000007'::uuid,
       pet.uuid,
       TIMESTAMPTZ '2026-10-01 09:10:00+13',
       TIMESTAMPTZ '2026-10-06 08:00:00+13',
       TIMESTAMPTZ '2026-10-08 12:00:00+13',
       'approved',
       'checked_in',
       TIMESTAMPTZ '2026-10-06 08:05:00+13'
FROM pets pet
JOIN pet_owners owner ON owner.users_uuid = pet.pet_owners_uuid
WHERE lower(owner.first_name) = 'hana'
  AND lower(owner.last_name) = 'kowalski'
  AND lower(pet.name) = 'pepper'
ON CONFLICT (uuid) DO UPDATE
SET bookings_uuid = EXCLUDED.bookings_uuid,
    pet_uuid = EXCLUDED.pet_uuid,
    drop_off_time = EXCLUDED.drop_off_time,
    pick_up_time = EXCLUDED.pick_up_time,
    manager_review_status = EXCLUDED.manager_review_status,
    check_in_outcome = EXCLUDED.check_in_outcome,
    check_in_recorded_at = EXCLUDED.check_in_recorded_at;

INSERT INTO booking_pets_services (
  booking_pets_uuid, services_uuid, quantity, price_at_booking, created_at
)
SELECT '96060600-0000-4000-8000-000000000008'::uuid,
       service.uuid,
       2,
       service.price,
       TIMESTAMPTZ '2026-10-01 09:20:00+13'
FROM services service
WHERE service.category = 'boarding_rate'
ORDER BY service.created_at
LIMIT 1
ON CONFLICT (booking_pets_uuid, services_uuid) DO UPDATE
SET quantity = EXCLUDED.quantity,
    price_at_booking = EXCLUDED.price_at_booking;

COMMIT;
