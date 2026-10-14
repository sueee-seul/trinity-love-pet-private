-- Owner approval 2026-10-05 ("schema changes may be made freely" for the consumer flow work).
-- A ledger for money that moves while a pet is staying: a stay extended by some nights, a priced
-- add-on for one day, or a refund for an early pick-up. Each row is one processor charge or refund
-- on the booking's saved card. The stay's own payment row in booking_payments is left exactly as
-- the desk and the cancellation code expect it (one row per booking), so nothing there changes.
--
-- amount: positive when the card was charged, negative when money went back to it.
-- processor_payment_intent_id: the charge made, or the earlier charge a refund came out of.
-- idempotency_key: the key sent to the processor, unique so a retry can never record twice.
--
-- Down path: DROP TABLE booking_charges; (no other table references it).
BEGIN;

CREATE TABLE IF NOT EXISTS booking_charges (
    uuid                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bookings_uuid                 UUID NOT NULL REFERENCES bookings(uuid) ON DELETE CASCADE,
    booking_pets_uuid             UUID REFERENCES booking_pets(uuid) ON DELETE SET NULL,
    kind                          VARCHAR(24) NOT NULL
                                  CHECK (kind IN ('extension', 'add_on', 'early_pickup_refund')),
    services_uuid                 UUID REFERENCES services(uuid),
    service_date                  DATE,
    quantity                      INTEGER CHECK (quantity IS NULL OR quantity > 0),
    description                   TEXT NOT NULL,
    amount                        NUMERIC(10,2) NOT NULL CHECK (amount <> 0),
    currency                      CHAR(3) NOT NULL DEFAULT 'NZD',
    processor                     VARCHAR(50) NOT NULL,
    processor_payment_intent_id   VARCHAR(255),
    idempotency_key               VARCHAR(255) NOT NULL UNIQUE,
    created_at                    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS booking_charges_booking_idx
    ON booking_charges (bookings_uuid, created_at);

COMMIT;
