-- Split the single users.role value into independent account identity flags.
-- One users row can now be both an employee and a pet owner.

BEGIN;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_employee BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_pet_owner BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'role'
    ) THEN
        EXECUTE $migration$
            UPDATE users
            SET is_employee = (role = 'employee'),
                is_pet_owner = (role = 'pet_owner')
        $migration$;

        ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
        ALTER TABLE users DROP COLUMN role;
    END IF;
END;
$$;

UPDATE users AS u
SET is_employee = TRUE,
    is_pet_owner = TRUE
WHERE EXISTS (
          SELECT 1
          FROM employees AS e
          WHERE e.users_uuid = u.uuid
      )
  AND EXISTS (
          SELECT 1
          FROM pet_owners AS p
          WHERE p.users_uuid = u.uuid
      );

COMMIT;
