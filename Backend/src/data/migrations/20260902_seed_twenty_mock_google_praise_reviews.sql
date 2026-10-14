-- Seed twenty synthetic Praise reviews for the public PetHouse mock review page.
--
-- These are fake Google reviewer identities only. They do not create app users,
-- pet owners, pets, bookings, login credentials, internal feedback, review
-- media, manual labels, assignments, or replies. Each review gets one
-- external_feedback row containing only the synthetic AI insight needed by the
-- internal review card. reviewer_profile_photo_url and avatar_url intentionally
-- remain NULL so the frontend uses the initials fallback.
--
-- The comments are original synthetic writing informed by public pet-care review
-- style. They must not be described as real Google reviews or copied customer text.
-- Apply with a direct Neon connection and --single-transaction.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM google_business_locations
        WHERE uuid = '00000000-0000-4000-8000-000000000401'::uuid
          AND google_location_id = 'mock-pethouse-location'
          AND display_name = 'PetHouse'
    ) THEN
        RAISE EXCEPTION 'Missing dependency: PetHouse mock Google location';
    END IF;
END;
$$;

-- Re-running this fixture is safe, but a stable ID or provider subject must not
-- silently overwrite a different reviewer identity.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM (VALUES
            ('00000000-0000-4000-8000-000000000901'::uuid, 'mock-google-praise-001', 'Olivia Martin'),
            ('00000000-0000-4000-8000-000000000902'::uuid, 'mock-google-praise-002', 'James Wilson'),
            ('00000000-0000-4000-8000-000000000903'::uuid, 'mock-google-praise-003', 'Emma Chen'),
            ('00000000-0000-4000-8000-000000000904'::uuid, 'mock-google-praise-004', 'Liam Taylor'),
            ('00000000-0000-4000-8000-000000000905'::uuid, 'mock-google-praise-005', 'Sophie Patel'),
            ('00000000-0000-4000-8000-000000000906'::uuid, 'mock-google-praise-006', 'Noah Nguyen'),
            ('00000000-0000-4000-8000-000000000907'::uuid, 'mock-google-praise-007', 'Mia Anderson'),
            ('00000000-0000-4000-8000-000000000908'::uuid, 'mock-google-praise-008', 'Ethan Lee'),
            ('00000000-0000-4000-8000-000000000909'::uuid, 'mock-google-praise-009', 'Grace Thompson'),
            ('00000000-0000-4000-8000-000000000910'::uuid, 'mock-google-praise-010', 'Lucas Brown'),
            ('00000000-0000-4000-8000-000000000911'::uuid, 'mock-google-praise-011', 'Chloe Wong'),
            ('00000000-0000-4000-8000-000000000912'::uuid, 'mock-google-praise-012', 'Jack Harris'),
            ('00000000-0000-4000-8000-000000000913'::uuid, 'mock-google-praise-013', 'Ava Singh'),
            ('00000000-0000-4000-8000-000000000914'::uuid, 'mock-google-praise-014', 'Daniel Kim'),
            ('00000000-0000-4000-8000-000000000915'::uuid, 'mock-google-praise-015', 'Ella Roberts'),
            ('00000000-0000-4000-8000-000000000916'::uuid, 'mock-google-praise-016', 'Henry Zhang'),
            ('00000000-0000-4000-8000-000000000917'::uuid, 'mock-google-praise-017', 'Lily Johnson'),
            ('00000000-0000-4000-8000-000000000918'::uuid, 'mock-google-praise-018', 'Ben Clarke'),
            ('00000000-0000-4000-8000-000000000919'::uuid, 'mock-google-praise-019', 'Isla Davis'),
            ('00000000-0000-4000-8000-000000000920'::uuid, 'mock-google-praise-020', 'Samuel Kapoor')
        ) AS expected(uuid, provider_subject, display_name)
        JOIN reviewer_identities reviewer ON reviewer.uuid = expected.uuid
        WHERE reviewer.provider <> 'google'
           OR reviewer.provider_subject <> expected.provider_subject
           OR reviewer.display_name <> expected.display_name
    ) THEN
        RAISE EXCEPTION 'A stable reviewer ID is already occupied by different data';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM (VALUES
            ('mock-google-praise-001'), ('mock-google-praise-002'), ('mock-google-praise-003'),
            ('mock-google-praise-004'), ('mock-google-praise-005'), ('mock-google-praise-006'),
            ('mock-google-praise-007'), ('mock-google-praise-008'), ('mock-google-praise-009'),
            ('mock-google-praise-010'), ('mock-google-praise-011'), ('mock-google-praise-012'),
            ('mock-google-praise-013'), ('mock-google-praise-014'), ('mock-google-praise-015'),
            ('mock-google-praise-016'), ('mock-google-praise-017'), ('mock-google-praise-018'),
            ('mock-google-praise-019'), ('mock-google-praise-020')
        ) AS expected(provider_subject)
        JOIN reviewer_identities reviewer
          ON reviewer.provider = 'google'
         AND reviewer.provider_subject = expected.provider_subject
        WHERE reviewer.uuid NOT IN (
            '00000000-0000-4000-8000-000000000901'::uuid,
            '00000000-0000-4000-8000-000000000902'::uuid,
            '00000000-0000-4000-8000-000000000903'::uuid,
            '00000000-0000-4000-8000-000000000904'::uuid,
            '00000000-0000-4000-8000-000000000905'::uuid,
            '00000000-0000-4000-8000-000000000906'::uuid,
            '00000000-0000-4000-8000-000000000907'::uuid,
            '00000000-0000-4000-8000-000000000908'::uuid,
            '00000000-0000-4000-8000-000000000909'::uuid,
            '00000000-0000-4000-8000-000000000910'::uuid,
            '00000000-0000-4000-8000-000000000911'::uuid,
            '00000000-0000-4000-8000-000000000912'::uuid,
            '00000000-0000-4000-8000-000000000913'::uuid,
            '00000000-0000-4000-8000-000000000914'::uuid,
            '00000000-0000-4000-8000-000000000915'::uuid,
            '00000000-0000-4000-8000-000000000916'::uuid,
            '00000000-0000-4000-8000-000000000917'::uuid,
            '00000000-0000-4000-8000-000000000918'::uuid,
            '00000000-0000-4000-8000-000000000919'::uuid,
            '00000000-0000-4000-8000-000000000920'::uuid
        )
    ) THEN
        RAISE EXCEPTION 'A provider subject is already used by a different reviewer UUID';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM (VALUES
            ('00000000-0000-4000-8000-000000000951'::uuid, 'mock-google-praise-001'),
            ('00000000-0000-4000-8000-000000000952'::uuid, 'mock-google-praise-002'),
            ('00000000-0000-4000-8000-000000000953'::uuid, 'mock-google-praise-003'),
            ('00000000-0000-4000-8000-000000000954'::uuid, 'mock-google-praise-004'),
            ('00000000-0000-4000-8000-000000000955'::uuid, 'mock-google-praise-005'),
            ('00000000-0000-4000-8000-000000000956'::uuid, 'mock-google-praise-006'),
            ('00000000-0000-4000-8000-000000000957'::uuid, 'mock-google-praise-007'),
            ('00000000-0000-4000-8000-000000000958'::uuid, 'mock-google-praise-008'),
            ('00000000-0000-4000-8000-000000000959'::uuid, 'mock-google-praise-009'),
            ('00000000-0000-4000-8000-000000000960'::uuid, 'mock-google-praise-010'),
            ('00000000-0000-4000-8000-000000000961'::uuid, 'mock-google-praise-011'),
            ('00000000-0000-4000-8000-000000000962'::uuid, 'mock-google-praise-012'),
            ('00000000-0000-4000-8000-000000000963'::uuid, 'mock-google-praise-013'),
            ('00000000-0000-4000-8000-000000000964'::uuid, 'mock-google-praise-014'),
            ('00000000-0000-4000-8000-000000000965'::uuid, 'mock-google-praise-015'),
            ('00000000-0000-4000-8000-000000000966'::uuid, 'mock-google-praise-016'),
            ('00000000-0000-4000-8000-000000000967'::uuid, 'mock-google-praise-017'),
            ('00000000-0000-4000-8000-000000000968'::uuid, 'mock-google-praise-018'),
            ('00000000-0000-4000-8000-000000000969'::uuid, 'mock-google-praise-019'),
            ('00000000-0000-4000-8000-000000000970'::uuid, 'mock-google-praise-020')
        ) AS expected(uuid, google_review_id)
        JOIN google_business_reviews review ON review.uuid = expected.uuid
        WHERE review.google_review_id <> expected.google_review_id
           OR review.data_origin <> 'mock'
    ) THEN
        RAISE EXCEPTION 'A stable review ID is already occupied by different data';
    END IF;
END;
$$;

INSERT INTO reviewer_identities (
    uuid, provider, provider_subject, email, display_name, avatar_url, created_at, updated_at
)
VALUES
    ('00000000-0000-4000-8000-000000000901', 'google', 'mock-google-praise-001', 'olivia.martin.review01@gmail.com', 'Olivia Martin', NULL, TIMESTAMPTZ '2026-08-20 09:15:00+12', TIMESTAMPTZ '2026-08-20 09:15:00+12'),
    ('00000000-0000-4000-8000-000000000902', 'google', 'mock-google-praise-002', 'james.wilson.review02@gmail.com', 'James Wilson', NULL, TIMESTAMPTZ '2026-08-20 17:40:00+12', TIMESTAMPTZ '2026-08-20 17:40:00+12'),
    ('00000000-0000-4000-8000-000000000903', 'google', 'mock-google-praise-003', 'emma.chen.review03@gmail.com', 'Emma Chen', NULL, TIMESTAMPTZ '2026-08-21 11:20:00+12', TIMESTAMPTZ '2026-08-21 11:20:00+12'),
    ('00000000-0000-4000-8000-000000000904', 'google', 'mock-google-praise-004', 'liam.taylor.review04@gmail.com', 'Liam Taylor', NULL, TIMESTAMPTZ '2026-08-22 08:50:00+12', TIMESTAMPTZ '2026-08-22 08:50:00+12'),
    ('00000000-0000-4000-8000-000000000905', 'google', 'mock-google-praise-005', 'sophie.patel.review05@gmail.com', 'Sophie Patel', NULL, TIMESTAMPTZ '2026-08-22 19:10:00+12', TIMESTAMPTZ '2026-08-22 19:10:00+12'),
    ('00000000-0000-4000-8000-000000000906', 'google', 'mock-google-praise-006', 'noah.nguyen.review06@gmail.com', 'Noah Nguyen', NULL, TIMESTAMPTZ '2026-08-23 14:05:00+12', TIMESTAMPTZ '2026-08-23 14:05:00+12'),
    ('00000000-0000-4000-8000-000000000907', 'google', 'mock-google-praise-007', 'mia.anderson.review07@gmail.com', 'Mia Anderson', NULL, TIMESTAMPTZ '2026-08-24 09:40:00+12', TIMESTAMPTZ '2026-08-24 09:40:00+12'),
    ('00000000-0000-4000-8000-000000000908', 'google', 'mock-google-praise-008', 'ethan.lee.review08@gmail.com', 'Ethan Lee', NULL, TIMESTAMPTZ '2026-08-24 18:25:00+12', TIMESTAMPTZ '2026-08-24 18:25:00+12'),
    ('00000000-0000-4000-8000-000000000909', 'google', 'mock-google-praise-009', 'grace.thompson.review09@gmail.com', 'Grace Thompson', NULL, TIMESTAMPTZ '2026-08-25 12:15:00+12', TIMESTAMPTZ '2026-08-25 12:15:00+12'),
    ('00000000-0000-4000-8000-000000000910', 'google', 'mock-google-praise-010', 'lucas.brown.review10@gmail.com', 'Lucas Brown', NULL, TIMESTAMPTZ '2026-08-26 08:35:00+12', TIMESTAMPTZ '2026-08-26 08:35:00+12'),
    ('00000000-0000-4000-8000-000000000911', 'google', 'mock-google-praise-011', 'chloe.wong.review11@gmail.com', 'Chloe Wong', NULL, TIMESTAMPTZ '2026-08-26 20:05:00+12', TIMESTAMPTZ '2026-08-26 20:05:00+12'),
    ('00000000-0000-4000-8000-000000000912', 'google', 'mock-google-praise-012', 'jack.harris.review12@gmail.com', 'Jack Harris', NULL, TIMESTAMPTZ '2026-08-27 10:50:00+12', TIMESTAMPTZ '2026-08-27 10:50:00+12'),
    ('00000000-0000-4000-8000-000000000913', 'google', 'mock-google-praise-013', 'ava.singh.review13@gmail.com', 'Ava Singh', NULL, TIMESTAMPTZ '2026-08-28 15:30:00+12', TIMESTAMPTZ '2026-08-28 15:30:00+12'),
    ('00000000-0000-4000-8000-000000000914', 'google', 'mock-google-praise-014', 'daniel.kim.review14@gmail.com', 'Daniel Kim', NULL, TIMESTAMPTZ '2026-08-29 09:05:00+12', TIMESTAMPTZ '2026-08-29 09:05:00+12'),
    ('00000000-0000-4000-8000-000000000915', 'google', 'mock-google-praise-015', 'ella.roberts.review15@gmail.com', 'Ella Roberts', NULL, TIMESTAMPTZ '2026-08-29 18:45:00+12', TIMESTAMPTZ '2026-08-29 18:45:00+12'),
    ('00000000-0000-4000-8000-000000000916', 'google', 'mock-google-praise-016', 'henry.zhang.review16@gmail.com', 'Henry Zhang', NULL, TIMESTAMPTZ '2026-08-30 13:25:00+12', TIMESTAMPTZ '2026-08-30 13:25:00+12'),
    ('00000000-0000-4000-8000-000000000917', 'google', 'mock-google-praise-017', 'lily.johnson.review17@gmail.com', 'Lily Johnson', NULL, TIMESTAMPTZ '2026-08-31 08:20:00+12', TIMESTAMPTZ '2026-08-31 08:20:00+12'),
    ('00000000-0000-4000-8000-000000000918', 'google', 'mock-google-praise-018', 'ben.clarke.review18@gmail.com', 'Ben Clarke', NULL, TIMESTAMPTZ '2026-08-31 17:55:00+12', TIMESTAMPTZ '2026-08-31 17:55:00+12'),
    ('00000000-0000-4000-8000-000000000919', 'google', 'mock-google-praise-019', 'isla.davis.review19@gmail.com', 'Isla Davis', NULL, TIMESTAMPTZ '2026-09-01 11:10:00+12', TIMESTAMPTZ '2026-09-01 11:10:00+12'),
    ('00000000-0000-4000-8000-000000000920', 'google', 'mock-google-praise-020', 'samuel.kapoor.review20@gmail.com', 'Samuel Kapoor', NULL, TIMESTAMPTZ '2026-09-02 16:40:00+12', TIMESTAMPTZ '2026-09-02 16:40:00+12')
ON CONFLICT (uuid) DO UPDATE SET
    provider = EXCLUDED.provider,
    provider_subject = EXCLUDED.provider_subject,
    email = EXCLUDED.email,
    display_name = EXCLUDED.display_name,
    avatar_url = NULL,
    updated_at = EXCLUDED.updated_at;

INSERT INTO google_business_reviews (
    uuid, google_business_location_uuid, google_review_id, google_resource_name,
    reviewer_display_name, reviewer_profile_photo_url, reviewer_is_anonymous, rating, comment,
    google_created_at, google_updated_at, data_origin, created_at, updated_at
)
VALUES
    ('00000000-0000-4000-8000-000000000951', '00000000-0000-4000-8000-000000000401', 'mock-google-praise-001', 'accounts/mock-pethouse-account/locations/mock-pethouse-location/reviews/mock-google-praise-001', 'Olivia Martin', NULL, FALSE, 5, $$Bella starts wagging before we even turn into the driveway. She always comes home happy, clean and ready for a long nap, and the daily photos make it easy to see how much fun she is having. The team are wonderful.$$, TIMESTAMPTZ '2026-08-20 09:15:00+12', TIMESTAMPTZ '2026-08-20 09:15:00+12', 'mock', TIMESTAMPTZ '2026-08-20 09:15:00+12', TIMESTAMPTZ '2026-08-20 09:15:00+12'),
    ('00000000-0000-4000-8000-000000000952', '00000000-0000-4000-8000-000000000401', 'mock-google-praise-002', 'accounts/mock-pethouse-account/locations/mock-pethouse-location/reviews/mock-google-praise-002', 'James Wilson', NULL, FALSE, 5, $$Milo had such a lovely stay. The staff remembered that he needs a little time to warm up, and he came home relaxed and settled. Really appreciate the care and kind updates. We will definitely be back.$$, TIMESTAMPTZ '2026-08-20 17:40:00+12', TIMESTAMPTZ '2026-08-20 17:40:00+12', 'mock', TIMESTAMPTZ '2026-08-20 17:40:00+12', TIMESTAMPTZ '2026-08-20 17:40:00+12'),
    ('00000000-0000-4000-8000-000000000953', '00000000-0000-4000-8000-000000000401', 'mock-google-praise-003', 'accounts/mock-pethouse-account/locations/mock-pethouse-location/reviews/mock-google-praise-003', 'Emma Chen', NULL, FALSE, 5, $$Nala was treated like one of their own. The room was clean, the communication was clear, and she was calm and content when we picked her up. It is a huge relief knowing she is in good hands.$$, TIMESTAMPTZ '2026-08-21 11:20:00+12', TIMESTAMPTZ '2026-08-21 11:20:00+12', 'mock', TIMESTAMPTZ '2026-08-21 11:20:00+12', TIMESTAMPTZ '2026-08-21 11:20:00+12'),
    ('00000000-0000-4000-8000-000000000954', '00000000-0000-4000-8000-000000000401', 'mock-google-praise-004', 'accounts/mock-pethouse-account/locations/mock-pethouse-location/reviews/mock-google-praise-004', 'Liam Taylor', NULL, FALSE, 4, $$Archie's first stay went really well. Everyone was friendly and patient, and he came home tired in the best way. I would have loved one more update during the stay, but overall we were very happy.$$, TIMESTAMPTZ '2026-08-22 08:50:00+12', TIMESTAMPTZ '2026-08-22 08:50:00+12', 'mock', TIMESTAMPTZ '2026-08-22 08:50:00+12', TIMESTAMPTZ '2026-08-22 08:50:00+12'),
    ('00000000-0000-4000-8000-000000000955', '00000000-0000-4000-8000-000000000401', 'mock-google-praise-005', 'accounts/mock-pethouse-account/locations/mock-pethouse-location/reviews/mock-google-praise-005', 'Sophie Patel', NULL, FALSE, 5, $$Coco absolutely loved it here. She was excited when we arrived and even happier when she saw the team. She came home clean, cheerful and ready for dinner. Such a caring group of people.$$, TIMESTAMPTZ '2026-08-22 19:10:00+12', TIMESTAMPTZ '2026-08-22 19:10:00+12', 'mock', TIMESTAMPTZ '2026-08-22 19:10:00+12', TIMESTAMPTZ '2026-08-22 19:10:00+12'),
    ('00000000-0000-4000-8000-000000000956', '00000000-0000-4000-8000-000000000401', 'mock-google-praise-006', 'accounts/mock-pethouse-account/locations/mock-pethouse-location/reviews/mock-google-praise-006', 'Noah Nguyen', NULL, FALSE, 5, $$Luna settled in quickly and looked so comfortable in the photos. The team were gentle, responsive and clearly paid attention to her little personality. A really reassuring experience from start to finish.$$, TIMESTAMPTZ '2026-08-23 14:05:00+12', TIMESTAMPTZ '2026-08-23 14:05:00+12', 'mock', TIMESTAMPTZ '2026-08-23 14:05:00+12', TIMESTAMPTZ '2026-08-23 14:05:00+12'),
    ('00000000-0000-4000-8000-000000000957', '00000000-0000-4000-8000-000000000401', 'mock-google-praise-007', 'accounts/mock-pethouse-account/locations/mock-pethouse-location/reviews/mock-google-praise-007', 'Mia Anderson', NULL, FALSE, 5, $$Teddy had the best time and came home beautifully tired after a day of play. I loved seeing the updates and the way the staff matched him with dogs that suited his energy. Highly recommend PetHouse.$$, TIMESTAMPTZ '2026-08-24 09:40:00+12', TIMESTAMPTZ '2026-08-24 09:40:00+12', 'mock', TIMESTAMPTZ '2026-08-24 09:40:00+12', TIMESTAMPTZ '2026-08-24 09:40:00+12'),
    ('00000000-0000-4000-8000-000000000958', '00000000-0000-4000-8000-000000000401', 'mock-google-praise-008', 'accounts/mock-pethouse-account/locations/mock-pethouse-location/reviews/mock-google-praise-008', 'Ethan Lee', NULL, FALSE, 4, $$Daisy was happy and well looked after, and the team made drop-off feel easy. The facilities were lovely and the updates were reassuring. Pickup took a little longer than expected, but we were very pleased overall.$$, TIMESTAMPTZ '2026-08-24 18:25:00+12', TIMESTAMPTZ '2026-08-24 18:25:00+12', 'mock', TIMESTAMPTZ '2026-08-24 18:25:00+12', TIMESTAMPTZ '2026-08-24 18:25:00+12'),
    ('00000000-0000-4000-8000-000000000959', '00000000-0000-4000-8000-000000000401', 'mock-google-praise-009', 'accounts/mock-pethouse-account/locations/mock-pethouse-location/reviews/mock-google-praise-009', 'Grace Thompson', NULL, FALSE, 5, $$Charlie gets so excited when we pull into PetHouse. The staff know him by name and always greet him with such warmth. He comes home happy, sleepy and ready to do it all again. Thank you!$$, TIMESTAMPTZ '2026-08-25 12:15:00+12', TIMESTAMPTZ '2026-08-25 12:15:00+12', 'mock', TIMESTAMPTZ '2026-08-25 12:15:00+12', TIMESTAMPTZ '2026-08-25 12:15:00+12'),
    ('00000000-0000-4000-8000-000000000960', '00000000-0000-4000-8000-000000000401', 'mock-google-praise-010', 'accounts/mock-pethouse-account/locations/mock-pethouse-location/reviews/mock-google-praise-010', 'Lucas Brown', NULL, FALSE, 5, $$Poppy was calm and comfortable throughout her stay. I really appreciated the clear communication and the little details the team noticed about her routine. She came home settled, which says everything.$$, TIMESTAMPTZ '2026-08-26 08:35:00+12', TIMESTAMPTZ '2026-08-26 08:35:00+12', 'mock', TIMESTAMPTZ '2026-08-26 08:35:00+12', TIMESTAMPTZ '2026-08-26 08:35:00+12'),
    ('00000000-0000-4000-8000-000000000961', '00000000-0000-4000-8000-000000000401', 'mock-google-praise-011', 'accounts/mock-pethouse-account/locations/mock-pethouse-location/reviews/mock-google-praise-011', 'Chloe Wong', NULL, FALSE, 5, $$Finn had a fantastic time. The team were friendly, the space was clean and the photos showed him enjoying plenty of attention and play. We felt completely at ease while we were away.$$, TIMESTAMPTZ '2026-08-26 20:05:00+12', TIMESTAMPTZ '2026-08-26 20:05:00+12', 'mock', TIMESTAMPTZ '2026-08-26 20:05:00+12', TIMESTAMPTZ '2026-08-26 20:05:00+12'),
    ('00000000-0000-4000-8000-000000000962', '00000000-0000-4000-8000-000000000401', 'mock-google-praise-012', 'accounts/mock-pethouse-account/locations/mock-pethouse-location/reviews/mock-google-praise-012', 'Jack Harris', NULL, FALSE, 4, $$Ruby came home relaxed, clean and clearly well cared for. The staff were lovely and kept us informed, which made the whole stay feel straightforward. A very good experience and we will use PetHouse again.$$, TIMESTAMPTZ '2026-08-27 10:50:00+12', TIMESTAMPTZ '2026-08-27 10:50:00+12', 'mock', TIMESTAMPTZ '2026-08-27 10:50:00+12', TIMESTAMPTZ '2026-08-27 10:50:00+12'),
    ('00000000-0000-4000-8000-000000000963', '00000000-0000-4000-8000-000000000401', 'mock-google-praise-013', 'accounts/mock-pethouse-account/locations/mock-pethouse-location/reviews/mock-google-praise-013', 'Ava Singh', NULL, FALSE, 5, $$Max loved every minute of his stay. He was excited to go in, happy to see the staff and absolutely exhausted on the way home. The updates were a lovely touch and gave us such peace of mind.$$, TIMESTAMPTZ '2026-08-28 15:30:00+12', TIMESTAMPTZ '2026-08-28 15:30:00+12', 'mock', TIMESTAMPTZ '2026-08-28 15:30:00+12', TIMESTAMPTZ '2026-08-28 15:30:00+12'),
    ('00000000-0000-4000-8000-000000000964', '00000000-0000-4000-8000-000000000401', 'mock-google-praise-014', 'accounts/mock-pethouse-account/locations/mock-pethouse-location/reviews/mock-google-praise-014', 'Daniel Kim', NULL, FALSE, 5, $$Willow was looked after so thoughtfully. The team understood her shy nature, gave her time to settle and kept us updated without us needing to chase. She came home content and confident. Highly recommend.$$, TIMESTAMPTZ '2026-08-29 09:05:00+12', TIMESTAMPTZ '2026-08-29 09:05:00+12', 'mock', TIMESTAMPTZ '2026-08-29 09:05:00+12', TIMESTAMPTZ '2026-08-29 09:05:00+12'),
    ('00000000-0000-4000-8000-000000000965', '00000000-0000-4000-8000-000000000401', 'mock-google-praise-015', 'accounts/mock-pethouse-account/locations/mock-pethouse-location/reviews/mock-google-praise-015', 'Ella Roberts', NULL, FALSE, 5, $$Pepper had a wonderful stay and came home bright, clean and full of stories, if dogs could tell them. The staff were warm and organised, and the photos made us smile every day. Thank you PetHouse.$$, TIMESTAMPTZ '2026-08-29 18:45:00+12', TIMESTAMPTZ '2026-08-29 18:45:00+12', 'mock', TIMESTAMPTZ '2026-08-29 18:45:00+12', TIMESTAMPTZ '2026-08-29 18:45:00+12'),
    ('00000000-0000-4000-8000-000000000966', '00000000-0000-4000-8000-000000000401', 'mock-google-praise-016', 'accounts/mock-pethouse-account/locations/mock-pethouse-location/reviews/mock-google-praise-016', 'Henry Zhang', NULL, FALSE, 4, $$Scout had a great first stay and the staff were patient from the moment we arrived. He came home happy and tired, and the communication was excellent. Four stars only because the pickup window was a little busy, but we would happily return.$$, TIMESTAMPTZ '2026-08-30 13:25:00+12', TIMESTAMPTZ '2026-08-30 13:25:00+12', 'mock', TIMESTAMPTZ '2026-08-30 13:25:00+12', TIMESTAMPTZ '2026-08-30 13:25:00+12'),
    ('00000000-0000-4000-8000-000000000967', '00000000-0000-4000-8000-000000000401', 'mock-google-praise-017', 'accounts/mock-pethouse-account/locations/mock-pethouse-location/reviews/mock-google-praise-017', 'Lily Johnson', NULL, FALSE, 5, $$Rosie loves seeing the team and practically pulls us through the door. She always comes home happy and relaxed, and we really value the photos and updates while she is there. Such a lovely place.$$, TIMESTAMPTZ '2026-08-31 08:20:00+12', TIMESTAMPTZ '2026-08-31 08:20:00+12', 'mock', TIMESTAMPTZ '2026-08-31 08:20:00+12', TIMESTAMPTZ '2026-08-31 08:20:00+12'),
    ('00000000-0000-4000-8000-000000000968', '00000000-0000-4000-8000-000000000401', 'mock-google-praise-018', 'accounts/mock-pethouse-account/locations/mock-pethouse-location/reviews/mock-google-praise-018', 'Ben Clarke', NULL, FALSE, 5, $$Oscar was cared for beautifully. Everyone was kind, the booking process was easy and he came home settled after a fun few days. It is clear the staff genuinely enjoy looking after the dogs.$$, TIMESTAMPTZ '2026-08-31 17:55:00+12', TIMESTAMPTZ '2026-08-31 17:55:00+12', 'mock', TIMESTAMPTZ '2026-08-31 17:55:00+12', TIMESTAMPTZ '2026-08-31 17:55:00+12'),
    ('00000000-0000-4000-8000-000000000969', '00000000-0000-4000-8000-000000000401', 'mock-google-praise-019', 'accounts/mock-pethouse-account/locations/mock-pethouse-location/reviews/mock-google-praise-019', 'Isla Davis', NULL, FALSE, 4, $$Tilly had a lovely stay and was calm when we picked her up. The room was clean, the team were caring and the updates were helpful. I would have liked slightly more detail about her quiet days, but overall a great experience.$$, TIMESTAMPTZ '2026-09-01 11:10:00+12', TIMESTAMPTZ '2026-09-01 11:10:00+12', 'mock', TIMESTAMPTZ '2026-09-01 11:10:00+12', TIMESTAMPTZ '2026-09-01 11:10:00+12'),
    ('00000000-0000-4000-8000-000000000970', '00000000-0000-4000-8000-000000000401', 'mock-google-praise-020', 'accounts/mock-pethouse-account/locations/mock-pethouse-location/reviews/mock-google-praise-020', 'Samuel Kapoor', NULL, FALSE, 5, $$Winston came home happy, pleasantly tired and very ready for dinner. The team were professional, friendly and attentive, and the regular updates made being away much easier. We will definitely book again.$$, TIMESTAMPTZ '2026-09-02 16:40:00+12', TIMESTAMPTZ '2026-09-02 16:40:00+12', 'mock', TIMESTAMPTZ '2026-09-02 16:40:00+12', TIMESTAMPTZ '2026-09-02 16:40:00+12')
ON CONFLICT (uuid) DO UPDATE SET
    google_business_location_uuid = EXCLUDED.google_business_location_uuid,
    google_review_id = EXCLUDED.google_review_id,
    google_resource_name = EXCLUDED.google_resource_name,
    reviewer_display_name = EXCLUDED.reviewer_display_name,
    reviewer_profile_photo_url = NULL,
    reviewer_is_anonymous = EXCLUDED.reviewer_is_anonymous,
    rating = EXCLUDED.rating,
    comment = EXCLUDED.comment,
    google_created_at = EXCLUDED.google_created_at,
    google_updated_at = EXCLUDED.google_updated_at,
    data_origin = EXCLUDED.data_origin,
    updated_at = EXCLUDED.updated_at;

-- The admin review card reads its summary from external_feedback.ai_insights.
-- Keep these summaries deterministic and grounded only in the synthetic review
-- text; no external model call or provider account is required for this fixture.
WITH ai_summary_seed (review_uuid, summary) AS (
    VALUES
        ('00000000-0000-4000-8000-000000000951'::uuid, $summary$The reviewer praised PetHouse for Bella's happy return, daily photos, and caring team.$summary$),
        ('00000000-0000-4000-8000-000000000952'::uuid, $summary$The reviewer praised PetHouse for helping Milo settle, providing kind updates, and delivering a relaxed return home.$summary$),
        ('00000000-0000-4000-8000-000000000953'::uuid, $summary$The reviewer praised PetHouse for clean facilities, clear communication, and Nala's calm, content return.$summary$),
        ('00000000-0000-4000-8000-000000000954'::uuid, $summary$The reviewer praised Archie's friendly first stay and positive return, while wishing for one additional update.$summary$),
        ('00000000-0000-4000-8000-000000000955'::uuid, $summary$The reviewer praised PetHouse for Coco's excitement, cheerful return, and caring team.$summary$),
        ('00000000-0000-4000-8000-000000000956'::uuid, $summary$The reviewer praised PetHouse for Luna's comfortable stay, gentle staff, and responsive communication.$summary$),
        ('00000000-0000-4000-8000-000000000957'::uuid, $summary$The reviewer praised PetHouse for Teddy's play, thoughtful dog matching, and reassuring updates.$summary$),
        ('00000000-0000-4000-8000-000000000958'::uuid, $summary$The reviewer praised PetHouse for Daisy's care, lovely facilities, and reassuring updates despite a slower pickup.$summary$),
        ('00000000-0000-4000-8000-000000000959'::uuid, $summary$The reviewer praised PetHouse for knowing Charlie by name and sending him home happy and sleepy.$summary$),
        ('00000000-0000-4000-8000-000000000960'::uuid, $summary$The reviewer praised PetHouse for Poppy's comfort, clear communication, and attention to her routine.$summary$),
        ('00000000-0000-4000-8000-000000000961'::uuid, $summary$The reviewer praised PetHouse for Finn's friendly care, clean space, photos, and attentive play.$summary$),
        ('00000000-0000-4000-8000-000000000962'::uuid, $summary$The reviewer praised PetHouse for Ruby's relaxed return, caring staff, and straightforward communication.$summary$),
        ('00000000-0000-4000-8000-000000000963'::uuid, $summary$The reviewer praised PetHouse for Max's enthusiasm, happy return, and updates that provided peace of mind.$summary$),
        ('00000000-0000-4000-8000-000000000964'::uuid, $summary$The reviewer praised PetHouse for thoughtfully supporting Willow's shy nature and keeping the owner updated.$summary$),
        ('00000000-0000-4000-8000-000000000965'::uuid, $summary$The reviewer praised PetHouse for Pepper's bright return, organised staff, and daily photos.$summary$),
        ('00000000-0000-4000-8000-000000000966'::uuid, $summary$The reviewer praised PetHouse for Scout's patient first stay, happy return, and excellent communication despite a busy pickup window.$summary$),
        ('00000000-0000-4000-8000-000000000967'::uuid, $summary$The reviewer praised PetHouse for Rosie's enthusiasm, relaxed return, and helpful photos and updates.$summary$),
        ('00000000-0000-4000-8000-000000000968'::uuid, $summary$The reviewer praised PetHouse for Oscar's settled return, easy booking process, and kind staff.$summary$),
        ('00000000-0000-4000-8000-000000000969'::uuid, $summary$The reviewer praised PetHouse for Tilly's calm return, clean room, caring team, and helpful updates.$summary$),
        ('00000000-0000-4000-8000-000000000970'::uuid, $summary$The reviewer praised PetHouse for Winston's happy return, attentive team, and regular updates.$summary$)
)
INSERT INTO external_feedback (
    google_business_review_uuid,
    is_read,
    current_status,
    ai_insights,
    created_at,
    updated_at
)
SELECT
    ai_summary_seed.review_uuid,
    FALSE,
    'received',
    jsonb_build_object(
        'summary', ai_summary_seed.summary,
        'triageType', 'praise',
        'triageConfidence', 'high'
    ),
    google_review.created_at,
    google_review.updated_at
FROM ai_summary_seed
JOIN google_business_reviews AS google_review
    ON google_review.uuid = ai_summary_seed.review_uuid
ON CONFLICT (google_business_review_uuid) DO UPDATE SET
    ai_insights = EXCLUDED.ai_insights,
    updated_at = EXCLUDED.updated_at;

SELECT
    'Twenty mock Google Praise reviews seeded' AS result,
    (SELECT COUNT(*) FROM reviewer_identities WHERE provider = 'google' AND provider_subject LIKE 'mock-google-praise-%') AS reviewer_rows,
    (SELECT COUNT(*) FROM google_business_reviews WHERE google_review_id LIKE 'mock-google-praise-%' AND data_origin = 'mock') AS review_rows,
    (SELECT COUNT(*) FROM google_business_reviews WHERE google_review_id LIKE 'mock-google-praise-%' AND reviewer_profile_photo_url IS NULL) AS reviews_without_avatar,
    (SELECT COUNT(*) FROM google_review_media_logs WHERE google_business_reviews_uuid IN (
        '00000000-0000-4000-8000-000000000951'::uuid,
        '00000000-0000-4000-8000-000000000952'::uuid,
        '00000000-0000-4000-8000-000000000953'::uuid,
        '00000000-0000-4000-8000-000000000954'::uuid,
        '00000000-0000-4000-8000-000000000955'::uuid,
        '00000000-0000-4000-8000-000000000956'::uuid,
        '00000000-0000-4000-8000-000000000957'::uuid,
        '00000000-0000-4000-8000-000000000958'::uuid,
        '00000000-0000-4000-8000-000000000959'::uuid,
        '00000000-0000-4000-8000-000000000960'::uuid,
        '00000000-0000-4000-8000-000000000961'::uuid,
        '00000000-0000-4000-8000-000000000962'::uuid,
        '00000000-0000-4000-8000-000000000963'::uuid,
        '00000000-0000-4000-8000-000000000964'::uuid,
        '00000000-0000-4000-8000-000000000965'::uuid,
        '00000000-0000-4000-8000-000000000966'::uuid,
        '00000000-0000-4000-8000-000000000967'::uuid,
        '00000000-0000-4000-8000-000000000968'::uuid,
        '00000000-0000-4000-8000-000000000969'::uuid,
        '00000000-0000-4000-8000-000000000970'::uuid
    )) AS review_media_rows,
    (SELECT COUNT(*) FROM external_feedback
     WHERE google_business_review_uuid IN (
        '00000000-0000-4000-8000-000000000951'::uuid,
        '00000000-0000-4000-8000-000000000952'::uuid,
        '00000000-0000-4000-8000-000000000953'::uuid,
        '00000000-0000-4000-8000-000000000954'::uuid,
        '00000000-0000-4000-8000-000000000955'::uuid,
        '00000000-0000-4000-8000-000000000956'::uuid,
        '00000000-0000-4000-8000-000000000957'::uuid,
        '00000000-0000-4000-8000-000000000958'::uuid,
        '00000000-0000-4000-8000-000000000959'::uuid,
        '00000000-0000-4000-8000-000000000960'::uuid,
        '00000000-0000-4000-8000-000000000961'::uuid,
        '00000000-0000-4000-8000-000000000962'::uuid,
        '00000000-0000-4000-8000-000000000963'::uuid,
        '00000000-0000-4000-8000-000000000964'::uuid,
        '00000000-0000-4000-8000-000000000965'::uuid,
        '00000000-0000-4000-8000-000000000966'::uuid,
        '00000000-0000-4000-8000-000000000967'::uuid,
        '00000000-0000-4000-8000-000000000968'::uuid,
        '00000000-0000-4000-8000-000000000969'::uuid,
        '00000000-0000-4000-8000-000000000970'::uuid
     )
     AND ai_insights IS NOT NULL) AS ai_summary_rows,
    (SELECT COUNT(*) FROM external_feedback_replies
     WHERE external_feedback_uuid IN (
        SELECT uuid FROM external_feedback
        WHERE google_business_review_uuid IN (
            '00000000-0000-4000-8000-000000000951'::uuid,
            '00000000-0000-4000-8000-000000000952'::uuid,
            '00000000-0000-4000-8000-000000000953'::uuid,
            '00000000-0000-4000-8000-000000000954'::uuid,
            '00000000-0000-4000-8000-000000000955'::uuid,
            '00000000-0000-4000-8000-000000000956'::uuid,
            '00000000-0000-4000-8000-000000000957'::uuid,
            '00000000-0000-4000-8000-000000000958'::uuid,
            '00000000-0000-4000-8000-000000000959'::uuid,
            '00000000-0000-4000-8000-000000000960'::uuid,
            '00000000-0000-4000-8000-000000000961'::uuid,
            '00000000-0000-4000-8000-000000000962'::uuid,
            '00000000-0000-4000-8000-000000000963'::uuid,
            '00000000-0000-4000-8000-000000000964'::uuid,
            '00000000-0000-4000-8000-000000000965'::uuid,
            '00000000-0000-4000-8000-000000000966'::uuid,
            '00000000-0000-4000-8000-000000000967'::uuid,
            '00000000-0000-4000-8000-000000000968'::uuid,
            '00000000-0000-4000-8000-000000000969'::uuid,
            '00000000-0000-4000-8000-000000000970'::uuid
        )
     )) AS review_reply_rows;
