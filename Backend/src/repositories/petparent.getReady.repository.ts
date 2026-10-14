import { OWNER_SAID_NEEDS_MEDICATION_NOTE } from '../common/utils/booking-care-notes.js';
import { pool } from '../config/database.js';

// What the account already holds for each approved stay that has not started, reduced to yes or
// no in SQL: the "Get ready" list only needs to know whether a detail is there, so the notes,
// names and phone numbers themselves never leave the database for it. Reads only.

export interface GetReadyFactRow {
  bookingPetId: string;
  /** The parent's Yes on the vaccination page; a certificate is only kept with a Yes. */
  fullyVaccinated: boolean | null;
  hasVaccinationCertificate: boolean;
  petHasDietNotes: boolean;
  stayHasFeedingRoutine: boolean;
  petHasActiveMedication: boolean;
  /** Real instructions for this stay: text other than the concierge's note for staff. */
  stayHasMedicationInstructions: boolean;
  /** The concierge's note is there: the owner said the pet needs medicine but gave no details. */
  ownerSaidNeedsMedication: boolean;
  petHasEmergencyContact: boolean;
  ownerHasEmergencyContact: boolean;
  petHasVetName: boolean;
  petHasVetPhone: boolean;
}

interface GetReadyFactSqlRow {
  booking_pet_id: string;
  fully_vaccinated: boolean | null;
  has_vaccination_certificate: boolean;
  pet_has_diet_notes: boolean;
  stay_has_feeding_routine: boolean;
  pet_has_active_medication: boolean;
  stay_has_medication_instructions: boolean;
  owner_said_needs_medication: boolean;
  pet_has_emergency_contact: boolean;
  owner_has_emergency_contact: boolean;
  pet_has_vet_name: boolean;
  pet_has_vet_phone: boolean;
}

const toGetReadyFactRow = (row: GetReadyFactSqlRow): GetReadyFactRow => ({
  bookingPetId: row.booking_pet_id,
  fullyVaccinated: row.fully_vaccinated,
  hasVaccinationCertificate: row.has_vaccination_certificate,
  petHasDietNotes: row.pet_has_diet_notes,
  stayHasFeedingRoutine: row.stay_has_feeding_routine,
  petHasActiveMedication: row.pet_has_active_medication,
  stayHasMedicationInstructions: row.stay_has_medication_instructions,
  ownerSaidNeedsMedication: row.owner_said_needs_medication,
  petHasEmergencyContact: row.pet_has_emergency_contact,
  ownerHasEmergencyContact: row.owner_has_emergency_contact,
  petHasVetName: row.pet_has_vet_name,
  petHasVetPhone: row.pet_has_vet_phone,
});

// A detail counts only when it has more than spaces in it. Both the booking and the pet must be
// the caller's, so another owner's pet never shows up here even through a booking row. The
// concierge's medication note ($3) says only that the pet takes medicine, so it is read as that
// and never as instructions.
const GET_READY_FACTS_QUERY = `
  SELECT
    bp.uuid::text AS booking_pet_id,
    ci.fully_vaccinated,
    (ci.vaccination_document_url IS NOT NULL) AS has_vaccination_certificate,
    (NULLIF(btrim(p.diet_notes), '') IS NOT NULL) AS pet_has_diet_notes,
    (NULLIF(btrim(ci.feeding_routine), '') IS NOT NULL) AS stay_has_feeding_routine,
    EXISTS (
      SELECT 1 FROM pet_medications m WHERE m.pet_uuid = p.uuid AND m.active
    ) AS pet_has_active_medication,
    (
      NULLIF(btrim(ci.medication_instructions), '') IS NOT NULL
      AND btrim(ci.medication_instructions) <> $3
    ) AS stay_has_medication_instructions,
    COALESCE(btrim(ci.medication_instructions) = $3, false) AS owner_said_needs_medication,
    (NULLIF(btrim(p.emergency_contact), '') IS NOT NULL) AS pet_has_emergency_contact,
    (NULLIF(btrim(po.emergency_contact_number), '') IS NOT NULL) AS owner_has_emergency_contact,
    (NULLIF(btrim(p.vet_name), '') IS NOT NULL) AS pet_has_vet_name,
    (NULLIF(btrim(p.vet_phone), '') IS NOT NULL) AS pet_has_vet_phone
  FROM booking_pets bp
  JOIN bookings b ON b.uuid = bp.bookings_uuid
  JOIN pets p ON p.uuid = bp.pet_uuid
  JOIN pet_owners po ON po.users_uuid = b.pet_owners_uuid
  LEFT JOIN booking_pets_caring_info ci ON ci.booking_pets_uuid = bp.uuid
  WHERE b.pet_owners_uuid = $1::uuid
    AND p.pet_owners_uuid = $1::uuid
    AND bp.manager_review_status = 'approved'
    AND bp.drop_off_time > $2
`;

/** The facts for this owner's approved stays whose drop-off is still after `now`. */
export const listGetReadyFactsForOwner = async (
  petOwnersUuid: string,
  now: Date,
): Promise<GetReadyFactRow[]> => {
  const result = await pool.query<GetReadyFactSqlRow>(GET_READY_FACTS_QUERY, [
    petOwnersUuid,
    now,
    OWNER_SAID_NEEDS_MEDICATION_NOTE,
  ]);
  return result.rows.map(toGetReadyFactRow);
};
