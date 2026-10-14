

-- ============================================================
-- SECTION 1 — Public review simulator (new, standalone tables)
-- ============================================================

CREATE TABLE reviewer_identities (
    uuid              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider          VARCHAR(20) NOT NULL
                      CHECK (provider IN ('google', 'simulator')),
    provider_subject  VARCHAR(255) NOT NULL,
    email             VARCHAR(255),
    display_name      VARCHAR(150) NOT NULL,
    avatar_url        TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (provider, provider_subject)
);

CREATE TABLE place_reviews (
    uuid                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reviewer_uuid              UUID NOT NULL
                               REFERENCES reviewer_identities(uuid)
                               ON DELETE CASCADE,
    place_slug                 VARCHAR(120) NOT NULL,
    rating                     SMALLINT NOT NULL
                               CHECK (rating >= 1 AND rating <= 5),
    review_text                TEXT,
    source                     VARCHAR(20) NOT NULL
                               CHECK (source IN ('human', 'simulator')),
    service_user_match_status  VARCHAR(20) NOT NULL DEFAULT 'pending'
                               CHECK (service_user_match_status = 'pending'),
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX place_reviews_reviewer_uuid_idx
    ON place_reviews (reviewer_uuid);

CREATE INDEX place_reviews_place_slug_idx
    ON place_reviews (place_slug);


-- ============================================================
-- SECTION 2 — Google External Feedback: new tables
-- ============================================================

CREATE TABLE google_business_locations (
    uuid                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_uuid       UUID NOT NULL
                        REFERENCES facilities(uuid) ON DELETE CASCADE,
    google_account_id   VARCHAR(255) NOT NULL,
    google_location_id  VARCHAR(255) NOT NULL,
    google_place_id     VARCHAR(255),
    display_name        VARCHAR(200) NOT NULL,
    formatted_address    TEXT,
    google_maps_uri      TEXT,
    aggregate_rating     NUMERIC(3,2)
                         CHECK (aggregate_rating IS NULL
                                OR (aggregate_rating >= 1.00 AND aggregate_rating <= 5.00)),
    user_rating_count    INTEGER NOT NULL DEFAULT 0
                         CHECK (user_rating_count >= 0),
    data_origin          VARCHAR(10) NOT NULL DEFAULT 'mock'
                         CHECK (data_origin IN ('mock', 'live')),
    last_observed_at     TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (facility_uuid),
    UNIQUE (google_account_id, google_location_id)
);

-- Optional per the spec: the UNIQUE(facility_uuid) index above already
-- supports direct facility lookup.
-- CREATE INDEX google_business_locations_facility_idx
--     ON google_business_locations (facility_uuid);

CREATE TABLE google_business_reviews (
    uuid                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    google_business_location_uuid  UUID NOT NULL
                                    REFERENCES google_business_locations(uuid)
                                    ON DELETE CASCADE,
    google_review_id               VARCHAR(255) NOT NULL,
    google_resource_name           TEXT NOT NULL,
    reviewer_display_name          VARCHAR(255),
    reviewer_profile_photo_url     TEXT,
    reviewer_is_anonymous          BOOLEAN,
    rating                         SMALLINT NOT NULL
                                   CHECK (rating >= 1 AND rating <= 5),
    comment                        TEXT,
    google_created_at              TIMESTAMPTZ NOT NULL,
    google_updated_at              TIMESTAMPTZ NOT NULL,
    data_origin                    VARCHAR(10) NOT NULL DEFAULT 'mock'
                                   CHECK (data_origin IN ('mock', 'live')),
    last_observed_at               TIMESTAMPTZ,
    source_deleted_at              TIMESTAMPTZ,
    created_at                     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (google_business_location_uuid, google_review_id),
    UNIQUE (google_resource_name)
);

CREATE INDEX google_business_reviews_location_created_idx
    ON google_business_reviews (google_business_location_uuid, google_created_at DESC);

CREATE INDEX google_business_reviews_rating_idx
    ON google_business_reviews (rating);

CREATE TABLE external_feedback (
    uuid                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    google_business_review_uuid UUID NOT NULL
                                REFERENCES google_business_reviews(uuid),
    is_read                     BOOLEAN NOT NULL DEFAULT false,
    current_status               VARCHAR(30) NOT NULL DEFAULT 'received',
    assigned_employee_uuid       UUID
                                 REFERENCES employees(users_uuid) ON DELETE SET NULL,
    assigned_at                  TIMESTAMPTZ,
    ai_insights                  JSONB,
    created_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (google_business_review_uuid)
);

CREATE INDEX external_feedback_assignee_status_idx
    ON external_feedback (assigned_employee_uuid, current_status);

CREATE INDEX external_feedback_unread_created_idx
    ON external_feedback (is_read, created_at DESC);

CREATE TABLE external_feedback_replies (
    uuid                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_feedback_uuid  UUID NOT NULL
                            REFERENCES external_feedback(uuid) ON DELETE CASCADE,
    employees_uuid          UUID NOT NULL
                            REFERENCES employees(users_uuid),
    reply_body              TEXT NOT NULL,
    reply_status             VARCHAR(20) NOT NULL DEFAULT 'draft'
                             CHECK (reply_status IN ('draft', 'sent', 'failed')),
    sent_at                  TIMESTAMPTZ,
    last_error               TEXT,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (reply_status <> 'sent' OR sent_at IS NOT NULL)
);

CREATE INDEX external_feedback_replies_feedback_created_idx
    ON external_feedback_replies (external_feedback_uuid, created_at DESC);

-- Photo log for a Google review, mirroring the app's existing
-- media_logs pattern (composite PK, since one review can accumulate
-- several photos over time). See "Bugs fixed" note at the bottom of
-- this file — the version pasted in the spec referenced tasks(uuid).
CREATE TABLE google_review_media_logs (
    google_business_reviews_uuid  UUID NOT NULL
                                   REFERENCES google_business_reviews(uuid) ON DELETE CASCADE,
    photo_url                     TEXT NOT NULL,
    created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (google_business_reviews_uuid, created_at)
);


-- ============================================================
-- SECTION 3 — Migrations against EXISTING production tables
-- (feedback, feedback_timeline_events, notification already
-- contain live data — no DROP/CREATE here, ALTER only)
-- ============================================================

-- 3a. feedback: staff-owned assignment state
ALTER TABLE feedback
    ADD COLUMN assigned_employee_uuid UUID
        REFERENCES employees(users_uuid) ON DELETE SET NULL,
    ADD COLUMN assigned_at TIMESTAMPTZ;

CREATE INDEX feedback_assignee_status_idx
    ON feedback (assigned_employee_uuid, current_status);

-- 3b. feedback_timeline_events: refactor from composite PK
-- (feedback_uuid, step) to a surrogate-keyed event entity that can
-- also point at external_feedback. Run as one transaction.
BEGIN;

ALTER TABLE feedback_timeline_events
    DROP CONSTRAINT feedback_timeline_events_pkey;

ALTER TABLE feedback_timeline_events
    ADD COLUMN uuid UUID NOT NULL DEFAULT gen_random_uuid(),
    ADD COLUMN external_feedback_uuid UUID
        REFERENCES external_feedback(uuid) ON DELETE CASCADE,
    ALTER COLUMN feedback_uuid DROP NOT NULL;

ALTER TABLE feedback_timeline_events
    ADD CONSTRAINT feedback_timeline_events_pkey PRIMARY KEY (uuid);

ALTER TABLE feedback_timeline_events
    ADD CONSTRAINT feedback_timeline_events_feedback_step_key
        UNIQUE (feedback_uuid, step);

ALTER TABLE feedback_timeline_events
    ADD CONSTRAINT feedback_timeline_events_one_parent_chk
        CHECK (num_nonnulls(feedback_uuid, external_feedback_uuid) = 1);

CREATE INDEX feedback_timeline_internal_created_idx
    ON feedback_timeline_events (feedback_uuid, created_at)
    WHERE feedback_uuid IS NOT NULL;

CREATE INDEX feedback_timeline_external_created_idx
    ON feedback_timeline_events (external_feedback_uuid, created_at)
    WHERE external_feedback_uuid IS NOT NULL;

CREATE INDEX feedback_timeline_step_idx
    ON feedback_timeline_events (step);

COMMIT;

-- 3c. notification: link back to the canonical timeline event
ALTER TABLE notification
    ADD COLUMN feedback_timeline_event_uuid UUID
        REFERENCES feedback_timeline_events(uuid) ON DELETE SET NULL;

CREATE INDEX notification_assignee_created_idx
    ON notification (assignee_uuid, created_at DESC);

CREATE INDEX notification_feedback_event_idx
    ON notification (feedback_timeline_event_uuid);
