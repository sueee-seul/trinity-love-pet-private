import type { PoolClient } from 'pg';
import { withDatabaseConnection } from './database.connection.js';
import {
  STAFF_ROLES,
  STAFF_STATUSES,
  type EmploymentType,
  type FacilityOption,
  type ManagerRecipient,
  type StaffMember,
  type StaffOption,
  type StaffRole,
  type StaffStatus,
} from '../contracts/staff.contract.js';

export interface StaffRow {
  uuid: string;
  legacy_id: string | null;
  display_name: string | null;
  username: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  created_at: Date;
  staff_role: string | null;
  staff_status: string | null;
  employee_number: string | null;
  facility_uuid: string;
  facility_name: string;
  employment_type: EmploymentType;
  title: string | null;
  shift_details: string | null;
}

export const SELECT_STAFF = `
  SELECT u.uuid,
         u.legacy_id,
         u.display_name,
         u.username,
         u.email,
         u.phone,
         u.avatar_url,
         u.created_at,
         e.staff_role,
         e.staff_status,
         e.employee_number,
         e.facility_uuid,
         f.name AS facility_name,
         e.employment_type,
         e.title,
         e.shift_details
  FROM users u
  JOIN employees e ON e.users_uuid = u.uuid
  JOIN facilities f ON f.uuid = e.facility_uuid
`;

/** `dd/mm/yyyy`, matching the format the pet list already uses. */
export const formatJoinedDate = (value: Date): string => {
  const day = String(value.getDate()).padStart(2, '0');
  const month = String(value.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${value.getFullYear()}`;
};

const asStaffRole = (value: string | null): StaffRole => {
  return STAFF_ROLES.find((role) => role === value) ?? 'staff';
};

const asStaffStatus = (value: string | null): StaffStatus => {
  return STAFF_STATUSES.find((status) => status === value) ?? 'active';
};

export const toStaffMember = (row: StaffRow): StaffMember => ({
  id: row.legacy_id ?? row.uuid,
  name: row.display_name ?? row.username,
  username: row.username,
  email: row.email,
  phone: row.phone,
  employee_role: asStaffRole(row.staff_role),
  status: asStaffStatus(row.staff_status),
  employeeNumber: row.employee_number ?? '',
  joinedDate: formatJoinedDate(new Date(row.created_at)),
  avatarUrl: row.avatar_url,
  facilityUuid: row.facility_uuid,
  facilityName: row.facility_name,
  employmentType: row.employment_type,
  title: row.title,
  shiftDetails: row.shift_details,
});

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Accept both legacy ids and PostgreSQL UUIDs without a cast error. */
const identityPredicate = (id: string, parameterIndex: number): string => {
  return UUID_PATTERN.test(id)
    ? `(u.uuid = $${parameterIndex}::uuid OR u.legacy_id = $${parameterIndex}::text)`
    : `u.legacy_id = $${parameterIndex}::text`;
};

export const findStaffRow = async (
  client: PoolClient,
  id: string,
  lock = false,
): Promise<StaffRow | undefined> => {
  const result = await client.query<StaffRow>(
    `${SELECT_STAFF} WHERE ${identityPredicate(id, 1)} LIMIT 1${lock ? ' FOR UPDATE' : ''}`,
    [id],
  );
  return result.rows[0];
};

export const listStaff = async (): Promise<StaffMember[]> => {
  return withDatabaseConnection(async (client) => {
    const result = await client.query<StaffRow>(
      `${SELECT_STAFF} ORDER BY COALESCE(u.display_name, u.username)`,
    );
    return result.rows.map(toStaffMember);
  }, 'listing staff');
};

export const listFacilities = async (): Promise<FacilityOption[]> => {
  return withDatabaseConnection(async (client) => {
    const result = await client.query<FacilityOption>(
      `SELECT uuid::text AS id, name
       FROM facilities
       ORDER BY name, uuid`,
    );
    return result.rows;
  }, 'listing facilities for staff management');
};

export const findStaffById = async (id: string): Promise<StaffMember | undefined> => {
  return withDatabaseConnection(async (client) => {
    const row = await findStaffRow(client, id);
    return row ? toStaffMember(row) : undefined;
  }, 'reading a staff member');
};

export const findStaffByEmail = async (email: string): Promise<StaffMember | undefined> => {
  return withDatabaseConnection(async (client) => {
    const result = await client.query<StaffRow>(
      `${SELECT_STAFF} WHERE lower(u.email) = lower($1) LIMIT 1`,
      [email.trim()],
    );
    const row = result.rows[0];
    return row ? toStaffMember(row) : undefined;
  }, 'reading a staff member by email');
};

export const listStaffOptions = async (): Promise<StaffOption[]> => {
  return withDatabaseConnection(async (client) => {
    const result = await client.query<StaffOption>(
      `SELECT u.uuid::text AS id,
              COALESCE(u.display_name, u.username) AS name
       FROM users u
       JOIN employees e ON e.users_uuid = u.uuid
       WHERE u.is_employee = TRUE
       ORDER BY COALESCE(u.display_name, u.username), u.uuid`,
    );
    return result.rows;
  }, 'listing staff options');
};

export const findManagerRecipient = async (): Promise<ManagerRecipient | undefined> => {
  return withDatabaseConnection(async (client) => {
    const result = await client.query<ManagerRecipient>(
      `SELECT u.uuid::text AS id,
              COALESCE(u.display_name, u.username) AS name,
              u.email
       FROM users u
       JOIN employees e ON e.users_uuid = u.uuid
       WHERE u.is_employee = TRUE
         AND e.staff_role = 'manager'
       ORDER BY COALESCE(u.display_name, u.username), u.uuid
       LIMIT 1`,
    );
    return result.rows[0];
  }, 'reading the manager recipient');
};
