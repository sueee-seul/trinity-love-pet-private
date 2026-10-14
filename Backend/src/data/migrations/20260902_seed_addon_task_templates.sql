-- Add the booking Add-on services as reusable task templates so they show up in
-- the "Select task" dropdown of the pet-profile task editor (GET /api/task-templates
-- reads daily_routine WHERE is_active = TRUE). Data only — no code change needed.

BEGIN;

INSERT INTO daily_routine (uuid, title, description, category, task_type, priority)
VALUES
    ('00000000-0000-4000-8000-000000000d11', 'Extra meal', 'Serve an additional meal outside the standard feeding schedule.', 'addon', 'pet', 'mid'),
    ('00000000-0000-4000-8000-000000000d12', 'Bathing', 'Bath the pet and dry thoroughly before returning to the suite.', 'addon', 'pet', 'mid'),
    ('00000000-0000-4000-8000-000000000d13', 'Grooming session', 'Bath, brush-out, and nail trim.', 'addon', 'pet', 'mid'),
    ('00000000-0000-4000-8000-000000000d14', 'Extra playtime', 'Additional 30-minute one-on-one play session.', 'addon', 'pet', 'mid'),
    ('00000000-0000-4000-8000-000000000d15', 'Medication administration', 'Administer medication per the owner-provided instructions.', 'addon', 'pet', 'high')
ON CONFLICT DO NOTHING;

COMMIT;
