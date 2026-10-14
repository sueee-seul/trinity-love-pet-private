-- Owner approval 2026-10-05 ("schema changes may be made freely" for the consumer flow work).
--
-- stay_memory_notes: one short note per pet per Auckland day of a stay, written by the booking job
-- from the day's records right after the daily update (Scenario 11 outcome 7, memory across a
-- multi-day stay, and stretch goal 2, trends). The parent chat injects the latest notes into its
-- context; Live care can show them; the stay report reads them for highlights. Facts are kept
-- beside the words so the next note can compare days without parsing text.
--
-- escalations gains the 'behaviour_trend' source: an appetite drop two days running is raised to
-- staff as a normal escalation.
--
-- Down path: DROP TABLE stay_memory_notes; restore the previous escalations_source_check.
BEGIN;

CREATE TABLE IF NOT EXISTS stay_memory_notes (
    uuid               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_pets_uuid  UUID NOT NULL REFERENCES booking_pets(uuid) ON DELETE CASCADE,
    note_date          DATE NOT NULL,
    locale             VARCHAR(5) NOT NULL DEFAULT 'en',
    body               TEXT NOT NULL,
    facts              JSONB NOT NULL DEFAULT '{}'::jsonb,
    generated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (booking_pets_uuid, note_date)
);

CREATE INDEX IF NOT EXISTS stay_memory_notes_stay_idx
    ON stay_memory_notes (booking_pets_uuid, note_date DESC);

ALTER TABLE escalations DROP CONSTRAINT IF EXISTS escalations_source_check;
ALTER TABLE escalations
  ADD CONSTRAINT escalations_source_check CHECK (source IN (
    'medication_overdue', 'parent_message', 'incident', 'image_flag', 'support_requested',
    'behaviour_trend', 'other'));

COMMIT;
