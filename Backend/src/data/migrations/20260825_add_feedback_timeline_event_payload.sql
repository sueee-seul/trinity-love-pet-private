-- Add structured event data for persisted Suggestion workflow events.
ALTER TABLE feedback_timeline_events
ADD COLUMN event_payload JSONB NOT NULL DEFAULT '{}'::jsonb;
