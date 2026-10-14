-- ============================================================
-- Pet Boarding App — FINAL schema
-- ============================================================
-- Source of truth: pg_dump of the live Neon Postgres database
-- (PostgreSQL 18.6, dumped 2026-08-26). This supersedes the
-- earlier draft that was reverse-engineered from ERD.docx —
-- every "ASSUMPTIONS — please confirm or correct" item in that
-- draft has now been resolved by what was actually built. See
-- pets-bookings-schema-notes.md for a full list of what changed
-- and why.
--
-- Scope: this file recreates every table in the `public` schema
-- (the app's own data model). It deliberately does NOT recreate
-- the `neon_auth` schema (account, session, user, organization,
-- jwks, etc.) — that schema is provisioned and migrated by Neon
-- Auth itself, not hand-designed, and `public.users` remains the
-- app's own identity table (the two are not currently linked by
-- an FK). See the notes doc for detail.
--
-- Conventions (unchanged from the draft):
--   * Every table's own primary key is named `uuid` (uuid type,
--     default gen_random_uuid()).
--   * A 1:1 "extension table" (pet_owners, employees,
--     bookings_agreements, booking_pets_caring_info, and most
--     *_logs tables) uses its foreign key AS its primary key —
--     enforces "at most one row per parent" at the schema level.
--   * A composite primary key (employees_roles,
--     booking_pets_services, pet_owners_notification,
--     feedback_timeline_events, media_logs) means "one row per
--     combination," not a surrogate-keyed entity.
-- ============================================================

-- ------------------------------------------------------------
-- 0. Drop existing tables (reverse dependency order, re-runnable)
-- ------------------------------------------------------------

DROP TABLE IF EXISTS pet_owners_notification CASCADE;
DROP TABLE IF EXISTS notification CASCADE;
DROP TABLE IF EXISTS feedback_timeline_events CASCADE;
DROP TABLE IF EXISTS feedback CASCADE;
DROP TABLE IF EXISTS beauty_logs CASCADE;
DROP TABLE IF EXISTS wellness_check_logs CASCADE;
DROP TABLE IF EXISTS media_logs CASCADE;
DROP TABLE IF EXISTS activity_logs CASCADE;
DROP TABLE IF EXISTS feeding_logs CASCADE;
DROP TABLE IF EXISTS potty_break_logs CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS daily_routine CASCADE;
DROP TABLE IF EXISTS booking_pets_caring_info CASCADE;
DROP TABLE IF EXISTS bookings_agreements CASCADE;
DROP TABLE IF EXISTS booking_payments CASCADE;
DROP TABLE IF EXISTS payment_methods CASCADE;
DROP TABLE IF EXISTS terms_versions CASCADE;
DROP TABLE IF EXISTS booking_pets_services CASCADE;
DROP TABLE IF EXISTS booking_pets CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS services CASCADE;
DROP TABLE IF EXISTS employee_assignments CASCADE;
DROP TABLE IF EXISTS pets CASCADE;
DROP TABLE IF EXISTS employees_roles CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS pet_owners CASCADE;
DROP TABLE IF EXISTS facilities CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------
-- 1. Facilities & user profiles
-- ------------------------------------------------------------
-- Facilities is new since the draft: employees now belong to a
-- specific facility rather than the app being single-site.

CREATE TABLE facilities (
    uuid          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(150) NOT NULL,
    suburb        VARCHAR(100),
    city          VARCHAR(100),
    size          VARCHAR(20)  NOT NULL CHECK (size IN ('SOLO', 'SMALL', 'MEDIUM', 'LARGE')),
    capacity      INTEGER      NOT NULL CHECK (capacity >= 0),
    address       TEXT         NOT NULL,
    phone         VARCHAR(20),
    email         VARCHAR(255),
    about         TEXT,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE users (
    uuid            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username        VARCHAR(50)  NOT NULL UNIQUE,
    avatar_url      TEXT,
    email           VARCHAR(255) NOT NULL UNIQUE,
    phone           VARCHAR(255),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    password_hash   VARCHAR(255),  -- nullable: not every auth path sets a local password
    legacy_id       VARCHAR(32),
    display_name    VARCHAR(150),
    is_employee     BOOLEAN,
    is_pet_owner    BOOLEAN
);

CREATE UNIQUE INDEX users_legacy_id_unique ON users (legacy_id) WHERE legacy_id IS NOT NULL;

CREATE TABLE pet_owners (
    users_uuid                 UUID PRIMARY KEY REFERENCES users(uuid) ON DELETE CASCADE,
    emergency_contact_number   VARCHAR(20)  NOT NULL,
    first_name                 VARCHAR(100) NOT NULL,
    last_name                  VARCHAR(100) NOT NULL,
    address                    TEXT         NOT NULL,
    date_of_birth              DATE
);

CREATE TABLE employees (
    users_uuid        UUID PRIMARY KEY REFERENCES users(uuid) ON DELETE CASCADE,
    facility_uuid     UUID NOT NULL REFERENCES facilities(uuid) ON DELETE CASCADE,
    title             VARCHAR(100),
    employment_type   VARCHAR(20) NOT NULL CHECK (employment_type IN ('part-time', 'full-time')),
    shift_details     TEXT,
    staff_role        VARCHAR(20) DEFAULT 'staff',
    staff_status      VARCHAR(20) DEFAULT 'active',
    employee_number   VARCHAR(32)
);

CREATE UNIQUE INDEX employees_employee_number_unique
    ON employees (employee_number) WHERE employee_number IS NOT NULL;

CREATE TABLE roles (
    uuid          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(50) NOT NULL UNIQUE,
    description   TEXT
);

CREATE TABLE employees_roles (
    employees_uuid   UUID NOT NULL REFERENCES employees(users_uuid) ON DELETE CASCADE,
    roles_uuid       UUID NOT NULL REFERENCES roles(uuid) ON DELETE CASCADE,
    PRIMARY KEY (employees_uuid, roles_uuid)
);

-- ------------------------------------------------------------
-- 2. Pet profile
-- ------------------------------------------------------------

CREATE TABLE pets (
    uuid               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pet_owners_uuid    UUID NOT NULL REFERENCES pet_owners(users_uuid) ON DELETE CASCADE,
    microchip_number   VARCHAR(50),
    image_url          TEXT,
    name               VARCHAR(100) NOT NULL,
    breed              VARCHAR(100),
    age                SMALLINT,
    weight             NUMERIC(6,2),
    species            VARCHAR(50),
    status             VARCHAR(20) NOT NULL DEFAULT 'incoming'
        CHECK (status IN ('incoming', 'onboarding', 'checked out')),
    date_of_birth      DATE,
    gender             BOOLEAN,
    diet_notes         TEXT,
    allergies          TEXT,
    behaviour_notes    TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    place              TEXT,
    colour             VARCHAR(100),
    desexed            BOOLEAN NOT NULL DEFAULT false,
    vet_name           VARCHAR(150),
    vet_phone          VARCHAR(50),
    health_notes       TEXT,
    emergency_contact  VARCHAR(200)
);

-- New since the draft: which staff member is on point for which
-- pet, per shift, per day. Independent of any booking — this is
-- facility staffing, not a booking artifact.
CREATE TABLE employee_assignments (
    uuid              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employees_uuid    UUID NOT NULL REFERENCES employees(users_uuid) ON DELETE CASCADE,
    pet_uuid          UUID NOT NULL REFERENCES pets(uuid) ON DELETE CASCADE,
    assignment_date   DATE NOT NULL,
    shift_start       TIME,
    shift_end         TIME,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (pet_uuid, employees_uuid, assignment_date, shift_start)
);

-- ------------------------------------------------------------
-- 3. Booking system (pet owners side)
-- ------------------------------------------------------------

CREATE TABLE services (
    uuid            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    is_compulsory   BOOLEAN NOT NULL DEFAULT false,
    category        VARCHAR(50),
    price_unit      VARCHAR(50),
    price           NUMERIC(10,2) NOT NULL,
    priority        INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    name            VARCHAR(150) NOT NULL,
    description     TEXT
);

CREATE TABLE bookings (
    uuid              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pet_owners_uuid   UUID NOT NULL REFERENCES pet_owners(users_uuid),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    status            VARCHAR(20) NOT NULL CHECK (status IN ('draft', 'paid', 'confirmed'))
);

CREATE TABLE booking_pets (
    uuid             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bookings_uuid    UUID NOT NULL REFERENCES bookings(uuid) ON DELETE CASCADE,
    pet_uuid         UUID NOT NULL REFERENCES pets(uuid),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    drop_off_time    TIMESTAMPTZ,
    pick_up_time     TIMESTAMPTZ
);

CREATE TABLE booking_pets_services (
    booking_pets_uuid   UUID NOT NULL REFERENCES booking_pets(uuid) ON DELETE CASCADE,
    services_uuid       UUID NOT NULL REFERENCES services(uuid),
    quantity            INTEGER NOT NULL DEFAULT 1,
    price_at_booking    NUMERIC(10,2) NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (booking_pets_uuid, services_uuid)
);

CREATE TABLE terms_versions (
    uuid          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content       TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_current    BOOLEAN NOT NULL DEFAULT false
);

-- Only one current terms version at a time
CREATE UNIQUE INDEX one_current_terms_version
    ON terms_versions (is_current)
    WHERE is_current = true;

CREATE TABLE payment_methods (
    uuid                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pet_owners_uuid               UUID NOT NULL REFERENCES pet_owners(users_uuid) ON DELETE CASCADE,
    is_default                    BOOLEAN NOT NULL DEFAULT false,
    processor                     VARCHAR(50) NOT NULL,
    processor_payment_method_id   VARCHAR(255) NOT NULL
);

CREATE TABLE booking_payments (
    uuid                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_methods_uuid    UUID REFERENCES payment_methods(uuid),
    bookings_uuid           UUID NOT NULL REFERENCES bookings(uuid),
    amount                  NUMERIC(10,2) NOT NULL,
    currency                CHAR(3) NOT NULL DEFAULT 'USD',
    status                  VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded'))
);

CREATE TABLE bookings_agreements (
    bookings_uuid          UUID PRIMARY KEY REFERENCES bookings(uuid) ON DELETE CASCADE,
    terms_versions_uuid    UUID NOT NULL REFERENCES terms_versions(uuid),
    signature_url          TEXT,
    full_name              VARCHAR(200) NOT NULL,
    agreed_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE booking_pets_caring_info (
    booking_pets_uuid            UUID PRIMARY KEY REFERENCES booking_pets(uuid) ON DELETE CASCADE,
    feeding_routine              TEXT,
    medication_instructions      TEXT,
    first_time_boarding          BOOLEAN,
    crate_trained                BOOLEAN,
    other_notes                  TEXT,
    allows_socialization         BOOLEAN,
    fully_vaccinated             BOOLEAN,
    behavior_and_health_notes    TEXT
);

-- ------------------------------------------------------------
-- 4. Task creation, task update and management (provider side)
-- ------------------------------------------------------------
-- NOTE: tasks now links directly to `pets`, not to a specific
-- `booking_pets` stay (that FK was dropped) — see the notes doc
-- for why. `task_type` is a coarse staff/pet discriminator, not
-- the fine-grained activity enum earlier drafts sketched.

CREATE TABLE daily_routine (
    uuid          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title         VARCHAR(150) NOT NULL,
    description   TEXT,
    task_type     VARCHAR(50),
    priority      VARCHAR(20),
    category      VARCHAR(80) NOT NULL DEFAULT 'custom',
    is_active     BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tasks (
    uuid             UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- id 
    employees_uuid   UUID REFERENCES employees(users_uuid), -- assignment_id
    title            VARCHAR(160) NOT NULL, --
    category         VARCHAR(80) NOT NULL DEFAULT 'custom',
    task_type        VARCHAR(10) NOT NULL DEFAULT 'pet' CHECK (task_type IN ('staff', 'pet')), -- 
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(), --
    status           VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')), --
    issue            TEXT, --
    scheduled_at     TIMESTAMPTZ, -- due_datetime
    generated_from   UUID REFERENCES daily_routine(uuid),
    pet_uuid         UUID REFERENCES pets(uuid) ON DELETE CASCADE, -- pet_id
    priority         VARCHAR(20) NOT NULL DEFAULT 'mid' CHECK (priority IN ('low', 'mid', 'high', 'urgent')), --
    description      TEXT, --
    completed_at     TIMESTAMPTZ --
);

CREATE INDEX tasks_pet_status_idx ON tasks (pet_uuid, status);

CREATE TABLE potty_break_logs (
    tasks_uuid    UUID PRIMARY KEY REFERENCES tasks(uuid) ON DELETE CASCADE,
    pee_status    VARCHAR(20),
    poop_status   VARCHAR(20),
    notes         TEXT
);

CREATE TABLE feeding_logs (
    tasks_uuid         UUID PRIMARY KEY REFERENCES tasks(uuid) ON DELETE CASCADE,
    eaten_amount       VARCHAR(20),
    medication_given   BOOLEAN,
    notes              TEXT
);

CREATE TABLE activity_logs (
    tasks_uuid         UUID PRIMARY KEY REFERENCES tasks(uuid) ON DELETE CASCADE,
    duration_minutes   INTEGER,
    behavior           TEXT
);

-- Composite PK, not 1:1 — a task can accumulate many photos over time.
CREATE TABLE media_logs (
    tasks_uuid    UUID NOT NULL REFERENCES tasks(uuid) ON DELETE CASCADE,
    photo_url     TEXT NOT NULL,
    caption       TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tasks_uuid, created_at)
);

CREATE TABLE wellness_check_logs (
    tasks_uuid    UUID PRIMARY KEY REFERENCES tasks(uuid) ON DELETE CASCADE,
    summary       TEXT,
    details       TEXT
);

CREATE TABLE beauty_logs (
    tasks_uuid    UUID PRIMARY KEY REFERENCES tasks(uuid) ON DELETE CASCADE,
    status        VARCHAR(30),
    notes         TEXT
);

-- ------------------------------------------------------------
-- 5. Feedback system
-- ------------------------------------------------------------

CREATE TABLE feedback (
    uuid              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pet_uuid          UUID NOT NULL REFERENCES pets(uuid),
    pet_owners_uuid   UUID NOT NULL REFERENCES pet_owners(users_uuid),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    category          VARCHAR(50),
    transcript        TEXT,
    is_read           BOOLEAN NOT NULL DEFAULT false,
    current_status    VARCHAR(30),
    rating            NUMERIC(3,2) NOT NULL CHECK (rating >= 1.00 AND rating <= 5.00),
    rating_details    JSONB NOT NULL,  -- e.g. per-dimension sub-ratings behind the headline score
    raw_answer        TEXT,
    audio_url         TEXT,
    ai_insights       JSONB
);

-- Composite PK — one row per feedback per named step
-- (e.g. 'received' -> 'reviewed' -> 'resolved').
CREATE TABLE feedback_timeline_events (
    feedback_uuid     UUID NOT NULL REFERENCES feedback(uuid) ON DELETE CASCADE,
    step              VARCHAR(50) NOT NULL,
    employees_uuid    UUID REFERENCES employees(users_uuid),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    event_payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
    PRIMARY KEY (feedback_uuid, step)
);

-- ------------------------------------------------------------
-- 6. Notification system
-- ------------------------------------------------------------

CREATE TABLE notification (
    uuid                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_setting    VARCHAR(50),
    read_at                 TIMESTAMPTZ,
    viewed_at               TIMESTAMPTZ,
    category                VARCHAR(50),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    assignee_uuid           UUID REFERENCES employees(users_uuid),
    feedback_uuid           UUID REFERENCES feedback(uuid),
    booking_uuid            UUID REFERENCES bookings(uuid),
    summary_content         TEXT
);

CREATE TABLE pet_owners_notification (
    pet_owners_uuid      UUID NOT NULL REFERENCES pet_owners(users_uuid) ON DELETE CASCADE,
    notification_uuid    UUID NOT NULL REFERENCES notification(uuid) ON DELETE CASCADE,
    PRIMARY KEY (pet_owners_uuid, notification_uuid)
);

CREATE TABLE pet_medications (
    uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pet_uuid UUID NOT NULL REFERENCES pets(uuid) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    strength VARCHAR(100),
    dose NUMERIC(10, 2) NOT NULL DEFAULT 1,
    unit VARCHAR(50) NOT NULL DEFAULT 'tablet',
    route VARCHAR(50) NOT NULL DEFAULT 'ORAL',
    schedule TEXT[] NOT NULL DEFAULT '{}',
    with_food BOOLEAN NOT NULL DEFAULT false,
    instructions TEXT,
    prescribed_by VARCHAR(150),
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX pet_medications_pet_uuid_idx ON pet_medications (pet_uuid);


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

-- Google review likes. One row means a reviewer currently likes a review; unliking
-- deletes the row, so the displayed total is always a live COUNT rather than a stored
-- counter that could drift. The UNIQUE pair is what enforces one like per reviewer per
-- review, so a repeated like is absorbed by the database instead of the application.
-- No separate index on google_business_review_uuid: the UNIQUE constraint already builds
-- a composite index led by that column. reviewer_uuid needs its own index because it is
-- the trailing column of that composite index.
CREATE TABLE google_review_likes (
    uuid                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    google_business_review_uuid   UUID NOT NULL
                                   REFERENCES google_business_reviews(uuid) ON DELETE CASCADE,
    reviewer_uuid                 UUID NOT NULL
                                   REFERENCES reviewer_identities(uuid) ON DELETE CASCADE,
    created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (google_business_review_uuid, reviewer_uuid)
);

CREATE INDEX google_review_likes_reviewer_idx
    ON google_review_likes (reviewer_uuid);


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
