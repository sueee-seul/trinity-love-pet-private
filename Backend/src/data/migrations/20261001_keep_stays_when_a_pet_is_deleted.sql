-- Owner approved on 2026-10-01: a parent may delete a pet's profile, but its past stays, payments
-- and feedback stay on record (sales records are kept seven years, Tax Administration Act s 22).
--   1. booking_pets.pet_name keeps the pet's name on each stay, filled from pets for existing rows.
--   2. booking_pets.pet_uuid becomes nullable and is set to NULL when the pet is deleted.
--   3. feedback.pet_uuid becomes nullable and is set to NULL when the pet is deleted.
-- The foreign keys are found by column rather than by name, so the file works whatever the
-- constraints were called when the tables were created. Safe to run twice.
BEGIN;

ALTER TABLE booking_pets ADD COLUMN IF NOT EXISTS pet_name VARCHAR(100);
COMMENT ON COLUMN booking_pets.pet_name IS 'The pet''s name when booked; kept after the pet is deleted';

UPDATE booking_pets bp
   SET pet_name = p.name
  FROM pets p
 WHERE p.uuid = bp.pet_uuid
   AND bp.pet_name IS NULL;

DO $migration$
DECLARE
  target RECORD;
BEGIN
  FOR target IN
    SELECT c.conrelid::regclass AS table_name, c.conname AS constraint_name
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
     WHERE c.contype = 'f'
       AND c.confrelid = 'pets'::regclass
       AND c.conrelid IN ('booking_pets'::regclass, 'feedback'::regclass)
       AND a.attname = 'pet_uuid'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', target.table_name, target.constraint_name);
  END LOOP;
END
$migration$;

ALTER TABLE booking_pets ALTER COLUMN pet_uuid DROP NOT NULL;
ALTER TABLE booking_pets
  ADD CONSTRAINT booking_pets_pet_uuid_fkey
  FOREIGN KEY (pet_uuid) REFERENCES pets (uuid) ON DELETE SET NULL;

ALTER TABLE feedback ALTER COLUMN pet_uuid DROP NOT NULL;
ALTER TABLE feedback
  ADD CONSTRAINT feedback_pet_uuid_fkey
  FOREIGN KEY (pet_uuid) REFERENCES pets (uuid) ON DELETE SET NULL;

COMMIT;
