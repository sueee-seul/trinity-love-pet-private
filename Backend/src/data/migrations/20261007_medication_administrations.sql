-- Owner approval 2026-10-05 ("schema changes may be made freely" for the consumer flow work).
-- One row per dose a staying pet is due: the medicine, the slot, the instant it is due in Auckland
-- time and the care task staff tick. What happened to the dose is read from that task (completed:
-- given at completed_at; cancelled: not given, the task's issue says why; otherwise due, and
-- overdue once the window has passed). The chat and the parent's live care answer medication
-- questions only from these rows (Scenario 11 outcome 6: never confirm a dose that is not recorded).
--
-- Down path: DROP TABLE medication_administrations; (no other table references it).
BEGIN;

CREATE TABLE IF NOT EXISTS medication_administrations (
    uuid                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_pets_uuid       UUID NOT NULL REFERENCES booking_pets(uuid) ON DELETE CASCADE,
    pet_medications_uuid    UUID NOT NULL REFERENCES pet_medications(uuid) ON DELETE CASCADE,
    tasks_uuid              UUID UNIQUE REFERENCES tasks(uuid) ON DELETE SET NULL,
    scheduled_for           TIMESTAMPTZ NOT NULL,
    slot                    VARCHAR(40) NOT NULL,
    dose                    NUMERIC(10,2) NOT NULL,
    unit                    VARCHAR(50) NOT NULL,
    -- When staff were told this dose was overdue; null until then, so each dose alerts once.
    alerted_at              TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (booking_pets_uuid, pet_medications_uuid, scheduled_for)
);

CREATE INDEX IF NOT EXISTS medication_administrations_due_idx
    ON medication_administrations (scheduled_for)
    WHERE alerted_at IS NULL;

COMMIT;
