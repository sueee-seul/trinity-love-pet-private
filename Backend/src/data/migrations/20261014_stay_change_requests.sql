-- Owner decision 2026-10-14: a change to a stay under way (more nights, an add-on, a new drop-off
-- or pick-up time) is a request, not an action. The parent asks in My Stays or the chat; a manager
-- approves or refuses it; only an approved request changes the booking, its bill and the care
-- tasks. Nothing is paid online: the quoted amount is paid at the desk at pick-up.
--
-- `details` holds what was asked, by kind:
--   extend:          { "endDate": "YYYY-MM-DD" }
--   early_check_out: reserved; early pick-up is not offered online yet
--   add_on:          { "serviceId": uuid, "serviceName": text, "date": "YYYY-MM-DD", "quantity": n }
--   times:           { "dropOffTime"?: "HH:MM", "pickUpTime"?: "HH:MM" }
--
-- Down path: DROP TABLE stay_change_requests; (no other table references it).

BEGIN;

CREATE TABLE IF NOT EXISTS stay_change_requests (
    uuid               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bookings_uuid      UUID NOT NULL REFERENCES bookings(uuid) ON DELETE CASCADE,
    booking_pets_uuid  UUID REFERENCES booking_pets(uuid) ON DELETE CASCADE,
    pet_owners_uuid    UUID NOT NULL REFERENCES pet_owners(users_uuid),
    kind               VARCHAR(20) NOT NULL
                       CHECK (kind IN ('extend', 'early_check_out', 'add_on', 'times')),
    details            JSONB NOT NULL,
    quoted_amount      NUMERIC(10, 2),
    status             VARCHAR(20) NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'approved', 'refused', 'cancelled')),
    refusal_reason     TEXT,
    decided_by_uuid    UUID REFERENCES users(uuid) ON DELETE SET NULL,
    decided_at         TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stay_change_requests_status_idx
    ON stay_change_requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS stay_change_requests_booking_idx
    ON stay_change_requests (bookings_uuid, created_at DESC);

COMMIT;
