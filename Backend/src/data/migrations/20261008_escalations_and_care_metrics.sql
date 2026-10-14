-- Owner approval 2026-10-05 ("schema changes may be made freely" for the consumer flow work).
--
-- escalations: one row each time something needs a person (Scenario 11 outcome 8): what happened,
-- what the record shows, the suggested next step, and a reply-by time. Raised by the medication
-- overdue pass today; the parent chat and the staff pages can raise and resolve them through the
-- same service. The manager bell notice is written beside the row; this table is the record.
--
-- care_metrics_events: the events behind Scenario 11 outcome 9 (reply time, escalations and how
-- long they took, overdue doses, updates sent). Append only; a weekly report reads it.
--
-- Down path: DROP TABLE care_metrics_events; DROP TABLE escalations; (nothing references them).
BEGIN;

CREATE TABLE IF NOT EXISTS escalations (
    uuid               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_uuid       UUID REFERENCES bookings(uuid) ON DELETE SET NULL,
    booking_pets_uuid  UUID REFERENCES booking_pets(uuid) ON DELETE SET NULL,
    source             VARCHAR(32) NOT NULL CHECK (source IN (
                         'medication_overdue', 'parent_message', 'incident', 'image_flag',
                         'support_requested', 'other')),
    severity           VARCHAR(16) NOT NULL CHECK (severity IN ('urgent', 'normal')),
    -- What happened and what the record shows, in plain sentences.
    summary            TEXT NOT NULL,
    suggested_step     TEXT NOT NULL,
    suggested_reply    TEXT,
    -- The parent's own words when a message raised it; never rewritten.
    parent_message     TEXT,
    reply_by           TIMESTAMPTZ NOT NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Set once when the reply-by time passed with no resolution and managers were told again.
    late_flagged_at    TIMESTAMPTZ,
    resolved_at        TIMESTAMPTZ,
    resolved_by        UUID REFERENCES employees(users_uuid),
    resolution         TEXT
);

CREATE INDEX IF NOT EXISTS escalations_open_idx
    ON escalations (reply_by) WHERE resolved_at IS NULL;

CREATE TABLE IF NOT EXISTS care_metrics_events (
    uuid          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind          VARCHAR(40) NOT NULL,
    booking_uuid  UUID REFERENCES bookings(uuid) ON DELETE SET NULL,
    -- Seconds for reply times, minutes for an escalation's time to resolve; null for a plain count.
    value         NUMERIC,
    meta          JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS care_metrics_events_time_idx
    ON care_metrics_events (occurred_at DESC, kind);

COMMIT;
