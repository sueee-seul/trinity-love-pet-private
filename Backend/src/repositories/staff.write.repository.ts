import type { PoolClient } from 'pg';
import { TEMPORARY_PASSWORD_HASH_PREFIX } from '../common/utils/password-hash.js';
import { withDatabaseConnection } from './database.connection.js';
import { findStaffRow, toStaffMember, type StaffRow } from './staff.read.repository.js';
import type {
  EmploymentType,
  StaffMember,
  StaffRole,
  StaffStatus,
} from '../contracts/staff.contract.js';

const STAFF_WRITE_LOCK_KEY = 'tropical-love-pet:staff-writes';

export type StaffCreateResult =
  | { outcome: 'created'; staff: StaffMember }
  | { outcome: 'email_conflict' }
  | { outcome: 'username_conflict' };

export type StaffUpdateResult =
  | { outcome: 'updated'; staff: StaffMember }
  | { outcome: 'not_found' }
  | { outcome: 'email_conflict' }
  | { outcome: 'last_manager' };

export type StaffRemovalResult =
  | { outcome: 'removed' }
  | { outcome: 'not_found' }
  | { outcome: 'self_removal' }
  | { outcome: 'last_manager' }
  | { outcome: 'has_assignments'; staffName: string; count: number };

const acquireStaffWriteLock = async (client: PoolClient): Promise<void> => {
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [STAFF_WRITE_LOCK_KEY]);
};

const rollback = async (client: PoolClient): Promise<void> => {
  await client.query('ROLLBACK');
};

const hasErrorCode = (error: unknown, code: string): boolean => {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
};

const hasConstraint = (error: unknown, constraint: string): boolean => {
  return (
    typeof error === 'object' &&
    error !== null &&
    'constraint' in error &&
    error.constraint === constraint
  );
};

const isEmailUniqueViolation = (error: unknown): boolean =>
  hasErrorCode(error, '23505') && hasConstraint(error, 'users_email_key');

const isUsernameUniqueViolation = (error: unknown): boolean =>
  hasErrorCode(error, '23505') && hasConstraint(error, 'users_username_key');

const countOtherManagers = async (client: PoolClient, uuid: string): Promise<number> => {
  const result = await client.query<{ users_uuid: string }>(
    `SELECT users_uuid
     FROM employees
     WHERE staff_role = 'manager' AND users_uuid <> $1::uuid
     FOR UPDATE`,
    [uuid],
  );
  return result.rows.length;
};

const isEmailTaken = async (
  client: PoolClient,
  email: string,
  excludingUuid?: string,
): Promise<boolean> => {
  const result = await client.query(
    `SELECT 1 FROM users WHERE lower(email) = lower($1) AND ($2::uuid IS NULL OR uuid <> $2::uuid) LIMIT 1`,
    [email, excludingUuid ?? null],
  );
  return (result.rowCount ?? 0) > 0;
};

/** `WS-0007` after `WS-0006`, matching the existing employee numbering. */
const nextEmployeeNumber = async (client: PoolClient): Promise<string> => {
  const result = await client.query<{ highest: number | null }>(
    `SELECT MAX(NULLIF(regexp_replace(employee_number, '\\D', '', 'g'), '')::int) AS highest
     FROM employees`,
  );
  const highest = result.rows[0]?.highest ?? 0;
  return `WS-${String(highest + 1).padStart(4, '0')}`;
};

/** A handle derived from the display name, made unique under the write lock. */
const uniqueUsername = async (client: PoolClient, name: string): Promise<string | null> => {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/^\.+|\.+$/g, '')
      .slice(0, 40) || 'staff';

  for (let suffix = 0; suffix < 100; suffix += 1) {
    const candidate = suffix === 0 ? base : `${base}.${suffix}`;
    const taken = await client.query(`SELECT 1 FROM users WHERE username = $1 LIMIT 1`, [
      candidate,
    ]);
    if (!taken.rowCount) {
      return candidate;
    }
  }
  return null;
};

export interface StaffWriteInput {
  name?: string;
  email?: string;
  phone?: string | null;
  avatarUrl?: string | null;
  employee_role?: StaffRole;
  status?: StaffStatus;
  facilityUuid?: string;
  employmentType?: EmploymentType;
  title?: string | null;
  shiftDetails?: string | null;
}

export const createStaff = async (input: {
  name: string;
  email: string;
  facilityUuid: string;
  employmentType: EmploymentType;
  employee_role: StaffRole;
  status: StaffStatus;
  temporaryPassword: string;
}): Promise<StaffCreateResult> => {
  return withDatabaseConnection(async (client) => {
    let transactionStarted = false;
    try {
      await client.query('BEGIN');
      transactionStarted = true;
      await acquireStaffWriteLock(client);

      if (await isEmailTaken(client, input.email)) {
        await rollback(client);
        transactionStarted = false;
        return { outcome: 'email_conflict' as const };
      }

      const username = await uniqueUsername(client, input.name);
      if (!username) {
        await rollback(client);
        transactionStarted = false;
        return { outcome: 'username_conflict' as const };
      }

      const userResult = await client.query<{ uuid: string }>(
        `INSERT INTO users (
           username, display_name, email,
           is_employee, is_pet_owner, password_hash
         )
         VALUES ($1, $2, $3, TRUE, FALSE, $4 || crypt($5, gen_salt('bf', 12)))
         RETURNING uuid`,
        [
          username,
          input.name,
          input.email,
          TEMPORARY_PASSWORD_HASH_PREFIX,
          input.temporaryPassword,
        ],
      );
      const uuid = userResult.rows[0]?.uuid;
      if (!uuid) {
        throw new Error('Staff insert returned no UUID');
      }

      await client.query(
        `INSERT INTO employees (
           users_uuid, facility_uuid, title, employment_type,
           staff_role, staff_status, employee_number
         )
         VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7)`,
        [
          uuid,
          input.facilityUuid,
          input.employee_role === 'manager' ? 'Centre Manager' : 'Pet Care Attendant',
          input.employmentType,
          input.employee_role,
          input.status,
          await nextEmployeeNumber(client),
        ],
      );

      await client.query('COMMIT');
      transactionStarted = false;

      const row = await findStaffRow(client, uuid);
      if (!row) {
        throw new Error('Staff member disappeared immediately after being created');
      }
      return { outcome: 'created' as const, staff: toStaffMember(row) };
    } catch (error) {
      if (transactionStarted) {
        await client.query('ROLLBACK').catch(() => undefined);
      }
      if (isEmailUniqueViolation(error)) {
        return { outcome: 'email_conflict' as const };
      }
      if (isUsernameUniqueViolation(error)) {
        return { outcome: 'username_conflict' as const };
      }
      throw error;
    }
  }, 'creating a staff member');
};

export const updateStaff = async (
  id: string,
  input: StaffWriteInput,
): Promise<StaffUpdateResult> => {
  return withDatabaseConnection(async (client) => {
    let transactionStarted = false;
    try {
      await client.query('BEGIN');
      transactionStarted = true;
      await acquireStaffWriteLock(client);

      const row = await findStaffRow(client, id, true);
      if (!row) {
        await rollback(client);
        transactionStarted = false;
        return { outcome: 'not_found' as const };
      }

      if (
        input.employee_role !== undefined &&
        row.staff_role === 'manager' &&
        input.employee_role !== 'manager' &&
        (await countOtherManagers(client, row.uuid)) === 0
      ) {
        await rollback(client);
        transactionStarted = false;
        return { outcome: 'last_manager' as const };
      }

      if (input.email !== undefined && (await isEmailTaken(client, input.email, row.uuid))) {
        await rollback(client);
        transactionStarted = false;
        return { outcome: 'email_conflict' as const };
      }

      await client.query(
        `UPDATE users
         SET display_name = COALESCE($2, display_name),
             email        = COALESCE($3, email),
             phone        = CASE WHEN $4::boolean THEN $5 ELSE phone END,
             avatar_url   = CASE WHEN $6::boolean THEN $7 ELSE avatar_url END
         WHERE uuid = $1::uuid`,
        [
          row.uuid,
          input.name ?? null,
          input.email ?? null,
          input.phone !== undefined,
          input.phone ?? null,
          input.avatarUrl !== undefined,
          input.avatarUrl ?? null,
        ],
      );
      await client.query(
        `UPDATE employees
         SET facility_uuid   = COALESCE($2::uuid, facility_uuid),
             employment_type = COALESCE($3, employment_type),
             staff_role      = COALESCE($4, staff_role),
             staff_status    = COALESCE($5, staff_status),
             title           = CASE WHEN $6::boolean THEN $7 ELSE title END,
             shift_details   = CASE WHEN $8::boolean THEN $9 ELSE shift_details END
         WHERE users_uuid = $1::uuid`,
        [
          row.uuid,
          input.facilityUuid ?? null,
          input.employmentType ?? null,
          input.employee_role ?? null,
          input.status ?? null,
          input.title !== undefined,
          input.title ?? null,
          input.shiftDetails !== undefined,
          input.shiftDetails ?? null,
        ],
      );
      await client.query('COMMIT');
      transactionStarted = false;

      const updatedRow = await findStaffRow(client, id);
      if (!updatedRow) {
        throw new Error('Staff member disappeared immediately after being updated');
      }
      return { outcome: 'updated' as const, staff: toStaffMember(updatedRow) };
    } catch (error) {
      if (transactionStarted) {
        await client.query('ROLLBACK').catch(() => undefined);
      }
      if (isEmailUniqueViolation(error)) {
        return { outcome: 'email_conflict' as const };
      }
      throw error;
    }
  }, 'updating a staff member');
};

export const removeStaff = async (
  id: string,
  actingStaffId: string | null,
): Promise<StaffRemovalResult> => {
  return withDatabaseConnection(async (client) => {
    let transactionStarted = false;
    try {
      await client.query('BEGIN');
      transactionStarted = true;
      await acquireStaffWriteLock(client);

      const row: StaffRow | undefined = await findStaffRow(client, id, true);
      if (!row) {
        await rollback(client);
        transactionStarted = false;
        return { outcome: 'not_found' as const };
      }

      const identity = row.legacy_id ?? row.uuid;
      if (actingStaffId === identity || actingStaffId === row.uuid) {
        await rollback(client);
        transactionStarted = false;
        return { outcome: 'self_removal' as const };
      }

      if (row.staff_role === 'manager' && (await countOtherManagers(client, row.uuid)) === 0) {
        await rollback(client);
        transactionStarted = false;
        return { outcome: 'last_manager' as const };
      }

      const assignments = await client.query<{ uuid: string }>(
        `SELECT uuid
         FROM employee_assignments
         WHERE employees_uuid = $1::uuid
         FOR UPDATE`,
        [row.uuid],
      );
      const assignedCount = assignments.rows.length;
      if (assignedCount > 0) {
        await rollback(client);
        transactionStarted = false;
        return {
          outcome: 'has_assignments' as const,
          staffName: row.display_name ?? row.username,
          count: assignedCount,
        };
      }

      // `notification.assignee_uuid` has no delete rule, so this person's own bell notices (Google
      // Review and booking request notices, one row per manager) would block the delete below.
      // They are only this person's inbox. Parent notices are never assigned to staff, so none of
      // them are touched.
      await client.query(`DELETE FROM notification WHERE assignee_uuid = $1::uuid`, [row.uuid]);
      // `employees` is removed by the cascade on `users`.
      await client.query(`DELETE FROM users WHERE uuid = $1::uuid`, [row.uuid]);
      await client.query('COMMIT');
      transactionStarted = false;
      return { outcome: 'removed' as const };
    } catch (error) {
      if (transactionStarted) {
        await client.query('ROLLBACK').catch(() => undefined);
      }
      throw error;
    }
  }, 'removing a staff member');
};
