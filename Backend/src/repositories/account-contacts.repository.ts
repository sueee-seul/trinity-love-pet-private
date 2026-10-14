import { pool } from '../config/database.js';
import type {
  AccountContact,
  ContactInput,
  ContactRole,
  ContactUpdate,
} from '../contracts/account-contacts.contract.js';

/**
 * Rows of `account_contacts`, always scoped to the owner who wrote them and to the emergency role:
 * the 'pickup' rows left from the removed pick-up coordination are never read or changed.
 */

type SqlRunner = Pick<typeof pool, 'query'>;

interface ContactSqlRow {
  id: string;
  role: ContactRole;
  name: string;
  phone: string | null;
  relationship: string | null;
  informed_at: Date | null;
  created_at: Date;
}

const toContact = (row: ContactSqlRow): AccountContact => ({
  id: row.id,
  role: row.role,
  name: row.name,
  phone: row.phone,
  relationship: row.relationship,
  informedAt: row.informed_at?.toISOString() ?? null,
  createdAt: row.created_at.toISOString(),
});

const SELECT = `SELECT uuid::text AS id, role, name, phone, relationship, informed_at, created_at
                  FROM account_contacts`;

export const listContacts = async (
  ownerId: string,
  runner: SqlRunner = pool,
): Promise<AccountContact[]> => {
  const result = await runner.query<ContactSqlRow>(
    `${SELECT} WHERE pet_owners_uuid = $1::uuid AND role = 'emergency' ORDER BY created_at`,
    [ownerId],
  );
  return result.rows.map(toContact);
};

export const insertContact = async (
  ownerId: string,
  input: ContactInput,
  informedAt: Date | null,
  runner: SqlRunner = pool,
): Promise<AccountContact> => {
  const result = await runner.query<ContactSqlRow>(
    `INSERT INTO account_contacts (pet_owners_uuid, role, name, phone, relationship, informed_at)
     VALUES ($1::uuid, $2, $3, $4, $5, $6::timestamptz)
     RETURNING uuid::text AS id, role, name, phone, relationship, informed_at, created_at`,
    [ownerId, input.role, input.name, input.phone ?? null, input.relationship ?? null, informedAt],
  );
  const row = result.rows[0];
  if (!row) throw new Error('account_contacts insert returned no row');
  return toContact(row);
};

/**
 * Changes only the given fields. `informedAt` is three-valued: undefined keeps it, a date sets it,
 * null clears it (the parent unticked the box).
 */
export const updateContact = async (
  ownerId: string,
  contactId: string,
  update: ContactUpdate,
  informedAt: Date | null | undefined,
  runner: SqlRunner = pool,
): Promise<AccountContact | null> => {
  const result = await runner.query<ContactSqlRow>(
    `UPDATE account_contacts
        SET name = COALESCE($3::varchar, name),
            phone = CASE WHEN $4::boolean THEN $5::varchar ELSE phone END,
            relationship = CASE WHEN $6::boolean THEN $7::varchar ELSE relationship END,
            informed_at = CASE WHEN $8::boolean THEN $9::timestamptz ELSE informed_at END,
            updated_at = now()
      WHERE uuid = $1::uuid AND pet_owners_uuid = $2::uuid AND role = 'emergency'
      RETURNING uuid::text AS id, role, name, phone, relationship, informed_at, created_at`,
    [
      contactId,
      ownerId,
      update.name ?? null,
      update.phone !== undefined,
      update.phone ?? null,
      update.relationship !== undefined,
      update.relationship ?? null,
      informedAt !== undefined,
      informedAt ?? null,
    ],
  );
  const row = result.rows[0];
  return row ? toContact(row) : null;
};

export const deleteContact = async (
  ownerId: string,
  contactId: string,
  runner: SqlRunner = pool,
): Promise<boolean> => {
  const result = await runner.query(
    `DELETE FROM account_contacts
      WHERE uuid = $1::uuid AND pet_owners_uuid = $2::uuid AND role = 'emergency'`,
    [contactId, ownerId],
  );
  return (result.rowCount ?? 0) > 0;
};
