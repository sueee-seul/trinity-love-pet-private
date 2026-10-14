import type { PoolClient } from 'pg';
import { pool } from '../config/database.js';
import { TEMPORARY_PASSWORD_HASH_PREFIX } from '../common/utils/password-hash.js';
import {
  withDatabaseTransaction,
  type DatabaseTransactionResult,
} from '../common/utils/database-transaction.js';

export interface DatabaseAuthUser {
  id: string;
  email: string;
  username: string;
  name: string;
  is_employee: boolean;
  is_pet_owner: boolean;
  staff_role: string | null;
  is_temporary_password: boolean;
}

/** Emergency contact, address and date of birth are optional: null when the parent left them blank. */
export interface CreatePetParentAccountInput {
  email: string;
  username: string;
  password: string;
  emergencyContactNumber: string | null;
  firstName: string;
  lastName: string;
  address: string | null;
  dateOfBirth: string | null;
}

export interface CreatedPetParentAccount {
  id: string;
  email: string;
  username: string;
  name: string;
}

export interface PasswordResetTarget {
  id: string;
  password_hash: string | null;
}

export interface CreateGooglePetParentAccountInput {
  email: string;
  username: string;
  emergencyContactNumber: string | null;
  firstName: string;
  lastName: string;
  address: string | null;
  dateOfBirth: string | null;
}

const USER_PROJECTION = `
  SELECT
    u.uuid::text AS id,
    u.email,
    u.username,
    COALESCE(
      NULLIF(CONCAT_WS(' ', po.first_name, po.last_name), ''),
      u.username
    ) AS name,
    u.is_employee,
    u.is_pet_owner,
    e.staff_role,
    COALESCE(
      u.password_hash LIKE '${TEMPORARY_PASSWORD_HASH_PREFIX}%',
      FALSE
    ) AS is_temporary_password
  FROM users AS u
  LEFT JOIN pet_owners AS po ON po.users_uuid = u.uuid
  LEFT JOIN employees AS e ON e.users_uuid = u.uuid`;

const findUser = async (
  whereClause: string,
  values: string[],
): Promise<DatabaseAuthUser | null> => {
  const result = await pool.query<DatabaseAuthUser>(
    `${USER_PROJECTION}
  WHERE ${whereClause}
  LIMIT 1`,
    values,
  );

  return result.rows[0] ?? null;
};

export const findUserByEmail = async (email: string): Promise<DatabaseAuthUser | null> => {
  return findUser('LOWER(u.email) = LOWER($1)', [email]);
};

export const findUserById = async (id: string): Promise<DatabaseAuthUser | null> => {
  return findUser('u.uuid = $1::uuid', [id]);
};

export const findUserByUsername = async (username: string): Promise<DatabaseAuthUser | null> => {
  return findUser('LOWER(u.username) = LOWER($1)', [username]);
};

export const findPasswordResetTargetByEmail = async (
  email: string,
): Promise<PasswordResetTarget | null> => {
  const result = await pool.query<PasswordResetTarget>(
    `SELECT uuid::text AS id, password_hash
     FROM users
     WHERE LOWER(email) = LOWER($1)
     LIMIT 1`,
    [email],
  );

  return result.rows[0] ?? null;
};

export const findPasswordHashById = async (userId: string): Promise<string | null> => {
  const result = await pool.query<{ password_hash: string | null }>(
    `SELECT password_hash
     FROM users
     WHERE uuid = $1::uuid
     LIMIT 1`,
    [userId],
  );

  return result.rows[0]?.password_hash ?? null;
};

export const findUserByCredentials = async (
  email: string,
  password: string,
): Promise<DatabaseAuthUser | null> => {
  return findUser(
    `LOWER(u.email) = LOWER($1)
    AND (
      (
        u.password_hash LIKE '${TEMPORARY_PASSWORD_HASH_PREFIX}%'
        AND substring(u.password_hash FROM ${TEMPORARY_PASSWORD_HASH_PREFIX.length + 1}) =
            crypt($2, substring(u.password_hash FROM ${TEMPORARY_PASSWORD_HASH_PREFIX.length + 1}))
      )
      OR (
        u.password_hash NOT LIKE '${TEMPORARY_PASSWORD_HASH_PREFIX}%'
        AND u.password_hash = crypt($2, u.password_hash)
      )
    )`,
    [email, password],
  );
};

const createPetOwnerProfile = async (
  client: PoolClient,
  userId: string,
  input: CreateGooglePetParentAccountInput,
): Promise<string> => {
  const ownerResult = await client.query<{ first_name: string; last_name: string }>(
    `INSERT INTO pet_owners (
       users_uuid,
       emergency_contact_number,
       first_name,
       last_name,
       address,
       date_of_birth
     )
     VALUES ($1::uuid, $2, $3, $4, $5, $6::date)
     RETURNING first_name, last_name`,
    [
      userId,
      input.emergencyContactNumber,
      input.firstName,
      input.lastName,
      input.address,
      input.dateOfBirth,
    ],
  );
  const owner = ownerResult.rows[0];
  if (!owner) {
    throw new Error('Pet owner insert returned no profile');
  }
  return `${owner.first_name} ${owner.last_name}`.trim();
};

const finalizeAccountCreation = async (
  client: PoolClient,
  user: { id: string; email: string; username: string } | undefined,
  input: CreateGooglePetParentAccountInput,
): Promise<DatabaseTransactionResult<CreatedPetParentAccount>> => {
  if (!user) {
    throw new Error('User insert returned no account');
  }
  const name = await createPetOwnerProfile(client, user.id, input);
  return {
    transaction: 'commit' as const,
    value: {
      id: user.id,
      email: user.email,
      username: user.username,
      name,
    },
  };
};

export const createPetParentAccount = async (
  input: CreatePetParentAccountInput,
): Promise<CreatedPetParentAccount> => {
  return withDatabaseTransaction(async (client) => {
    const userResult = await client.query<{
      id: string;
      email: string;
      username: string;
    }>(
      `INSERT INTO users (username, email, is_employee, is_pet_owner, password_hash)
       VALUES ($1, $2, FALSE, TRUE, crypt($3, gen_salt('bf', 12)))
       RETURNING uuid::text AS id, email, username`,
      [input.username, input.email, input.password],
    );

    return finalizeAccountCreation(client, userResult.rows[0], input);
  });
};

export const createGooglePetParentAccount = async (
  input: CreateGooglePetParentAccountInput,
): Promise<CreatedPetParentAccount> => {
  return withDatabaseTransaction(async (client) => {
    const userResult = await client.query<{
      id: string;
      email: string;
      username: string;
    }>(
      `INSERT INTO users (username, email, is_employee, is_pet_owner, password_hash)
       VALUES ($1, $2, FALSE, TRUE, NULL)
       RETURNING uuid::text AS id, email, username`,
      [input.username, input.email],
    );

    return finalizeAccountCreation(client, userResult.rows[0], input);
  });
};

export const updateUserPasswordByEmail = async (
  email: string,
  password: string,
): Promise<{ id: string; email: string } | null> => {
  const result = await pool.query<{ id: string; email: string }>(
    `UPDATE users
     SET password_hash = crypt($1, gen_salt('bf', 12))
     WHERE LOWER(email) = LOWER($2)
     RETURNING uuid::text AS id, email`,
    [password, email],
  );

  return result.rows[0] ?? null;
};

export const updateUserPasswordFromTemporary = async (
  userId: string,
  password: string,
): Promise<{ id: string; email: string } | null> => {
  const result = await pool.query<{ id: string; email: string }>(
    `UPDATE users
     SET password_hash = crypt($1, gen_salt('bf', 12))
     WHERE uuid = $2::uuid
       AND password_hash LIKE '${TEMPORARY_PASSWORD_HASH_PREFIX}%'
     RETURNING uuid::text AS id, email`,
    [password, userId],
  );

  return result.rows[0] ?? null;
};

export const updateUserPasswordFromReset = async (
  userId: string,
  expectedPasswordHash: string,
  password: string,
): Promise<boolean> => {
  const result = await pool.query<{ id: string }>(
    `UPDATE users
     SET password_hash = crypt($1, gen_salt('bf', 12))
     WHERE uuid = $2::uuid
       AND password_hash = $3
     RETURNING uuid::text AS id`,
    [password, userId, expectedPasswordHash],
  );

  return result.rows.length > 0;
};
