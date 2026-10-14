-- Owner approved booking_pets.approved_at for cancellation grace periods.
-- Do not backfill: submission time is not evidence of when a manager approved.
BEGIN;
ALTER TABLE booking_pets ADD COLUMN IF NOT EXISTS approved_at timestamptz;
COMMENT ON COLUMN booking_pets.approved_at IS 'Latest approval transition; null for pending or unknown historical approvals';
COMMIT;
