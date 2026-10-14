import { withDatabaseTransaction } from '../common/utils/database-transaction.js';
import { pool } from '../config/database.js';
import type { ManagerReviewStatus } from '../contracts/stay-status.contract.js';

// The certificate a pet parent gives for one stay. `vaccination_document_url` holds the private
// storage key (see services/vaccination.certificate.storage.ts), never a link, so it is read only
// here and by the services that stream the file; no response ever carries it.

export interface StoredCertificateRow {
  documentKey: string;
  uploadedAt: Date | null;
}

interface CertificateSqlRow {
  document_key: string;
  uploaded_at: Date | null;
}

const CERTIFICATE_SELECT = `
  SELECT ci.vaccination_document_url AS document_key,
         ci.vaccination_document_uploaded_at AS uploaded_at
  FROM booking_pets bp
  JOIN bookings b ON b.uuid = bp.bookings_uuid
  JOIN booking_pets_caring_info ci ON ci.booking_pets_uuid = bp.uuid
  WHERE bp.uuid = $1::uuid
    AND b.status IN ('paid', 'confirmed')
    AND ci.vaccination_document_url IS NOT NULL
`;

const toStoredCertificate = (row: CertificateSqlRow | undefined): StoredCertificateRow | null =>
  row ? { documentKey: row.document_key, uploadedAt: row.uploaded_at } : null;

/**
 * The certificate on a stay this owner booked. Ownership is part of the query, so another owner's
 * id reads exactly like an id that does not exist. Any review status: a parent may always see what
 * they gave us.
 */
export const findCertificateForOwner = async (
  petOwnersUuid: string,
  bookingPetId: string,
): Promise<StoredCertificateRow | null> => {
  const result = await pool.query<CertificateSqlRow>(
    `${CERTIFICATE_SELECT} AND b.pet_owners_uuid = $2::uuid`,
    [bookingPetId, petOwnersUuid],
  );
  return toStoredCertificate(result.rows[0]);
};

/** The certificate on any stay, for employees checking a pet in or reviewing a request. */
export const findCertificateForEmployee = async (
  bookingPetId: string,
): Promise<StoredCertificateRow | null> => {
  const result = await pool.query<CertificateSqlRow>(CERTIFICATE_SELECT, [bookingPetId]);
  return toStoredCertificate(result.rows[0]);
};

export interface VaccinationAnswerWrite {
  petOwnersUuid: string;
  bookingPetId: string;
  fullyVaccinated: boolean;
  documentKey: string | null;
  uploadedAt: Date | null;
  /** The write happens only while the stay is still in one of these review states... */
  openReviewStatuses: readonly ManagerReviewStatus[];
  /** ...and its drop-off is still after this moment. */
  dropOffAfter: Date;
}

export type VaccinationAnswerWriteResult =
  { saved: true; previousDocumentKey: string | null } | { saved: false };

/**
 * Saves the answer and the certificate key in one transaction. The booking pet row is locked with
 * the service's rule repeated in the WHERE clause, so a manager's refusal or a second upload that
 * lands at the same moment cannot slip between the service's check and this write. The previous
 * key is read after the lock, in its own statement, so the caller deletes the file that was really
 * replaced.
 */
export const saveVaccinationAnswer = async (
  write: VaccinationAnswerWrite,
): Promise<VaccinationAnswerWriteResult> =>
  withDatabaseTransaction<VaccinationAnswerWriteResult>(async (client) => {
    const locked = await client.query(
      `SELECT bp.uuid
       FROM booking_pets bp
       JOIN bookings b ON b.uuid = bp.bookings_uuid
       WHERE bp.uuid = $1::uuid
         AND b.pet_owners_uuid = $2::uuid
         AND b.status IN ('paid', 'confirmed')
         AND bp.manager_review_status = ANY($3::text[])
         AND bp.drop_off_time > $4
       FOR UPDATE OF bp`,
      [write.bookingPetId, write.petOwnersUuid, write.openReviewStatuses, write.dropOffAfter],
    );
    if (locked.rowCount === 0) {
      return { transaction: 'rollback', value: { saved: false } };
    }

    const previous = await client.query<{ document_key: string | null }>(
      `SELECT vaccination_document_url AS document_key
       FROM booking_pets_caring_info
       WHERE booking_pets_uuid = $1::uuid`,
      [write.bookingPetId],
    );

    await client.query(
      `INSERT INTO booking_pets_caring_info (
         booking_pets_uuid, fully_vaccinated, vaccination_document_url,
         vaccination_document_uploaded_at
       )
       VALUES ($1::uuid, $2, $3, $4)
       ON CONFLICT (booking_pets_uuid) DO UPDATE SET
         fully_vaccinated = EXCLUDED.fully_vaccinated,
         vaccination_document_url = EXCLUDED.vaccination_document_url,
         vaccination_document_uploaded_at = EXCLUDED.vaccination_document_uploaded_at`,
      [write.bookingPetId, write.fullyVaccinated, write.documentKey, write.uploadedAt],
    );

    return {
      transaction: 'commit',
      value: { saved: true, previousDocumentKey: previous.rows[0]?.document_key ?? null },
    };
  });
