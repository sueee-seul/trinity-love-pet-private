-- Restore the parent submission event for legacy Issue and Praise feedback rows.
-- The event timestamp must remain the parent submission time, not a staff review time.
INSERT INTO feedback_timeline_events (feedback_uuid, step, event_payload, created_at)
SELECT
    f.uuid,
    'submitted',
    jsonb_build_object(
        'actor', 'System',
        'backfilled', true
    ),
    f.created_at
FROM feedback AS f
WHERE f.category IN ('Issue', 'Praise')
  AND NOT EXISTS (
      SELECT 1
      FROM feedback_timeline_events AS existing_event
      WHERE existing_event.feedback_uuid = f.uuid
        AND existing_event.step = 'submitted'
  )
ON CONFLICT (feedback_uuid, step) DO NOTHING;
