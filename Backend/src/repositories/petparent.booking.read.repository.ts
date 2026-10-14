import { pool } from '../config/database.js';
import type { CheckInOutcome } from '../contracts/booking.check-in.contract.js';
import type { ManagerReviewStatus } from '../contracts/stay-status.contract.js';
import type { BookingServiceCategory } from './petparent.booking.repository.js';

// The read behind "My stays" (GET /api/petparent/bookings). Kept apart from the booking write in
// petparent.booking.repository.ts so each file has one job.

export interface MyBookingServiceRow {
  id: string;
  name: string;
  category: BookingServiceCategory;
  quantity: number;
  priceAtBooking: number;
  priceUnit: string | null;
}

export interface MyBookingCaringInfoRow {
  feedingRoutine: string | null;
  medInstruction: string | null;
  firstTimeBoarding: boolean | null;
  crateTrained: boolean | null;
  socialAllow: boolean | null;
  fullyVaccinated: boolean | null;
  behaveNHealth: string | null;
  others: string | null;
}

export interface MyBookingPetRow {
  bookingPetId: string;
  bookingId: string;
  createdAt: Date;
  petId: string | null;
  petName: string;
  /** The pet profile's species as typed by the parent; null once the profile is deleted. */
  petSpecies: string | null;
  petPhotoUrl: string | null;
  dropOffTime: Date | null;
  pickUpTime: Date | null;
  reviewStatus: ManagerReviewStatus;
  /** What the desk recorded on arrival; null until then. */
  checkInOutcome: CheckInOutcome | null;
  refusalReason: string | null;
  reviewerName: string | null;
  caringInfo: MyBookingCaringInfoRow | null;
  services: MyBookingServiceRow[];
}

interface MyBookingSqlRow {
  booking_pets_uuid: string;
  bookings_uuid: string;
  created_at: Date;
  /** Null once the parent has deleted the pet's profile. */
  pet_id: string | null;
  pet_name: string;
  pet_species: string | null;
  pet_photo_url: string | null;
  drop_off_time: Date | null;
  pick_up_time: Date | null;
  review_status: ManagerReviewStatus;
  check_in_outcome: CheckInOutcome | null;
  refusal_reason: string | null;
  reviewer_name: string | null;
  caring_info: {
    feeding_routine: string | null;
    medication_instructions: string | null;
    first_time_boarding: boolean | null;
    crate_trained: boolean | null;
    other_notes: string | null;
    allows_socialization: boolean | null;
    fully_vaccinated: boolean | null;
    behavior_and_health_notes: string | null;
  } | null;
  services: MyBookingServiceRow[];
}

const toMyBookingPetRow = (row: MyBookingSqlRow): MyBookingPetRow => ({
  bookingPetId: row.booking_pets_uuid,
  bookingId: row.bookings_uuid,
  createdAt: row.created_at,
  petId: row.pet_id,
  petName: row.pet_name,
  petSpecies: row.pet_species,
  petPhotoUrl: row.pet_photo_url,
  dropOffTime: row.drop_off_time,
  pickUpTime: row.pick_up_time,
  reviewStatus: row.review_status,
  checkInOutcome: row.check_in_outcome,
  refusalReason: row.refusal_reason,
  reviewerName: row.reviewer_name,
  caringInfo: row.caring_info && {
    feedingRoutine: row.caring_info.feeding_routine,
    medInstruction: row.caring_info.medication_instructions,
    firstTimeBoarding: row.caring_info.first_time_boarding,
    crateTrained: row.caring_info.crate_trained,
    socialAllow: row.caring_info.allows_socialization,
    fullyVaccinated: row.caring_info.fully_vaccinated,
    behaveNHealth: row.caring_info.behavior_and_health_notes,
    others: row.caring_info.other_notes,
  },
  services: row.services,
});

// One row per booking_pets, same grain as manager.booking.repository.ts's
// MANAGER_BOOKING_QUERY, scoped to the signed-in owner instead of
// provider-wide, plus the full drop-off/pick-up timestamps, booking
// created_at, and per-service quantity/price snapshot the "My Stays"
// booking-details view needs to compute a real total. Every manager decision
// is returned; the service names it (stay-status.ts).
const MY_BOOKINGS_QUERY = `
  SELECT
    bp.uuid::text AS booking_pets_uuid,
    b.uuid::text AS bookings_uuid,
    b.created_at,
    p.uuid::text AS pet_id,
    COALESCE(p.name, bp.pet_name, 'Deleted pet') AS pet_name,
    p.species AS pet_species,
    p.image_url AS pet_photo_url,
    bp.drop_off_time,
    bp.pick_up_time,
    bp.manager_review_status AS review_status,
    bp.check_in_outcome,
    bp.refusal_reason,
    COALESCE(reviewer.display_name, reviewer.username) AS reviewer_name,
    CASE WHEN ci.booking_pets_uuid IS NULL THEN NULL ELSE json_build_object(
      'feeding_routine', ci.feeding_routine,
      'medication_instructions', ci.medication_instructions,
      'first_time_boarding', ci.first_time_boarding,
      'crate_trained', ci.crate_trained,
      'other_notes', ci.other_notes,
      'allows_socialization', ci.allows_socialization,
      'fully_vaccinated', ci.fully_vaccinated,
      'behavior_and_health_notes', ci.behavior_and_health_notes
    ) END AS caring_info,
    (
      SELECT COALESCE(
        json_agg(
          json_build_object(
            'id', s.uuid::text,
            'name', s.name,
            'category', s.category,
            'quantity', bps.quantity,
            'priceAtBooking', bps.price_at_booking::float8,
            'priceUnit', s.price_unit
          )
          ORDER BY bps.created_at
        ),
        '[]'::json
      )
      FROM booking_pets_services bps
      JOIN services s ON s.uuid = bps.services_uuid
      WHERE bps.booking_pets_uuid = bp.uuid
    ) AS services
  FROM booking_pets bp
  JOIN bookings b ON b.uuid = bp.bookings_uuid
  -- LEFT, and owned through the booking: a deleted pet's past stays still belong to this parent.
  LEFT JOIN pets p ON p.uuid = bp.pet_uuid
  LEFT JOIN booking_pets_caring_info ci ON ci.booking_pets_uuid = bp.uuid
  LEFT JOIN users reviewer ON reviewer.uuid = bp.reviewed_by_uuid
  WHERE b.pet_owners_uuid = $1::uuid AND b.status IN ('paid', 'confirmed')
  ORDER BY bp.drop_off_time DESC NULLS LAST
`;

export const listBookingsForOwner = async (petOwnersUuid: string): Promise<MyBookingPetRow[]> => {
  const result = await pool.query<MyBookingSqlRow>(MY_BOOKINGS_QUERY, [petOwnersUuid]);
  return result.rows.map(toMyBookingPetRow);
};
