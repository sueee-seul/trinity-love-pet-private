import { pool } from '../config/database.js';

export interface PetOwnerName {
  first_name: string;
  last_name: string;
}

export const findPetOwnerNames = async (
  ownerUuids: string[],
): Promise<Map<string, PetOwnerName>> => {
  if (ownerUuids.length === 0) {
    return new Map();
  }
  const result = await pool.query<{ users_uuid: string; first_name: string; last_name: string }>(
    'SELECT users_uuid, first_name, last_name FROM pet_owners WHERE users_uuid = ANY($1)',
    [ownerUuids],
  );
  return new Map(
    result.rows.map((row) => [
      row.users_uuid,
      { first_name: row.first_name, last_name: row.last_name },
    ]),
  );
};

export const findPetNames = async (petUuids: string[]): Promise<Map<string, string>> => {
  if (petUuids.length === 0) {
    return new Map();
  }
  const result = await pool.query<{ uuid: string; name: string }>(
    'SELECT uuid, name FROM pets WHERE uuid = ANY($1)',
    [petUuids],
  );
  return new Map(result.rows.map((row) => [row.uuid, row.name]));
};

/** `display_name` is the real human name set on the account; `username` (their login handle) is only a fallback for the rare row without one set. */
export const findUserDisplayName = async (userUuid: string): Promise<string> => {
  const result = await pool.query<{ display_name: string | null; username: string }>(
    'SELECT display_name, username FROM users WHERE uuid = $1',
    [userUuid],
  );
  const row = result.rows[0];
  return row?.display_name ?? row?.username ?? 'Staff';
};
