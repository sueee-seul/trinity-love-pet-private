import { pool } from '../config/database.js';
import type { CheckInOutcome } from '../contracts/booking.check-in.contract.js';
import type { ManagerReviewStatus } from '../contracts/stay-status.contract.js';

export interface HomeStayRow {
  bookingId: string;
  bookingPetId: string;
  reviewStatus: ManagerReviewStatus;
  /** What the desk recorded on arrival; null until then. */
  checkInOutcome: CheckInOutcome | null;
  refusalReason: string | null;
  reviewerName: string | null;
  petId: string;
  petName: string;
  petPhotoUrl: string | null;
  dropOffTime: Date;
  pickUpTime: Date;
  serviceType: string | null;
  fullyVaccinated: boolean | null;
  // Whether a certificate is on file and when it came, never its private storage key (only
  // petparent.vaccination.repository.ts reads that).
  hasVaccinationCertificate: boolean;
  vaccinationCertificateUploadedAt: Date | null;
  hasAgreement: boolean;
  paymentSucceeded: boolean;
  cardSaved?: boolean;
  paymentTestMode?: boolean;
}

interface HomeStaySqlRow {
  booking_id: string;
  booking_pet_id: string;
  review_status: ManagerReviewStatus;
  check_in_outcome: CheckInOutcome | null;
  refusal_reason: string | null;
  reviewer_name: string | null;
  pet_id: string;
  pet_name: string;
  pet_photo_url: string | null;
  drop_off_time: Date;
  pick_up_time: Date;
  service_type: string | null;
  fully_vaccinated: boolean | null;
  has_vaccination_certificate: boolean;
  vaccination_certificate_uploaded_at: Date | null;
  has_agreement: boolean;
  payment_succeeded: boolean;
  card_saved: boolean;
  payment_test_mode: boolean;
}

const toHomeStayRow = (row: HomeStaySqlRow): HomeStayRow => ({
  bookingId: row.booking_id,
  bookingPetId: row.booking_pet_id,
  reviewStatus: row.review_status,
  checkInOutcome: row.check_in_outcome,
  refusalReason: row.refusal_reason,
  reviewerName: row.reviewer_name,
  petId: row.pet_id,
  petName: row.pet_name,
  petPhotoUrl: row.pet_photo_url,
  dropOffTime: row.drop_off_time,
  pickUpTime: row.pick_up_time,
  serviceType: row.service_type,
  fullyVaccinated: row.fully_vaccinated,
  hasVaccinationCertificate: row.has_vaccination_certificate,
  vaccinationCertificateUploadedAt: row.vaccination_certificate_uploaded_at,
  hasAgreement: row.has_agreement,
  paymentSucceeded: row.payment_succeeded,
  cardSaved: row.card_saved,
  paymentTestMode: row.payment_test_mode,
});

// One row per booking_pets of this owner's finished checkouts, whatever the manager decided:
// the service reads the decision (see stay-status.ts), so a refused request can still
// ask the parent for other dates. `b.status` only keeps out a checkout that never finished; it
// never decides what the parent reads. Rows without both dates have nothing to show and are skipped.
const HOME_STAY_SELECT = `
  SELECT
    b.uuid::text AS booking_id,
    bp.uuid::text AS booking_pet_id,
    bp.manager_review_status AS review_status,
    bp.check_in_outcome,
    bp.refusal_reason,
    COALESCE(reviewer.display_name, reviewer.username) AS reviewer_name,
    p.uuid::text AS pet_id,
    p.name AS pet_name,
    p.image_url AS pet_photo_url,
    bp.drop_off_time,
    bp.pick_up_time,
    (
      SELECT s.name
      FROM booking_pets_services bps
      JOIN services s ON s.uuid = bps.services_uuid
      WHERE bps.booking_pets_uuid = bp.uuid AND s.category = 'boarding_rate'
      ORDER BY bps.created_at
      LIMIT 1
    ) AS service_type,
    ci.fully_vaccinated,
    (ci.vaccination_document_url IS NOT NULL) AS has_vaccination_certificate,
    ci.vaccination_document_uploaded_at AS vaccination_certificate_uploaded_at,
    EXISTS (SELECT 1 FROM bookings_agreements a WHERE a.bookings_uuid = b.uuid) AS has_agreement,
    EXISTS (
      SELECT 1 FROM booking_payments pay
      WHERE pay.bookings_uuid = b.uuid AND pay.status = 'succeeded'
        -- Paid at request: charged on confirmation, before anything is settled at the desk.
        AND COALESCE(pay.captured_amount, pay.amount) > 0
    ) AS payment_succeeded,
    EXISTS (
      SELECT 1 FROM booking_payments pay JOIN payment_methods pm ON pm.uuid = pay.payment_methods_uuid
      WHERE pay.bookings_uuid = b.uuid AND pm.processor IN ('stripe', 'fake')
        AND pay.status IN ('pending', 'authorized', 'succeeded')
    ) AS card_saved,
    EXISTS (
      SELECT 1 FROM booking_payments pay JOIN payment_methods pm ON pm.uuid = pay.payment_methods_uuid
      WHERE pay.bookings_uuid = b.uuid AND (pm.processor = 'fake' OR (pm.processor = 'stripe' AND $2::boolean))
    ) AS payment_test_mode
  FROM booking_pets bp
  JOIN bookings b ON b.uuid = bp.bookings_uuid
  JOIN pets p ON p.uuid = bp.pet_uuid
  LEFT JOIN booking_pets_caring_info ci ON ci.booking_pets_uuid = bp.uuid
  LEFT JOIN users reviewer ON reviewer.uuid = bp.reviewed_by_uuid
  WHERE b.pet_owners_uuid = $1::uuid
    AND b.status IN ('paid', 'confirmed')
    AND bp.drop_off_time IS NOT NULL
    AND bp.pick_up_time IS NOT NULL
`;

export const findOwnerFirstName = async (petOwnersUuid: string): Promise<string | null> => {
  const result = await pool.query<{ first_name: string }>(
    'SELECT first_name FROM pet_owners WHERE users_uuid = $1::uuid',
    [petOwnersUuid],
  );
  return result.rows[0]?.first_name ?? null;
};

export const listHomeStays = async (
  petOwnersUuid: string,
  stripeTestMode = false,
): Promise<HomeStayRow[]> => {
  const result = await pool.query<HomeStaySqlRow>(
    `${HOME_STAY_SELECT} ORDER BY bp.drop_off_time ASC`,
    [petOwnersUuid, stripeTestMode],
  );
  return result.rows.map(toHomeStayRow);
};

/**
 * One stay, only if its booking belongs to this owner. The caller decides what its review status
 * allows.
 */
export const findHomeStayForOwner = async (
  petOwnersUuid: string,
  bookingPetId: string,
): Promise<HomeStayRow | null> => {
  const result = await pool.query<HomeStaySqlRow>(`${HOME_STAY_SELECT} AND bp.uuid = $3::uuid`, [
    petOwnersUuid,
    false,
    bookingPetId,
  ]);
  const row = result.rows[0];
  return row ? toHomeStayRow(row) : null;
};

export interface OtherBookingPet {
  bookingPetId: string;
  petName: string;
  fullyVaccinated: boolean | null;
  vaccinationCertificateUploadedAt: Date | null;
  reviewStatus: ManagerReviewStatus;
}

/** The other pets on the same booking, for the "Other pets on this booking" card. */
export const listOtherBookingPets = async (
  bookingId: string,
  excludeBookingPetId: string,
): Promise<OtherBookingPet[]> => {
  const result = await pool.query<{
    booking_pet_id: string;
    pet_name: string;
    fully_vaccinated: boolean | null;
    certificate_uploaded_at: Date | null;
    review_status: ManagerReviewStatus;
  }>(
    `SELECT bp.uuid::text AS booking_pet_id, p.name AS pet_name, ci.fully_vaccinated,
            CASE WHEN ci.vaccination_document_url IS NOT NULL
              THEN ci.vaccination_document_uploaded_at END AS certificate_uploaded_at,
            bp.manager_review_status AS review_status
     FROM booking_pets bp
     JOIN pets p ON p.uuid = bp.pet_uuid
     LEFT JOIN booking_pets_caring_info ci ON ci.booking_pets_uuid = bp.uuid
     WHERE bp.bookings_uuid = $1::uuid AND bp.uuid != $2::uuid
     ORDER BY p.name`,
    [bookingId, excludeBookingPetId],
  );
  return result.rows.map((row) => ({
    bookingPetId: row.booking_pet_id,
    petName: row.pet_name,
    fullyVaccinated: row.fully_vaccinated,
    vaccinationCertificateUploadedAt: row.certificate_uploaded_at,
    reviewStatus: row.review_status,
  }));
};
