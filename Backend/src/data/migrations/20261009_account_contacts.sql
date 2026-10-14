-- account_contacts: the people a parent names as emergency contacts. informed_at records that the
-- parent told the person we hold their details (Privacy Act 2020 IPP 3A, in force 1 May 2026).
--
-- The same table as in 20261009_pickup_coordination.sql on concierge_combo_booking, without the
-- pick-up columns and tables, which this branch does not have. The shared development database
-- already has it, so IF NOT EXISTS leaves that database unchanged. The role check keeps 'pickup'
-- so both branches describe one table; this branch only reads and writes 'emergency'.
--
-- Down path: DROP TABLE account_contacts;
BEGIN;

CREATE TABLE IF NOT EXISTS account_contacts (
    uuid             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pet_owners_uuid  UUID NOT NULL REFERENCES pet_owners(users_uuid) ON DELETE CASCADE,
    role             VARCHAR(20) NOT NULL CHECK (role IN ('emergency', 'pickup')),
    name             VARCHAR(120) NOT NULL,
    phone            VARCHAR(40),
    relationship     VARCHAR(80),
    -- When the parent confirmed they told this person that we hold their details.
    informed_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS account_contacts_owner_idx ON account_contacts (pet_owners_uuid, role);

COMMIT;
