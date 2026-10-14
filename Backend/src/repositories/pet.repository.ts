import { pool } from '../config/database.js';
import type { CheckInOutcome } from '../contracts/booking.check-in.contract.js';
import type { Pet, PetGender, PetType } from '../contracts/pet.contract.js';
import type { ManagerReviewStatus, ReviewedStay } from '../contracts/stay-status.contract.js';

export interface PetDetailFields {
  healthNotes: string | null;
  behaviourNotes: string | null;
}

/**
 * A pet as stored, with the stay its status comes from (the current one, else the next, else the
 * last) instead of a status; the service names it with the shared stay rule.
 */
export type PetRecord = Omit<Pet, 'status'> &
  PetDetailFields & {
    stay: ReviewedStay | null;
  };

interface PetRow {
  id: string;
  name: string;
  stay_review_status: ManagerReviewStatus | null;
  stay_check_in_outcome: CheckInOutcome | null;
  type: PetType;
  age: number;
  gender: PetGender;
  owner_name: string;
  breed: string | null;
  weight: number | null;
  microchip_number: string | null;
  drop_off_time: Date | null;
  pick_up_time: Date | null;
  created_at: Date;
  health_notes: string | null;
  behaviour_notes: string | null;
}

// The `pets` table has no check-in/check-out columns of its own: arrivals are recorded on the
// stay (booking_pets.check_in_outcome) at the desk, and a stay ends at its pick-up time. The status
// is not read from pets.status (a single value per pet that stuck across stays); the service names
// the chosen stay with the same rule the owner's pages use. `pets.gender` is an undocumented
// boolean in the schema; TRUE is treated as Male here (confirm with the team if that turns out to
// be backwards).
const PET_ROW_QUERY = `
  SELECT
    p.uuid::text AS id,
    p.name AS name,
    stay.manager_review_status AS stay_review_status,
    stay.check_in_outcome AS stay_check_in_outcome,
    CASE
      WHEN LOWER(COALESCE(p.species, '')) = 'dog' THEN 'Dog'
      WHEN LOWER(COALESCE(p.species, '')) = 'cat' THEN 'Cat'
      ELSE 'Other'
    END AS type,
    COALESCE(p.age, 0) AS age,
    CASE WHEN p.gender IS FALSE THEN 'Female' ELSE 'Male' END AS gender,
    CONCAT_WS(' ', po.first_name, po.last_name) AS owner_name,
    p.breed,
    p.weight,
    p.microchip_number,
    stay.drop_off_time,
    stay.pick_up_time,
    p.created_at,
    p.health_notes,
    p.behaviour_notes
  FROM pets p
  JOIN pet_owners po ON po.users_uuid = p.pet_owners_uuid
  -- The stay that says where the pet is: one under way, else the next one, else the last one.
  -- Only requests that still stand (waiting or confirmed) count; a refused or cancelled one does
  -- not say where the pet is.
  LEFT JOIN LATERAL (
    SELECT bp.manager_review_status, bp.check_in_outcome, bp.drop_off_time, bp.pick_up_time
    FROM booking_pets bp
    JOIN bookings b ON b.uuid = bp.bookings_uuid
    WHERE bp.pet_uuid = p.uuid
      AND b.status IN ('paid', 'confirmed')
      AND bp.manager_review_status IN ('pending', 'approved')
    ORDER BY
      (bp.drop_off_time <= now() AND (bp.pick_up_time IS NULL OR bp.pick_up_time >= now()))
        DESC NULLS LAST,
      (bp.drop_off_time > now()) DESC NULLS LAST,
      CASE WHEN bp.drop_off_time > now() THEN bp.drop_off_time END ASC NULLS LAST,
      bp.drop_off_time DESC NULLS LAST,
      bp.created_at DESC
    LIMIT 1
  ) stay ON true
`;

const formatDateNZ = (date: Date | null): string | null => {
  if (!date) {
    return null;
  }
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Pacific/Auckland',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(date);
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${lookup.day}/${lookup.month}/${lookup.year}`;
};

const toPetRecord = (row: PetRow): PetRecord => ({
  id: row.id,
  name: row.name,
  stay: row.stay_review_status
    ? {
        reviewStatus: row.stay_review_status,
        checkInOutcome: row.stay_check_in_outcome,
        dropOffTime: row.drop_off_time,
        pickUpTime: row.pick_up_time,
      }
    : null,
  type: row.type,
  age: row.age,
  gender: row.gender,
  ownerName: row.owner_name,
  breed: row.breed,
  weight: row.weight == null ? null : Number(row.weight),
  microchipNumber: row.microchip_number,
  // Falls back to the pet's own record date when it has no booking yet.
  checkInDate: formatDateNZ(row.drop_off_time) ?? (formatDateNZ(row.created_at) as string),
  checkOutDate: formatDateNZ(row.pick_up_time),
  healthNotes: row.health_notes,
  behaviourNotes: row.behaviour_notes,
});

export const listPetRecords = async (): Promise<PetRecord[]> => {
  const result = await pool.query<PetRow>(`${PET_ROW_QUERY} ORDER BY p.name ASC`);
  return result.rows.map(toPetRecord);
};

export const getPetRecordById = async (id: string): Promise<PetRecord | null> => {
  const result = await pool.query<PetRow>(`${PET_ROW_QUERY} WHERE p.uuid = $1::uuid LIMIT 1`, [id]);
  const row = result.rows[0];
  return row ? toPetRecord(row) : null;
};

export interface UpdatePetRecordInput {
  type: PetType;
  gender: PetGender;
  age: number;
  ownerName: string;
  breed: string | null;
  weight: number | null;
  microchipNumber: string | null;
}

export const updatePetRecord = async (
  id: string,
  input: UpdatePetRecordInput,
): Promise<boolean> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const petResult = await client.query<{ pet_owners_uuid: string }>(
      `SELECT pet_owners_uuid FROM pets WHERE uuid = $1::uuid FOR UPDATE`,
      [id],
    );
    const pet = petResult.rows[0];
    if (!pet) {
      await client.query('ROLLBACK');
      return false;
    }

    await client.query(
      `UPDATE pets
       SET species = $2,
           gender = $3,
           age = $4,
           breed = $5,
           weight = $6,
           microchip_number = $7,
           updated_at = now()
       WHERE uuid = $1::uuid`,
      [
        id,
        input.type,
        input.gender === 'Male',
        input.age,
        input.breed,
        input.weight,
        input.microchipNumber,
      ],
    );

    const [firstName, ...rest] = input.ownerName.trim().split(/\s+/);
    const lastName = rest.join(' ') || firstName;
    await client.query(
      `UPDATE pet_owners SET first_name = $2, last_name = $3 WHERE users_uuid = $1::uuid`,
      [pet.pet_owners_uuid, firstName, lastName],
    );

    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
};

export const updatePetHealthNotes = async (
  id: string,
  healthNotes: string | null,
): Promise<boolean> => {
  const result = await pool.query(
    `UPDATE pets SET health_notes = $2, updated_at = now() WHERE uuid = $1::uuid`,
    [id, healthNotes],
  );
  return (result.rowCount ?? 0) > 0;
};

export const updatePetBehaviourNotes = async (
  id: string,
  behaviourNotes: string | null,
): Promise<boolean> => {
  const result = await pool.query(
    `UPDATE pets SET behaviour_notes = $2, updated_at = now() WHERE uuid = $1::uuid`,
    [id, behaviourNotes],
  );
  return (result.rowCount ?? 0) > 0;
};

export interface PetMedication {
  id: string;
  name: string;
  strength: string | null;
  dose: number;
  unit: string;
  route: string;
  schedule: string[];
  withFood: boolean;
  instructions: string | null;
  prescribedBy: string | null;
  active: boolean;
}

interface PetMedicationRow {
  id: string;
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

export const listPetMedications = async (petId: string): Promise<PetMedication[]> => {
  const result = await pool.query<PetMedicationRow>(
    `SELECT
       uuid::text AS id,
       name,
       strength,
       dose,
       unit,
       route,
       schedule,
       with_food,
       instructions,
       prescribed_by,
       active
     FROM pet_medications
     WHERE pet_uuid = $1::uuid
     ORDER BY active DESC, name ASC`,
    [petId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    strength: row.strength,
    dose: Number(row.dose),
    unit: row.unit,
    route: row.route,
    schedule: row.schedule,
    withFood: row.with_food,
    instructions: row.instructions,
    prescribedBy: row.prescribed_by,
    active: row.active,
  }));
};

export interface PetMedicationInput {
  name: string;
  strength: string | null;
  dose: number;
  unit: string;
  route: string;
  schedule: string[];
  withFood: boolean;
  instructions: string | null;
  prescribedBy: string | null;
  active: boolean;
}

export type PartialPetMedicationInput = {
  [K in keyof PetMedicationInput]?: PetMedicationInput[K] | undefined;
};

export const createPetMedication = async (
  petId: string,
  input: PetMedicationInput,
): Promise<string> => {
  const result = await pool.query<{ uuid: string }>(
    `INSERT INTO pet_medications (
       pet_uuid, name, strength, dose, unit, route, schedule, with_food, instructions, prescribed_by, active
     )
     VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING uuid::text AS uuid`,
    [
      petId,
      input.name,
      input.strength,
      input.dose,
      input.unit,
      input.route,
      input.schedule,
      input.withFood,
      input.instructions,
      input.prescribedBy,
      input.active,
    ],
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error('Medication insert returned no row');
  }
  return row.uuid;
};

export const updatePetMedication = async (
  petId: string,
  medicationId: string,
  input: PartialPetMedicationInput,
): Promise<boolean> => {
  const assignments: string[] = [];
  const values: unknown[] = [medicationId, petId];

  const set = (column: string, value: unknown): void => {
    values.push(value);
    assignments.push(`${column} = $${values.length}`);
  };

  if (input.name !== undefined) set('name', input.name);
  if (input.strength !== undefined) set('strength', input.strength);
  if (input.dose !== undefined) set('dose', input.dose);
  if (input.unit !== undefined) set('unit', input.unit);
  if (input.route !== undefined) set('route', input.route);
  if (input.schedule !== undefined) set('schedule', input.schedule);
  if (input.withFood !== undefined) set('with_food', input.withFood);
  if (input.instructions !== undefined) set('instructions', input.instructions);
  if (input.prescribedBy !== undefined) set('prescribed_by', input.prescribedBy);
  if (input.active !== undefined) set('active', input.active);

  if (assignments.length === 0) {
    return true;
  }

  assignments.push('updated_at = now()');
  const result = await pool.query(
    `UPDATE pet_medications SET ${assignments.join(', ')} WHERE uuid = $1::uuid AND pet_uuid = $2::uuid`,
    values,
  );
  return (result.rowCount ?? 0) > 0;
};

export const deletePetMedication = async (
  petId: string,
  medicationId: string,
): Promise<boolean> => {
  const result = await pool.query(
    `DELETE FROM pet_medications WHERE uuid = $1::uuid AND pet_uuid = $2::uuid`,
    [medicationId, petId],
  );
  return (result.rowCount ?? 0) > 0;
};
