-- Restore the initial persisted workflow event for legacy Suggestion records.
INSERT INTO feedback_timeline_events (feedback_uuid, step, event_payload, created_at)
SELECT
    f.uuid,
    'captured',
    jsonb_build_object(
        'workflow_type', 'suggestion',
        'ownerId', 'u1',
        'decision', NULL,
        'evidenceSummary', NULL,
        'decisionReason', NULL,
        'nextReviewAt', NULL,
        'actor', 'System'
    ),
    f.created_at
FROM feedback AS f
WHERE f.category = 'Suggestion'
  AND NOT EXISTS (
      SELECT 1
      FROM feedback_timeline_events AS existing_event
      WHERE existing_event.feedback_uuid = f.uuid
        AND existing_event.step IN (
            'captured',
            'under_review',
            'decision_recorded',
            'closed'
        )
  )
ON CONFLICT (feedback_uuid, step) DO NOTHING;
