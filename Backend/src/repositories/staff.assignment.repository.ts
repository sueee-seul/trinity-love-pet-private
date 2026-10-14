import type { PoolClient } from 'pg';
import { withDatabaseConnection } from './database.connection.js';
import { findStaffRow, formatJoinedDate } from './staff.read.repository.js';
import type { PetAssignment } from '../contracts/pet.assignment.contract.js';

export interface AssignedPetRow {
  petId: string;
  petName: string;
  petType: string;
  ownerName: string;
  checkInDate: string;
  checkOutDate: string | null;
}

export type ListAssignedPetsResult =
  { outcome: 'found'; assignments: AssignedPetRow[] } | { outcome: 'not_found' };

/**
 * Assignments as `employee_assignments` records them: a shift on a date for a
 * pet. The check-out date is the shift's own end, not the pet's departure.
 */
export const listAssignedPets = async (id: string): Promise<ListAssignedPetsResult> => {
  return withDatabaseConnection(async (client: PoolClient) => {
    const row = await findStaffRow(client, id);
    if (!row) {
      return { outcome: 'not_found' as const };
    }
    const result = await client.query<{
      pet_uuid: string;
      pet_name: string;
      species: string | null;
      owner_name: string;
      assignment_date: Date;
      shift_end: string | null;
    }>(
      `SELECT DISTINCT ON (p.uuid)
              p.uuid AS pet_uuid,
              p.name AS pet_name,
              p.species,
              concat_ws(' ', o.first_name, o.last_name) AS owner_name,
              a.assignment_date,
              a.shift_end
       FROM employee_assignments a
       JOIN pets p ON p.uuid = a.pet_uuid
       JOIN pet_owners o ON o.users_uuid = p.pet_owners_uuid
       WHERE a.employees_uuid = $1::uuid
       ORDER BY p.uuid, a.assignment_date DESC`,
      [row.uuid],
    );

    return {
      outcome: 'found' as const,
      assignments: result.rows.map((assignment) => ({
        petId: assignment.pet_uuid,
        petName: assignment.pet_name,
        petType: assignment.species ?? 'Other',
        ownerName: assignment.owner_name,
        checkInDate: formatJoinedDate(new Date(assignment.assignment_date)),
        checkOutDate: null,
      })),
    };
  }, 'listing assigned pets');
};

interface PetAssignmentRow {
  uuid: string;
  pet_uuid: string;
  pet_name: string;
  employee_uuid: string;
  employee_name: string;
  assignment_date: string;
  shift_start: string | null;
  shift_end: string | null;
}

const PET_ASSIGNMENT_SELECT = `
  SELECT a.uuid::text AS uuid,
         a.pet_uuid::text AS pet_uuid,
         p.name AS pet_name,
         a.employees_uuid::text AS employee_uuid,
         COALESCE(u.display_name, u.username) AS employee_name,
         a.assignment_date::text AS assignment_date,
         a.shift_start::text AS shift_start,
         a.shift_end::text AS shift_end
  FROM employee_assignments a
  JOIN pets p ON p.uuid = a.pet_uuid
  JOIN employees e ON e.users_uuid = a.employees_uuid
  JOIN users u ON u.uuid = e.users_uuid
`;

const toPetAssignment = (row: PetAssignmentRow): PetAssignment => ({
  uuid: row.uuid,
  petUuid: row.pet_uuid,
  petName: row.pet_name,
  employeeUuid: row.employee_uuid,
  employeeName: row.employee_name,
  assignmentDate: row.assignment_date,
  shiftStart: row.shift_start,
  shiftEnd: row.shift_end,
});

export type ListPetAssignmentsResult =
  { outcome: 'found'; assignments: PetAssignment[] } | { outcome: 'not_found' };

export const listPetAssignments = async (petUuid: string): Promise<ListPetAssignmentsResult> => {
  return withDatabaseConnection(async (client) => {
    const pet = await client.query<{ uuid: string }>(
      `SELECT uuid::text AS uuid FROM pets WHERE uuid = $1::uuid LIMIT 1`,
      [petUuid],
    );
    if (!pet.rows[0]) {
      return { outcome: 'not_found' as const };
    }

    const result = await client.query<PetAssignmentRow>(
      `${PET_ASSIGNMENT_SELECT}
       WHERE a.pet_uuid = $1::uuid
       ORDER BY a.assignment_date DESC, a.shift_start NULLS FIRST, a.uuid`,
      [petUuid],
    );
    return { outcome: 'found' as const, assignments: result.rows.map(toPetAssignment) };
  }, 'listing pet assignments');
};

export interface CreatePetAssignmentRepositoryInput {
  petUuid: string;
  employeeUuid: string;
  assignmentDate: string;
  shiftStart: string | null;
  shiftEnd: string | null;
}

export type CreatePetAssignmentResult =
  | { outcome: 'created'; assignment: PetAssignment }
  | { outcome: 'pet_not_found' }
  | { outcome: 'employee_not_found' }
  | { outcome: 'duplicate' };

const isUniqueViolation = (error: unknown): boolean => {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
};

export const createPetAssignment = async (
  input: CreatePetAssignmentRepositoryInput,
): Promise<CreatePetAssignmentResult> => {
  return withDatabaseConnection(async (client) => {
    let transactionStarted = false;
    try {
      await client.query('BEGIN');
      transactionStarted = true;

      const pet = await client.query<{ uuid: string; name: string }>(
        `SELECT uuid::text AS uuid, name
         FROM pets
         WHERE uuid = $1::uuid
         FOR UPDATE`,
        [input.petUuid],
      );
      const petRow = pet.rows[0];
      if (!petRow) {
        await client.query('ROLLBACK');
        transactionStarted = false;
        return { outcome: 'pet_not_found' as const };
      }

      const employee = await client.query<{ uuid: string; name: string }>(
        `SELECT u.uuid::text AS uuid,
                COALESCE(u.display_name, u.username) AS name
         FROM employees e
         JOIN users u ON u.uuid = e.users_uuid
         WHERE e.users_uuid = $1::uuid
         FOR UPDATE OF e, u`,
        [input.employeeUuid],
      );
      const employeeRow = employee.rows[0];
      if (!employeeRow) {
        await client.query('ROLLBACK');
        transactionStarted = false;
        return { outcome: 'employee_not_found' as const };
      }

      const duplicate = await client.query<{ uuid: string }>(
        input.shiftStart === null
          ? `SELECT uuid::text AS uuid
             FROM employee_assignments
             WHERE pet_uuid = $1::uuid
               AND employees_uuid = $2::uuid
               AND assignment_date = $3::date
               AND shift_start IS NULL
             LIMIT 1`
          : `SELECT uuid::text AS uuid
             FROM employee_assignments
             WHERE pet_uuid = $1::uuid
               AND employees_uuid = $2::uuid
               AND assignment_date = $3::date
               AND shift_start = $4::time
             LIMIT 1`,
        input.shiftStart === null
          ? [input.petUuid, input.employeeUuid, input.assignmentDate]
          : [input.petUuid, input.employeeUuid, input.assignmentDate, input.shiftStart],
      );
      if (duplicate.rows[0]) {
        await client.query('ROLLBACK');
        transactionStarted = false;
        return { outcome: 'duplicate' as const };
      }

      const inserted = await client.query<PetAssignmentRow>(
        `INSERT INTO employee_assignments (
           employees_uuid, pet_uuid, assignment_date, shift_start, shift_end
         )
         VALUES ($1::uuid, $2::uuid, $3::date, $4::time, $5::time)
         RETURNING uuid::text AS uuid,
                   pet_uuid::text AS pet_uuid,
                   assignment_date::text AS assignment_date,
                   shift_start::text AS shift_start,
                   shift_end::text AS shift_end`,
        [input.employeeUuid, input.petUuid, input.assignmentDate, input.shiftStart, input.shiftEnd],
      );
      const assignmentRow = inserted.rows[0];
      if (!assignmentRow) {
        throw new Error('Pet assignment insert returned no row');
      }

      await client.query('COMMIT');
      transactionStarted = false;
      return {
        outcome: 'created' as const,
        assignment: toPetAssignment({
          ...assignmentRow,
          pet_name: petRow.name,
          employee_uuid: employeeRow.uuid,
          employee_name: employeeRow.name,
        }),
      };
    } catch (error) {
      if (transactionStarted) {
        await client.query('ROLLBACK').catch(() => undefined);
      }
      if (isUniqueViolation(error)) {
        return { outcome: 'duplicate' as const };
      }
      throw error;
    }
  }, 'creating a pet assignment');
};

export type DeletePetAssignmentResult = { outcome: 'deleted' } | { outcome: 'not_found' };

export const deletePetAssignment = async (
  petUuid: string,
  assignmentUuid: string,
): Promise<DeletePetAssignmentResult> => {
  return withDatabaseConnection(async (client) => {
    let transactionStarted = false;
    try {
      await client.query('BEGIN');
      transactionStarted = true;

      const pet = await client.query<{ uuid: string }>(
        `SELECT uuid::text AS uuid FROM pets WHERE uuid = $1::uuid FOR UPDATE`,
        [petUuid],
      );
      if (!pet.rows[0]) {
        await client.query('ROLLBACK');
        transactionStarted = false;
        return { outcome: 'not_found' as const };
      }

      const deleted = await client.query<{ uuid: string }>(
        `DELETE FROM employee_assignments
         WHERE uuid = $1::uuid AND pet_uuid = $2::uuid
         RETURNING uuid::text AS uuid`,
        [assignmentUuid, petUuid],
      );
      if (!deleted.rows[0]) {
        await client.query('ROLLBACK');
        transactionStarted = false;
        return { outcome: 'not_found' as const };
      }

      await client.query('COMMIT');
      transactionStarted = false;
      return { outcome: 'deleted' as const };
    } catch (error) {
      if (transactionStarted) {
        await client.query('ROLLBACK').catch(() => undefined);
      }
      throw error;
    }
  }, 'deleting a pet assignment');
};
