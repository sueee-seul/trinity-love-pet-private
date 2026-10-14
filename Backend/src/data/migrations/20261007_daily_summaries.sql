-- Owner approval 2026-10-05 ("schema changes may be made freely" for the consumer flow work).
-- The update a parent receives without asking (Scenario 11 outcome 3): one row per checked-in pet
-- per Auckland day, written once by the booking job from the day's tasks, photos and dose record,
-- plus one "how the stay went" report on the pick-up day (stretch goal: reunification report).
-- The row is the record of what was sent; the text is never rewritten.
--
-- Down path: DROP TABLE daily_summaries; (no other table references it).
BEGIN;

CREATE TABLE IF NOT EXISTS daily_summaries (
    uuid                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_pets_uuid   UUID NOT NULL REFERENCES booking_pets(uuid) ON DELETE CASCADE,
    summary_date        DATE NOT NULL,
    kind                VARCHAR(16) NOT NULL CHECK (kind IN ('daily', 'stay_report')),
    body                TEXT NOT NULL,
    -- The one curated photo, as a path the signed-in parent can open; null when none was taken.
    photo_path          TEXT,
    -- The counts the text was written from, so a page can show them without parsing the text.
    facts               JSONB NOT NULL DEFAULT '{}'::jsonb,
    generated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (booking_pets_uuid, summary_date, kind)
);

CREATE INDEX IF NOT EXISTS daily_summaries_stay_idx
    ON daily_summaries (booking_pets_uuid, summary_date DESC);

COMMIT;
