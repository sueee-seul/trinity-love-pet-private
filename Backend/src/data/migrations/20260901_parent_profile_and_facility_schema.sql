-- Closes the remaining gaps between the canonical schema and what the Parent
-- Profile and Facility repositories query, now that those repositories read
-- and write PostgreSQL only (no in-memory fixture fallback).
--
-- Everything else those repositories need (users.legacy_id, users.display_name,
-- users.is_employee/is_pet_owner, employees.staff_role/staff_status/
-- employee_number, and the pets.colour/desexed/vet_name/vet_phone/
-- health_notes/behaviour_notes columns) already exists on the canonical
-- `database/neon.sql` schema and on `20260827_split_user_role_flags.sql`.
-- This migration only adds what is still missing.

BEGIN;

-- A pet's own emergency contact (distinct from the owner's account-level
-- `pet_owners.emergency_contact_number`) — the parent profile screen lets a
-- parent record a different contact per pet (e.g. a second caregiver).
ALTER TABLE pets
    ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(200);

-- Prevents two rows from claiming the same legacy `u1`-style id or the same
-- generated staff number. Partial so historical/normal rows with no value in
-- either column are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS users_legacy_id_unique
    ON users (legacy_id) WHERE legacy_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS employees_employee_number_unique
    ON employees (employee_number) WHERE employee_number IS NOT NULL;

-- `pet_medication` (the canonical table name; the application code used to
-- query a `pet_medications` table it created for itself at request time) had
-- no foreign key back to the pet it belongs to and no lookup index.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_name = 'pet_medication'
          AND constraint_name = 'pet_medication_pet_uuid_fkey'
    ) THEN
        ALTER TABLE pet_medication
            ADD CONSTRAINT pet_medication_pet_uuid_fkey
            FOREIGN KEY (pet_uuid) REFERENCES pets (uuid) ON DELETE CASCADE;
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS pet_medication_pet_uuid_idx ON pet_medication (pet_uuid);

COMMIT;
