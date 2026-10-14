/**
 * PostgreSQL reads and writes for the pet parent profile.
 *
 * `undefined` is a query that ran fine and found nothing. There is no other
 * outcome: `withDatabaseConnection` throws `DatabaseUnavailableError` when
 * there is no usable database, rather than returning a sentinel the caller
 * could downgrade into a fixture response.
 *
 * The extra pet columns and the `pet_medications` table this file reads are
 * part of the canonical schema (`database/neon.sql`); nothing here creates or
 * alters a table.
 */

import type { PoolClient } from 'pg';
import { withDatabaseConnection } from './database.connection.js';
import type {
  Medication,
  OwnerEditableFields,
  OwnerProfile,
  ParentPet,
  ParentProfile,
  PetWritableFields,
  Species,
  Stay,
} from '../contracts/parent-profile.contract.js';
import type { CheckInOutcome } from '../contracts/booking.check-in.contract.js';
import type { ManagerReviewStatus } from '../contracts/stay-status.contract.js';

/**
 * A stay as stored: the manager's decision and the raw times instead of a status. The service
 * names the status (parent.profile.service.ts), with the same rule every other parent page uses.
 */
export interface StoredStay extends Omit<Stay, 'status'> {
  reviewStatus: ManagerReviewStatus;
  /** What the desk recorded on arrival; null until then. */
  checkInOutcome: CheckInOutcome | null;
  dropOffTime: Date | null;
  pickUpTime: Date | null;
}

export interface StoredPet extends Omit<ParentPet, 'stays'> {
  stays: StoredStay[];
}

export interface StoredParentProfile extends Omit<ParentProfile, 'pets'> {
  pets: StoredPet[];
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The app knows a parent both as a `users.uuid` and as a legacy `u4` id. */
const ownerLookupSql = (paramIndex: number): string =>
  `(u.uuid::text = $${paramIndex} OR u.legacy_id = $${paramIndex})`;

interface OwnerRow {
  uuid: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  address: string | null;
  date_of_birth: Date | null;
  emergency_contact_number: string | null;
}

const toIsoDate = (value: Date | null): string | null =>
  value ? value.toISOString().slice(0, 10) : null;

const toOwner = (row: OwnerRow): OwnerProfile => ({
  id: row.uuid,
  fullName: row.full_name?.trim() || row.email,
  email: row.email,
  phone: row.phone ?? '',
  avatarUrl: row.avatar_url,
  address: row.address ?? '',
  dateOfBirth: toIsoDate(row.date_of_birth),
  emergencyContactNumber: row.emergency_contact_number ?? '',
});

const OWNER_SELECT = `
  SELECT u.uuid::text AS uuid,
         COALESCE(NULLIF(CONCAT_WS(' ', po.first_name, po.last_name), ''), u.display_name)
           AS full_name,
         u.email,
         u.phone,
         u.avatar_url,
         po.address,
         po.date_of_birth,
         po.emergency_contact_number
  FROM users u
  LEFT JOIN pet_owners po ON po.users_uuid = u.uuid
`;

interface PetRow {
  uuid: string;
  owner_uuid: string;
  name: string;
  species: string | null;
  breed: string | null;
  image_url: string | null;
  date_of_birth: Date | null;
  gender: boolean | null;
  desexed: boolean | null;
  weight: string | null;
  colour: string | null;
  microchip_number: string | null;
  diet_notes: string | null;
  allergies: string | null;
  behaviour_notes: string | null;
  vet_name: string | null;
  vet_phone: string | null;
  emergency_contact: string | null;
}

const toSpecies = (value: string | null): Species => {
  const normalized = (value ?? '').trim().toUpperCase();
  if (normalized === 'DOG') {
    return 'DOG';
  }
  if (normalized === 'CAT') {
    return 'CAT';
  }
  return 'OTHER';
};

const splitAllergies = (value: string | null): string[] =>
  (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

const toPet = (row: PetRow): StoredPet => ({
  id: row.uuid,
  ownerId: row.owner_uuid,
  name: row.name,
  species: toSpecies(row.species),
  breed: row.breed,
  photoUrl: row.image_url,
  birthDate: toIsoDate(row.date_of_birth),
  // `pets.gender` is an undocumented boolean. `pet.repository.ts` already reads
  // FALSE as Female, so the same reading is used here rather than a second,
  // contradictory one.
  sex: row.gender === null ? '' : row.gender ? 'male' : 'female',
  desexed: row.desexed ?? false,
  weightKg: row.weight === null ? null : Number(row.weight),
  colour: row.colour,
  microchip: row.microchip_number,
  dietNotes: row.diet_notes,
  allergies: splitAllergies(row.allergies),
  behaviourNotes: row.behaviour_notes,
  vetName: row.vet_name,
  vetPhone: row.vet_phone,
  emergencyContact: row.emergency_contact,
  medications: [],
  stays: [],
});

const PET_SELECT = `
  SELECT p.uuid::text AS uuid,
         p.pet_owners_uuid::text AS owner_uuid,
         p.name, p.species, p.breed, p.image_url, p.date_of_birth, p.gender,
         p.desexed, p.weight, p.colour, p.microchip_number, p.diet_notes,
         p.allergies, p.behaviour_notes, p.vet_name, p.vet_phone, p.emergency_contact
  FROM pets p
`;

interface MedicationRow {
  uuid: string;
  pet_uuid: string;
  name: string;
  strength: string | null;
  dose: string;
  unit: string;
  route: string;
  schedule: string[];
  with_food: boolean;
  instructions: string | null;
  prescribed_by: string | null;
  active: boolean;
}

const toMedication = (row: MedicationRow): Medication => ({
  id: row.uuid,
  petId: row.pet_uuid,
  name: row.name,
  strength: row.strength,
  dose: Number(row.dose),
  unit: row.unit,
  route: row.route,
  schedule: row.schedule ?? [],
  withFood: row.with_food,
  instructions: row.instructions,
  prescribedBy: row.prescribed_by,
  active: row.active,
});

interface StayRow {
  uuid: string;
  pet_uuid: string;
  review_status: ManagerReviewStatus;
  check_in_outcome: CheckInOutcome | null;
  drop_off_time: Date | null;
  pick_up_time: Date | null;
  facility_uuid: string | null;
  facility_name: string | null;
  facility_suburb: string | null;
}

const toStay = (row: StayRow): StoredStay => {
  const start = row.drop_off_time ?? new Date();
  const end = row.pick_up_time ?? start;
  const sameDay = start.toDateString() === end.toDateString();
  return {
    id: row.uuid,
    petId: row.pet_uuid,
    facilityId: row.facility_uuid ?? '',
    type: sameDay ? 'DAYCARE' : 'BOARDING',
    reviewStatus: row.review_status,
    checkInOutcome: row.check_in_outcome,
    dropOffTime: row.drop_off_time,
    pickUpTime: row.pick_up_time,
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    runName: null,
    facility:
      row.facility_uuid && row.facility_name
        ? {
            id: row.facility_uuid,
            name: row.facility_name,
            suburb: row.facility_suburb ?? '',
          }
        : null,
  };
};

/**
 * The ERD has no direct pet-to-facility link on a booking. The only path runs
 * through the carer rostered onto that pet, so the facility is read across that
 * join and left null when nobody is rostered yet.
 */
const STAY_SELECT = `
  SELECT bp.uuid::text AS uuid,
         bp.pet_uuid::text AS pet_uuid,
         bp.manager_review_status AS review_status,
         bp.check_in_outcome,
         bp.drop_off_time,
         bp.pick_up_time,
         f.uuid::text AS facility_uuid,
         f.name AS facility_name,
         f.suburb AS facility_suburb
  FROM booking_pets bp
  LEFT JOIN LATERAL (
    SELECT e.facility_uuid
    FROM employee_assignments ea
    JOIN employees e ON e.users_uuid = ea.employees_uuid
    WHERE ea.pet_uuid = bp.pet_uuid
    ORDER BY ea.assignment_date DESC
    LIMIT 1
  ) roster ON true
  LEFT JOIN facilities f ON f.uuid = roster.facility_uuid
`;

const loadProfileFor = async (
  client: PoolClient,
  ownerUuid: string,
): Promise<StoredParentProfile> => {
  const owner = await client.query<OwnerRow>(`${OWNER_SELECT} WHERE u.uuid = $1::uuid LIMIT 1`, [
    ownerUuid,
  ]);
  const ownerRow = owner.rows[0];
  if (!ownerRow) {
    throw new Error(`Owner ${ownerUuid} disappeared mid-read`);
  }

  const pets = await client.query<PetRow>(
    `${PET_SELECT} WHERE p.pet_owners_uuid = $1::uuid ORDER BY p.created_at, p.name`,
    [ownerUuid],
  );
  const byId = new Map<string, StoredPet>();
  for (const row of pets.rows) {
    const pet = toPet(row);
    byId.set(pet.id, pet);
  }

  if (byId.size > 0) {
    const petIds = [...byId.keys()];
    const medications = await client.query<MedicationRow>(
      `SELECT uuid::text AS uuid, pet_uuid::text AS pet_uuid, name, strength, dose, unit,
              route, schedule, with_food, instructions, prescribed_by, active
       FROM pet_medications
       WHERE pet_uuid = ANY($1::uuid[])
       ORDER BY created_at`,
      [petIds],
    );
    for (const row of medications.rows) {
      byId.get(row.pet_uuid)?.medications.push(toMedication(row));
    }

    const stays = await client.query<StayRow>(
      `${STAY_SELECT} WHERE bp.pet_uuid = ANY($1::uuid[]) ORDER BY bp.drop_off_time DESC NULLS LAST`,
      [petIds],
    );
    for (const row of stays.rows) {
      byId.get(row.pet_uuid)?.stays.push(toStay(row));
    }
  }

  return { owner: toOwner(ownerRow), pets: [...byId.values()] };
};

/* -------------------------------------------------------------------- reads */

/**
 * Who a pet belongs to, so a caller can be checked against it before a write
 * is allowed to touch that pet. `undefined` means no such pet, and the caller
 * decides whether that is a 404 or, since it is also the not-yet-created case,
 * nothing to forbid yet.
 */
export const findPetOwnerId = async (petId: string): Promise<string | undefined> => {
  if (!UUID_PATTERN.test(petId)) {
    return undefined;
  }
  return withDatabaseConnection(async (client) => {
    const result = await client.query<{ owner_uuid: string }>(
      `SELECT pet_owners_uuid::text AS owner_uuid FROM pets WHERE uuid = $1::uuid LIMIT 1`,
      [petId],
    );
    return result.rows[0]?.owner_uuid;
  }, 'find pet owner');
};

export const findProfileByEmail = async (
  email: string,
): Promise<StoredParentProfile | undefined> => {
  return withDatabaseConnection(async (client) => {
    const owner = await client.query<{ uuid: string }>(
      `SELECT u.uuid::text AS uuid FROM users u
       WHERE lower(u.email) = lower($1) AND u.is_pet_owner = TRUE LIMIT 1`,
      [email],
    );
    const ownerUuid = owner.rows[0]?.uuid;
    if (!ownerUuid) {
      return undefined;
    }
    return loadProfileFor(client, ownerUuid);
  }, 'find parent profile by email');
};

const resolveOwnerUuid = async (
  client: PoolClient,
  ownerId: string,
): Promise<string | undefined> => {
  const result = await client.query<{ uuid: string }>(
    `SELECT u.uuid::text AS uuid FROM users u
     WHERE ${ownerLookupSql(1)} LIMIT 1`,
    [ownerId],
  );
  return result.rows[0]?.uuid;
};

/* ------------------------------------------------------------------- writes */

export const updateOwner = async (
  ownerId: string,
  changes: Partial<OwnerEditableFields>,
): Promise<StoredParentProfile | undefined> => {
  return withDatabaseConnection(async (client) => {
    const ownerUuid = await resolveOwnerUuid(client, ownerId);
    if (!ownerUuid) {
      return undefined;
    }

    if (changes.fullName !== undefined) {
      const [firstName, ...rest] = changes.fullName.trim().split(/\s+/);
      const lastName = rest.join(' ') || firstName;
      await client.query(`UPDATE users SET display_name = $2 WHERE uuid = $1::uuid`, [
        ownerUuid,
        changes.fullName.trim(),
      ]);
      await client.query(
        `UPDATE pet_owners SET first_name = $2, last_name = $3 WHERE users_uuid = $1::uuid`,
        [ownerUuid, firstName, lastName],
      );
    }
    if (changes.phone !== undefined) {
      await client.query(`UPDATE users SET phone = $2 WHERE uuid = $1::uuid`, [
        ownerUuid,
        changes.phone,
      ]);
    }
    if (changes.avatarUrl !== undefined) {
      await client.query(`UPDATE users SET avatar_url = $2 WHERE uuid = $1::uuid`, [
        ownerUuid,
        changes.avatarUrl,
      ]);
    }
    if (changes.address !== undefined) {
      await client.query(`UPDATE pet_owners SET address = $2 WHERE users_uuid = $1::uuid`, [
        ownerUuid,
        changes.address,
      ]);
    }
    if (changes.dateOfBirth !== undefined) {
      await client.query(
        `UPDATE pet_owners SET date_of_birth = $2::date WHERE users_uuid = $1::uuid`,
        [ownerUuid, changes.dateOfBirth],
      );
    }
    if (changes.emergencyContactNumber !== undefined) {
      await client.query(
        `UPDATE pet_owners SET emergency_contact_number = $2 WHERE users_uuid = $1::uuid`,
        [ownerUuid, changes.emergencyContactNumber],
      );
    }

    return loadProfileFor(client, ownerUuid);
  }, 'update parent owner');
};

const petWriteParams = (
  ownerUuid: string,
  input: PetWritableFields,
): [string, ...(string | number | boolean | null)[]] => [
  ownerUuid,
  input.name,
  input.species,
  input.breed,
  input.photoUrl,
  input.birthDate,
  input.sex === '' || input.sex === null ? null : input.sex === 'male',
  input.desexed,
  input.weightKg,
  input.colour,
  input.microchip,
  input.dietNotes,
  input.allergies.join(', '),
  input.behaviourNotes,
  input.vetName,
  input.vetPhone,
  input.emergencyContact,
];

export const createPet = async (
  ownerId: string,
  input: PetWritableFields,
): Promise<StoredParentProfile | undefined> => {
  return withDatabaseConnection(async (client) => {
    const ownerUuid = await resolveOwnerUuid(client, ownerId);
    if (!ownerUuid) {
      return undefined;
    }

    await client.query(
      `INSERT INTO pets (
         pet_owners_uuid, name, species, breed, image_url, date_of_birth, gender,
         desexed, weight, colour, microchip_number, diet_notes, allergies,
         behaviour_notes, vet_name, vet_phone, emergency_contact
       )
       VALUES ($1::uuid, $2, $3, $4, $5, $6::date, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      petWriteParams(ownerUuid, input),
    );

    return loadProfileFor(client, ownerUuid);
  }, 'create parent pet');
};

export const updatePet = async (
  petId: string,
  input: PetWritableFields,
): Promise<StoredParentProfile | undefined> => {
  if (!UUID_PATTERN.test(petId)) {
    return undefined;
  }

  return withDatabaseConnection(async (client) => {
    const existing = await client.query<{ owner_uuid: string }>(
      `SELECT pet_owners_uuid::text AS owner_uuid FROM pets WHERE uuid = $1::uuid LIMIT 1`,
      [petId],
    );
    const ownerUuid = existing.rows[0]?.owner_uuid;
    if (!ownerUuid) {
      return undefined;
    }

    const [, ...values] = petWriteParams(ownerUuid, input);
    await client.query(
      `UPDATE pets SET
         name = $2, species = $3, breed = $4, image_url = $5, date_of_birth = $6::date,
         gender = $7, desexed = $8, weight = $9, colour = $10, microchip_number = $11,
         diet_notes = $12, allergies = $13, behaviour_notes = $14, vet_name = $15,
         vet_phone = $16, emergency_contact = $17, updated_at = now()
       WHERE uuid = $1::uuid`,
      [petId, ...values],
    );

    return loadProfileFor(client, ownerUuid);
  }, 'update parent pet');
};

export type DeletePetResult =
  | { status: 'deleted'; profile: StoredParentProfile; photoUrl: string | null }
  | { status: 'has_open_stay' }
  | { status: 'not_found' };

/**
 * A stay that still needs the pet's profile: one not over yet (no outcome, or checked in, with a
 * pick-up still ahead), or one whose card guarantee is not settled. The desk, the 48-hour job and
 * the care tasks all read the pet while either is true.
 */
const OPEN_STAY_OF_PET = `
  SELECT 1
    FROM booking_pets bp
    JOIN bookings b ON b.uuid = bp.bookings_uuid
   WHERE bp.pet_uuid = $1::uuid
     AND b.status IN ('paid', 'confirmed')
     AND bp.manager_review_status IN ('pending', 'approved')
     AND (
       ((bp.check_in_outcome IS NULL OR bp.check_in_outcome = 'checked_in')
         AND (bp.pick_up_time IS NULL OR bp.pick_up_time > now()))
       OR EXISTS (
         SELECT 1 FROM booking_payments pay
          WHERE pay.bookings_uuid = b.uuid
            AND pay.status IN ('pending', 'authorized', 'failed')
       )
     )`;

/**
 * Deletes the pet's profile; its medications and care tasks go with it (ON DELETE CASCADE). Past
 * stays, payments and feedback stay on record: their pet_uuid becomes NULL and each stay keeps
 * booking_pets.pet_name. The open-stay check and the delete are one statement, so a stay cannot
 * slip in between them.
 */
export const deletePet = async (petId: string): Promise<DeletePetResult> => {
  if (!UUID_PATTERN.test(petId)) {
    return { status: 'not_found' };
  }

  return withDatabaseConnection(async (client) => {
    const deleted = await client.query<{ owner_uuid: string; image_url: string | null }>(
      `DELETE FROM pets
        WHERE uuid = $1::uuid
          AND NOT EXISTS (${OPEN_STAY_OF_PET})
       RETURNING pet_owners_uuid::text AS owner_uuid, image_url`,
      [petId],
    );
    const removed = deleted.rows[0];
    if (!removed) {
      const exists = await client.query(`SELECT 1 FROM pets WHERE uuid = $1::uuid`, [petId]);
      return exists.rowCount ? { status: 'has_open_stay' } : { status: 'not_found' };
    }

    return {
      status: 'deleted',
      profile: await loadProfileFor(client, removed.owner_uuid),
      photoUrl: removed.image_url,
    };
  }, 'delete parent pet');
};
