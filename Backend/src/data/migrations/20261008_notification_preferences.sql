-- Owner approval 2026-10-05 ("schema changes may be made freely" for the consumer flow work).
-- How each parent wants to hear from us (Scenario 11: updates "in the parent's language", and the
-- "radio silence" problem): the language their updates and emails are written in, the Auckland hour
-- the daily update arrives, quiet hours for anything that is not a safety event, and whether the
-- updates are also emailed (the bell always has them). One row per owner; an owner without a row
-- has the defaults below, which are what every parent had before this table existed.
--
-- daily_summaries learns the language each update was written in, and the "settled in" note sent
-- on the drop-off day becomes a third kind beside the daily update and the stay report.
--
-- Down path: DROP TABLE notification_preferences; ALTER TABLE daily_summaries DROP COLUMN locale;
-- ALTER TABLE daily_summaries DROP CONSTRAINT daily_summaries_kind_check, ADD CONSTRAINT
-- daily_summaries_kind_check CHECK (kind IN ('daily', 'stay_report')) after deleting 'arrival' rows.
BEGIN;

CREATE TABLE IF NOT EXISTS notification_preferences (
    pet_owners_uuid   UUID PRIMARY KEY REFERENCES pet_owners(users_uuid) ON DELETE CASCADE,
    locale            VARCHAR(5)  NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'zh')),
    -- The Auckland hour (0 to 23) the day's update is written and sent.
    digest_hour       SMALLINT    NOT NULL DEFAULT 17 CHECK (digest_hour BETWEEN 0 AND 23),
    -- Nothing but a safety notice is sent between these Auckland hours; equal means no quiet hours.
    quiet_start       SMALLINT    NOT NULL DEFAULT 22 CHECK (quiet_start BETWEEN 0 AND 23),
    quiet_end         SMALLINT    NOT NULL DEFAULT 7  CHECK (quiet_end BETWEEN 0 AND 23),
    -- Whether the daily update, the arrival note and the stay report are also emailed.
    email_updates     BOOLEAN     NOT NULL DEFAULT true,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE daily_summaries
  ADD COLUMN IF NOT EXISTS locale VARCHAR(5) NOT NULL DEFAULT 'en';

ALTER TABLE daily_summaries DROP CONSTRAINT IF EXISTS daily_summaries_kind_check;
ALTER TABLE daily_summaries
  ADD CONSTRAINT daily_summaries_kind_check CHECK (kind IN ('daily', 'stay_report', 'arrival'));

COMMIT;
