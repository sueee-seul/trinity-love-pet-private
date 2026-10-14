-- Align tasks and daily_routine with the current schema and fixture contract.
-- The task-to-pet relationship is backfilled before booking_pets_uuid is removed.

BEGIN;

ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS pet_uuid UUID REFERENCES pets(uuid) ON DELETE CASCADE;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'tasks'
          AND column_name = 'booking_pets_uuid'
    ) THEN
        EXECUTE $migration$
            UPDATE tasks AS t
            SET pet_uuid = bp.pet_uuid
            FROM booking_pets AS bp
            WHERE t.booking_pets_uuid = bp.uuid
              AND t.pet_uuid IS NULL
        $migration$;

        IF EXISTS (
            SELECT 1
            FROM tasks
            WHERE booking_pets_uuid IS NOT NULL
              AND pet_uuid IS NULL
        ) THEN
            RAISE EXCEPTION
                'Cannot migrate tasks: one or more booking_pets_uuid values do not resolve to a pet';
        END IF;
    END IF;
END;
$$;

ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS priority VARCHAR(20) NOT NULL DEFAULT 'mid';

ALTER TABLE tasks
DROP CONSTRAINT IF EXISTS tasks_priority_check;

ALTER TABLE tasks
ADD CONSTRAINT tasks_priority_check
CHECK (priority IN ('low', 'mid', 'high', 'urgent'));

ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

ALTER TABLE daily_routine
ADD COLUMN IF NOT EXISTS category VARCHAR(80) NOT NULL DEFAULT 'custom';

ALTER TABLE daily_routine
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE daily_routine
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Existing routine fixtures already carry the intended category in task_type.
UPDATE daily_routine
SET category = task_type
WHERE category = 'custom'
  AND task_type IS NOT NULL
  AND task_type <> '';

-- Carry existing routine metadata into generated task fixtures.
UPDATE tasks AS t
SET
    priority = CASE
        WHEN routine.priority = 'medium' THEN 'mid'
        WHEN routine.priority IN ('low', 'mid', 'high', 'urgent') THEN routine.priority
        ELSE 'mid'
    END,
    description = COALESCE(t.description, routine.description)
FROM daily_routine AS routine
WHERE t.generated_from = routine.uuid;

ALTER TABLE tasks
DROP CONSTRAINT IF EXISTS tasks_template_or_real_check;

ALTER TABLE tasks
DROP COLUMN IF EXISTS booking_pets_uuid;

ALTER TABLE tasks
DROP COLUMN IF EXISTS is_template;

DROP INDEX IF EXISTS tasks_booking_pets_status_idx;

CREATE INDEX IF NOT EXISTS tasks_pet_status_idx ON tasks (pet_uuid, status);

COMMIT;
