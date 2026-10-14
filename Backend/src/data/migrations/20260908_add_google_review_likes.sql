-- Records reviewer likes on Google-shaped reviews shown on the public PetHouse review page.
-- One row means "this reviewer currently likes this review". Unliking deletes the row, so the
-- like count is always a live COUNT over this table rather than a stored counter. Keeping the
-- count in one place avoids a second copy of the same state drifting out of sync.
--
-- The UNIQUE (google_business_review_uuid, reviewer_uuid) constraint is what enforces the
-- product rule that a reviewer's like is only ever counted once, even if the same reviewer
-- sends concurrent like requests from two tabs.

BEGIN;

CREATE TABLE google_review_likes (
    uuid                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    google_business_review_uuid  UUID NOT NULL
                                 REFERENCES google_business_reviews(uuid) ON DELETE CASCADE,
    reviewer_uuid                UUID NOT NULL
                                 REFERENCES reviewer_identities(uuid) ON DELETE CASCADE,
    created_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (google_business_review_uuid, reviewer_uuid)
);

-- No separate index on google_business_review_uuid: the UNIQUE constraint above already builds
-- a composite index led by that column, which serves the per-review like count on its own.
-- reviewer_uuid needs its own index because it is the trailing column of that composite index,
-- which cannot answer a lookup by reviewer alone. It also backs the reviewer_identities cascade.
CREATE INDEX google_review_likes_reviewer_idx
    ON google_review_likes (reviewer_uuid);

COMMIT;
