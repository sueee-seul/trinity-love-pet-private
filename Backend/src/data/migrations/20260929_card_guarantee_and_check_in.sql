-- Schema for the card-guaranteed instant booking on the newbooking branch.
--
-- Why:
-- - The one-step booking form no longer asks for an emergency contact, and the home address is
--   optional, so pet_owners accepts NULL in both columns. No law requires either
--   (Code of Welfare: Temporary Housing of Companion Animals, Privacy Act 2020 IPP 1).
-- - A booking saves the guest's card and holds the price 48 hours before drop-off. The payment row
--   records the hold ('authorized'), a released hold ('canceled'), the Stripe PaymentIntent that
--   holds the money, and the amount actually captured (a 50% late-cancellation or no-show fee
--   captures part of the hold and releases the rest).
-- - bookings.reminder_sent_at makes the 48-hour reminder email go out once, and
--   bookings.reschedule_count limits free reschedules to one per booking.
-- - booking_pets.check_in_outcome is what staff record at the desk: checked in, no-show (or papers
--   not fixed the same day), or Wagstay unable to take the pet. The capture amount follows it.
-- - booking_pets.manager_review_status may be 'cancelled' so a guest can cancel without deleting
--   rows. The Trinity Neon database already has this CHECK (applied from the rebuild branch); it is
--   restated here so a database built from this branch's migrations accepts it too.
--
-- Approved by the owner on 2026-09-29 for the Trinity Neon database: exactly these changes. Nothing
-- is dropped except the two CHECK constraints that are replaced with wider ones. Safe to run more
-- than once.

BEGIN;

ALTER TABLE pet_owners
  ALTER COLUMN emergency_contact_number DROP NOT NULL,
  ALTER COLUMN address DROP NOT NULL;

ALTER TABLE booking_payments
  DROP CONSTRAINT IF EXISTS booking_payments_status_check;

ALTER TABLE booking_payments
  ADD CONSTRAINT booking_payments_status_check
  CHECK (status IN ('pending', 'authorized', 'succeeded', 'canceled', 'failed', 'refunded'));

ALTER TABLE booking_payments
  ADD COLUMN IF NOT EXISTS processor_payment_intent_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS captured_amount NUMERIC(10,2);

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reschedule_count SMALLINT NOT NULL DEFAULT 0;

ALTER TABLE booking_pets
  ADD COLUMN IF NOT EXISTS check_in_outcome VARCHAR(20),
  ADD COLUMN IF NOT EXISTS check_in_recorded_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bookings_reschedule_count_check'
  ) THEN
    ALTER TABLE bookings
      ADD CONSTRAINT bookings_reschedule_count_check
      CHECK (reschedule_count >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'booking_pets_check_in_outcome_check'
  ) THEN
    ALTER TABLE booking_pets
      ADD CONSTRAINT booking_pets_check_in_outcome_check
      CHECK (check_in_outcome IN ('checked_in', 'no_show', 'wagstay_unable'));
  END IF;
END $$;

ALTER TABLE booking_pets
  DROP CONSTRAINT IF EXISTS booking_pets_manager_review_status_check;

ALTER TABLE booking_pets
  ADD CONSTRAINT booking_pets_manager_review_status_check
  CHECK (manager_review_status IN ('pending', 'approved', 'refused', 'cancelled'));

COMMIT;
