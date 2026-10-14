-- Adds the manager review state to booking_pets.
--
-- Why: the manager booking review (approve, refuse, undo) and the pet list read and write
-- booking_pets.manager_review_status and booking_pets.refusal_reason
-- (Backend/src/repositories/manager.booking.repository.ts, pet.repository.ts,
-- task.assignment.repository.ts), but Backend/database/neon.sql never defines them, so a
-- database built from neon.sql fails those pages with "column does not exist". The definition
-- follows docs/admin-bookings-api.md: 'pending' until a manager acts, and a reason only when
-- refused.
--
-- Approved by the owner on 2026-09-28 for the Trinity Neon database. Safe to run more than once.

BEGIN;

ALTER TABLE booking_pets
  ADD COLUMN IF NOT EXISTS manager_review_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS refusal_reason TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'booking_pets_manager_review_status_check'
  ) THEN
    ALTER TABLE booking_pets
      ADD CONSTRAINT booking_pets_manager_review_status_check
      CHECK (manager_review_status IN ('pending', 'approved', 'refused'));
  END IF;
END $$;

COMMIT;
