import type { PoolClient } from 'pg';
import { pool } from '../config/database.js';
import { AppError } from '../common/middlewares/error.middleware.js';
import { BOOKING_TERMS_VERSION } from '../contracts/booking.terms.contract.js';

export {
  BOOKING_TERMS_VERSION,
  PAY_AT_REQUEST_TERMS_VERSION,
  SIMPLE_CHANGES_TERMS_VERSION,
} from '../contracts/booking.terms.contract.js';
/** Pulls "concierge-terms-..." from the first line of a terms_versions row (`tv`). */
export const TERMS_VERSION_LABEL_SQL = `split_part(split_part(tv.content, E'
', 1), 'version ', 2)`;
/** The first line of that version's text in terms_versions, written by its data migration. */
const CURRENT_TERMS_HEADING = `Wagstay booking terms, version ${BOOKING_TERMS_VERSION}`;
const changedTerms = (): AppError =>
  new AppError(
    'The booking terms have changed. Refresh the page and read them before agreeing again.',
    'TERMS_VERSION_CHANGED',
    409,
  );

/** Checks the displayed version, locking its row when called inside the booking transaction. */
export const currentAgreementTerms = async (
  label: string,
  client?: PoolClient,
): Promise<string> => {
  if (label !== BOOKING_TERMS_VERSION) throw changedTerms();
  const result = await (client ?? pool).query<{ id: string }>(
    `SELECT uuid::text AS id FROM terms_versions
      WHERE is_current = true AND split_part(content, E'\n', 1) = $1
      LIMIT 1${client ? ' FOR SHARE' : ''}`,
    [CURRENT_TERMS_HEADING],
  );
  const id = result.rows[0]?.id;
  if (!id) throw changedTerms();
  return id;
};

/** The full text of the version this release shows, or null before its migration has run. */
export const readCurrentAgreementTerms = async (): Promise<string | null> => {
  const result = await pool.query<{ content: string }>(
    `SELECT content FROM terms_versions
      WHERE is_current = true AND split_part(content, E'\n', 1) = $1
      LIMIT 1`,
    [CURRENT_TERMS_HEADING],
  );
  return result.rows[0]?.content ?? null;
};

/** The exact text agreed to for a booking, even after a newer version has become current. */
export const findAgreedTerms = async (bookingId: string): Promise<string | null> => {
  const result = await pool.query<{ content: string }>(
    `SELECT terms.content FROM bookings_agreements agreement
       JOIN terms_versions terms ON terms.uuid = agreement.terms_versions_uuid
      WHERE agreement.bookings_uuid = $1::uuid`,
    [bookingId],
  );
  return result.rows[0]?.content ?? null;
};

/** The account owns the signature identity; a request body cannot impersonate another signer. */
export const agreementName = async (ownerId: string): Promise<string> => {
  const result = await pool.query<{ name: string }>(
    `SELECT trim(concat_ws(' ', first_name, last_name)) AS name
       FROM pet_owners WHERE users_uuid = $1::uuid`,
    [ownerId],
  );
  const name = result.rows[0]?.name?.trim();
  if (!name)
    throw new AppError(
      'Please add your name to your profile before booking.',
      'AGREEMENT_NAME_MISSING',
      422,
    );
  return name;
};
