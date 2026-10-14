-- Temporary chatbot QA fixtures for Hana Kowalski's Pepper and Biscuit.
-- The schedule uses the same UTC wall-clock convention consumed by the task
-- repository. These rows exercise upcoming, completed, cancelled, and ordered
-- next-event behavior for Tuesday 6 October 2026 (Pacific/Auckland).
INSERT INTO tasks (
  uuid, employees_uuid, title, category, task_type, created_at, status, issue,
  scheduled_at, generated_from, pet_uuid, priority, description, completed_at
)
SELECT fixture.uuid, NULL, fixture.title, fixture.category, 'pet', now(),
       fixture.status, NULL, fixture.scheduled_at, NULL, pet.uuid,
       fixture.priority, fixture.description, fixture.completed_at
FROM (VALUES
  ('96060600-0000-4000-8000-000000000001'::uuid, 'Pepper', 'Afternoon meal', 'feeding', 'pending', '2026-10-06 15:15:00+00'::timestamptz, 'mid', 'Chatbot QA scenario: Pepper has an afternoon meal scheduled.', NULL::timestamptz),
  ('96060600-0000-4000-8000-000000000002'::uuid, 'Pepper', 'Evening brushing', 'grooming', 'pending', '2026-10-06 17:30:00+00'::timestamptz, 'low', 'Chatbot QA scenario: a later event verifies chronological ordering.', NULL::timestamptz),
  ('96060600-0000-4000-8000-000000000003'::uuid, 'Pepper', 'Morning playtime', 'enrichment', 'completed', '2026-10-06 09:00:00+00'::timestamptz, 'low', 'Chatbot QA scenario: completed events should not be returned as next.', '2026-10-05 20:20:00+00'::timestamptz),
  ('96060600-0000-4000-8000-000000000004'::uuid, 'Biscuit', 'Afternoon walk', 'exercise', 'pending', '2026-10-06 15:45:00+00'::timestamptz, 'mid', 'Chatbot QA scenario: Biscuit has a distinct next event.', NULL::timestamptz),
  ('96060600-0000-4000-8000-000000000005'::uuid, 'Biscuit', 'Puzzle feeder', 'enrichment', 'pending', '2026-10-06 18:00:00+00'::timestamptz, 'low', 'Chatbot QA scenario: a later event verifies chronological ordering.', NULL::timestamptz),
  ('96060600-0000-4000-8000-000000000006'::uuid, 'Biscuit', 'Morning meal', 'feeding', 'cancelled', '2026-10-06 10:00:00+00'::timestamptz, 'mid', 'Chatbot QA scenario: cancelled events should not be returned as next.', NULL::timestamptz)
) AS fixture(uuid, pet_name, title, category, status, scheduled_at, priority, description, completed_at)
JOIN pets pet ON lower(pet.name) = lower(fixture.pet_name)
JOIN pet_owners owner ON owner.users_uuid = pet.pet_owners_uuid
WHERE owner.first_name = 'Hana'
  AND owner.last_name = 'Kowalski'
ON CONFLICT (uuid) DO NOTHING;

-- Reapplying this seed keeps the completion time on the Auckland facility's
-- local morning wall clock even when the row was inserted by an earlier run.
UPDATE tasks
SET completed_at = TIMESTAMPTZ '2026-10-05 20:20:00+00'
WHERE uuid = '96060600-0000-4000-8000-000000000003'::uuid
  AND status = 'completed';
