-- Lets a booking pet be cancelled, and stores the vaccination certificate a pet parent uploads.
--
-- Why:
-- - A pet parent can withdraw a pending request or cancel an approved stay. The row is kept (no
--   hard delete, so the history and the payment trail stay), and its review state becomes
--   'cancelled'. 20260929_booking_pets_manager_review.sql only allows pending, approved and
--   refused, and it adds its CHECK only when missing, so the constraint is replaced here.
-- - The Vaccination information page lets the parent upload a certificate for one stay
--   (docs/homepage-backend-plan.md). The object key of the private file and the time it was
--   uploaded are kept on the stay's caring info.
--
-- Approved by the owner on 2026-09-29 for the Trinity Neon database: exactly these two changes,
-- one widened CHECK and two new nullable columns. Safe to run more than once.

BEGIN;

ALTER TABLE booking_pets
  DROP CONSTRAINT IF EXISTS booking_pets_manager_review_status_check;

ALTER TABLE booking_pets
  ADD CONSTRAINT booking_pets_manager_review_status_check
  CHECK (manager_review_status IN ('pending', 'approved', 'refused', 'cancelled'));

ALTER TABLE booking_pets_caring_info
  ADD COLUMN IF NOT EXISTS vaccination_document_url TEXT,
  ADD COLUMN IF NOT EXISTS vaccination_document_uploaded_at TIMESTAMPTZ;

COMMIT;
