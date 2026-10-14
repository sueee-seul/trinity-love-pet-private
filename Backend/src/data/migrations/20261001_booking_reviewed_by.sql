-- Owner approved booking_pets.reviewed_by_uuid on 2026-10-01: the manager who approved or refused
-- a stay is its direct contact, so parents and other managers see who decided.
-- Do not backfill: nothing records who made the earlier decisions.
BEGIN;
ALTER TABLE booking_pets
  ADD COLUMN IF NOT EXISTS reviewed_by_uuid uuid REFERENCES users(uuid) ON DELETE SET NULL;
COMMENT ON COLUMN booking_pets.reviewed_by_uuid IS 'Manager who made the current approve or refuse decision; null while pending, when confirmed at checkout, or for older decisions';
COMMIT;
