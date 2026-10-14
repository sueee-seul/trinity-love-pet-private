/**
 * PostgreSQL reads and writes for `facilities`.
 *
 * `undefined` means the database answered and matched nothing. There is no
 * other outcome: `withDatabaseConnection` throws `DatabaseUnavailableError`
 * when there is no usable database, rather than returning a sentinel the
 * caller could downgrade into a fixture response.
 */

import { withDatabaseConnection } from './database.connection.js';
import type {
  Facility,
  FacilityEditableFields,
  FacilitySize,
} from '../contracts/facility.contract.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface FacilityRow {
  uuid: string;
  name: string;
  suburb: string | null;
  city: string | null;
  size: FacilitySize;
  capacity: number;
  address: string;
  phone: string | null;
  email: string | null;
  about: string | null;
}

const SELECT = `
  SELECT uuid::text AS uuid, name, suburb, city, size, capacity, address, phone, email, about
  FROM facilities
`;

const toFacility = (row: FacilityRow): Facility => ({
  id: row.uuid,
  name: row.name,
  suburb: row.suburb,
  city: row.city,
  size: row.size,
  capacity: Number(row.capacity),
  address: row.address,
  phone: row.phone,
  email: row.email,
  about: row.about,
});

export const listFacilities = async (): Promise<Facility[]> => {
  return withDatabaseConnection(async (client) => {
    const result = await client.query<FacilityRow>(`${SELECT} ORDER BY created_at, name`);
    return result.rows.map(toFacility);
  }, 'list facilities');
};

export const findFacilityById = async (id: string): Promise<Facility | undefined> => {
  if (!UUID_PATTERN.test(id)) {
    return undefined;
  }

  return withDatabaseConnection(async (client) => {
    const result = await client.query<FacilityRow>(`${SELECT} WHERE uuid = $1::uuid LIMIT 1`, [id]);
    const row = result.rows[0];
    return row ? toFacility(row) : undefined;
  }, 'find facility');
};

export const updateFacility = async (
  id: string,
  changes: FacilityEditableFields,
): Promise<Facility | undefined> => {
  if (!UUID_PATTERN.test(id)) {
    return undefined;
  }

  return withDatabaseConnection(async (client) => {
    const result = await client.query<FacilityRow>(
      `UPDATE facilities
       SET name = $2, suburb = $3, city = $4, size = $5, capacity = $6,
           address = $7, phone = $8, email = $9, about = $10, updated_at = now()
       WHERE uuid = $1::uuid
       RETURNING uuid::text AS uuid, name, suburb, city, size, capacity, address, phone, email, about`,
      [
        id,
        changes.name,
        changes.suburb,
        changes.city,
        changes.size,
        changes.capacity,
        changes.address,
        changes.phone,
        changes.email,
        changes.about,
      ],
    );
    const row = result.rows[0];
    return row ? toFacility(row) : undefined;
  }, 'update facility');
};
