import { randomBytes } from 'node:crypto';
import type { PoolClient } from 'pg';
import { pool } from '../config/database.js';
import { withDatabaseTransaction } from '../common/utils/database-transaction.js';
import type { ConciergeSpecies } from '../contracts/concierge.contract.js';

/**
 * Writes the concierge needs before a booking can exist: a passwordless pet-owner account for a
 * newly verified email, and the pets named at checkout. Both happen in one transaction so a failed
 * pet insert never leaves an account behind with nothing in it.
 *
 * Accounts are created without a password (`users.password_hash` is nullable) and without a date
 * of birth (`pet_owners.date_of_birth` is nullable); the owner can add a password later. No column
 * is added or changed.
 */

/**
 * A guest's new account. The booking form asks only optionally for an emergency contact and home
 * address (owner decision of 2026-09-29; no law requires either), so both columns may stay empty.
 */
export interface NewConciergeOwner {
  email: string;
  /** A first-time guest's password, hashed by the database (bcrypt, cost 12) like sign-up. */
  password?: string | undefined;
  /** The owner's own mobile, stored on users.phone so the facility can reach them. */
  phone: string;
  firstName: string;
  lastName: string;
  address?: string | undefined;
  emergencyContactNumber?: string | undefined;
}

export interface NewConciergePet {
  name: string;
  species: ConciergeSpecies;
  breed?: string | undefined;
}

export interface ConciergeOwnerAndPetsInput {
  /** Set to attach pets to an existing owner; omit (with `newOwner`) to create one. */
  existingOwnerId?: string | undefined;
  newOwner?: NewConciergeOwner | undefined;
  pets: NewConciergePet[];
}

export interface ConciergeOwnerAndPetsResult {
  ownerId: string;
  accountCreated: boolean;
  /** Ids of the created pets, in the order they were given. */
  petIds: string[];
}

const USERNAME_MAX_LENGTH = 50;
const USERNAME_SUFFIX_BYTES = 3;
const UNIQUE_VIOLATION = '23505';

/**
 * Usernames are required and unique but a concierge guest never chooses one, so one is derived
 * from the email's local part plus a random suffix ("ava.mitchell-3f9a1c").
 */
export const deriveUsername = (email: string, suffix: string): string => {
  const [localPart = ''] = email.split('@');
  const local = localPart.toLowerCase().replace(/[^a-z0-9._-]/g, '') || 'guest';
  const maxLocal = USERNAME_MAX_LENGTH - suffix.length - 1;
  return `${local.slice(0, maxLocal)}-${suffix}`;
};

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === UNIQUE_VIOLATION;

/** Phone numbers are stored without spaces or brackets: the same number the phone rule accepted. */
const compactPhone = (phone: string): string => phone.replace(/[\s\-().]/g, '');

const insertOwner = async (client: PoolClient, owner: NewConciergeOwner): Promise<string> => {
  const username = deriveUsername(owner.email, randomBytes(USERNAME_SUFFIX_BYTES).toString('hex'));
  const userResult = await client.query<{ id: string }>(
    `INSERT INTO users (username, email, phone, is_employee, is_pet_owner, password_hash)
     VALUES ($1, $2, $3, FALSE, TRUE,
             CASE WHEN $4::text IS NULL THEN NULL ELSE crypt($4::text, gen_salt('bf', 12)) END)
     RETURNING uuid::text AS id`,
    [username, owner.email, compactPhone(owner.phone), owner.password ?? null],
  );
  const userId = userResult.rows[0]?.id;
  if (!userId) {
    throw new Error('User insert returned no account');
  }
  await client.query(
    `INSERT INTO pet_owners (users_uuid, emergency_contact_number, first_name, last_name, address, date_of_birth)
     VALUES ($1::uuid, $5, $2, $3, $4, NULL)`,
    [
      userId,
      owner.firstName,
      owner.lastName,
      owner.address ?? null,
      owner.emergencyContactNumber?.trim() ? compactPhone(owner.emergencyContactNumber) : null,
    ],
  );
  return userId;
};

const insertPets = async (
  client: PoolClient,
  ownerId: string,
  pets: NewConciergePet[],
): Promise<string[]> => {
  const petIds: string[] = [];
  for (const pet of pets) {
    const result = await client.query<{ id: string }>(
      `INSERT INTO pets (pet_owners_uuid, name, species, breed)
       VALUES ($1::uuid, $2, $3, $4)
       RETURNING uuid::text AS id`,
      [ownerId, pet.name, pet.species, pet.breed ?? null],
    );
    const petId = result.rows[0]?.id;
    if (!petId) {
      throw new Error('Pet insert returned no row');
    }
    petIds.push(petId);
  }
  return petIds;
};

export class ConciergeEmailTakenError extends Error {
  constructor() {
    super('An account already exists for this email');
    this.name = 'ConciergeEmailTakenError';
  }
}

export const createOwnerAndPets = async (
  input: ConciergeOwnerAndPetsInput,
): Promise<ConciergeOwnerAndPetsResult> => {
  try {
    return await withDatabaseTransaction(async (client) => {
      let ownerId = input.existingOwnerId;
      let accountCreated = false;
      if (!ownerId) {
        if (!input.newOwner) {
          throw new Error('Either an existing owner or a new owner is required');
        }
        ownerId = await insertOwner(client, input.newOwner);
        accountCreated = true;
      }
      const petIds = await insertPets(client, ownerId, input.pets);
      return { transaction: 'commit' as const, value: { ownerId, accountCreated, petIds } };
    });
  } catch (error: unknown) {
    // The email is the only unique column a verified guest controls; a username clash on a random
    // suffix is vanishingly rare and surfaces as a normal failure.
    if (isUniqueViolation(error) && input.newOwner) {
      throw new ConciergeEmailTakenError();
    }
    throw error;
  }
};

/**
 * Compensation for a checkout whose booking failed after its account or pets were written: removes
 * only what that attempt created. An existing owner and their saved pets are never touched; a new
 * account is removed with everything under it (pet_owners and pets cascade from users).
 */
export const removeCreatedOwnerAndPets = async (
  created: ConciergeOwnerAndPetsResult,
): Promise<void> => {
  await withDatabaseTransaction(async (client) => {
    if (created.accountCreated) {
      await client.query('DELETE FROM users WHERE uuid = $1::uuid', [created.ownerId]);
    } else if (created.petIds.length > 0) {
      await client.query(
        'DELETE FROM pets WHERE pet_owners_uuid = $1::uuid AND uuid = ANY($2::uuid[])',
        [created.ownerId, created.petIds],
      );
    }
    return { transaction: 'commit' as const, value: undefined };
  });
};

/**
 * The booking-pet rows a booking just created, in the order of `petIds`, so the confirmation can
 * link each pet's safety tasks (for example /parent/vaccination/:bookingPetId). Read-only.
 */
export const findBookingPetIds = async (bookingId: string, petIds: string[]): Promise<string[]> => {
  const result = await pool.query<{ uuid: string; pet_uuid: string }>(
    'SELECT uuid, pet_uuid FROM booking_pets WHERE bookings_uuid = $1::uuid',
    [bookingId],
  );
  const byPet = new Map(result.rows.map((row) => [row.pet_uuid, row.uuid]));
  const bookingPetIds = petIds.map((petId) => byPet.get(petId));
  // All or nothing: a partial list would link a task to the wrong pet.
  return bookingPetIds.every((id): id is string => id !== undefined) ? bookingPetIds : [];
};

/**
 * Whether an account with this email has a password. Normal sign-up does not prove the address,
 * so an email code must not sign anyone into such an account: its owner signs in with the
 * password instead. Read-only; the hash itself never leaves the database.
 */
export const emailHasPasswordAccount = async (email: string): Promise<boolean> => {
  const result = await pool.query<{ has_password: boolean }>(
    'SELECT (password_hash IS NOT NULL) AS has_password FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
    [email],
  );
  return result.rows[0]?.has_password === true;
};

/** The species written on an owner's saved pets, by pet id. Read-only. */
export const findSavedPetSpecies = async (
  ownerId: string,
  petIds: string[],
): Promise<Map<string, string | null>> => {
  if (petIds.length === 0) return new Map();
  const result = await pool.query<{ id: string; species: string | null }>(
    'SELECT uuid::text AS id, species FROM pets WHERE pet_owners_uuid = $1::uuid AND uuid = ANY($2::uuid[])',
    [ownerId, petIds],
  );
  return new Map(result.rows.map((row) => [row.id, row.species]));
};

/** Each pet's name by id, for the checkout's notices. */
export const findPetNames = async (petIds: string[]): Promise<Map<string, string>> => {
  if (petIds.length === 0) return new Map();
  const result = await pool.query<{ id: string; name: string }>(
    'SELECT uuid::text AS id, name FROM pets WHERE uuid = ANY($1::uuid[])',
    [petIds],
  );
  return new Map(result.rows.map((row) => [row.id, row.name]));
};
