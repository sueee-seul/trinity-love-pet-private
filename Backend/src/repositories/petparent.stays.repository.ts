import { pool } from '../config/database.js';
import type { CheckInOutcome } from '../contracts/booking.check-in.contract.js';
import type { ManagerReviewStatus } from '../contracts/stay-status.contract.js';

// Every stay (one row per booking_pets, matching the `Stay.id` convention
// parent.profile.repository.ts already uses) belonging to one of this pet
// owner's pets, for every date, not just today: upcoming, currently active, and
// completed. Same STAY_SELECT/roster-join shape as parent.profile's
// STAY_SELECT, scoped directly by owner and denormalized with the pet's
// name/photo so a caller (the frontend, or later an AI chatbot tool) doesn't
// need a second lookup to display or reason about each stay.
export interface PetStayRow {
  booking_pet_id: string;
  booking_id: string;
  service_type: string | null;
  /** Null once the parent has deleted the pet's profile. */
  pet_id: string | null;
  pet_name: string;
  pet_photo_url: string | null;
  review_status: ManagerReviewStatus;
  check_in_outcome: CheckInOutcome | null;
  drop_off_time: Date | null;
  pick_up_time: Date | null;
  facility_name: string | null;
}

export const findStaysForOwner = async (petOwnersUuid: string): Promise<PetStayRow[]> => {
  const result = await pool.query<PetStayRow>(
    `SELECT bp.uuid::text AS booking_pet_id,
            b.uuid::text AS booking_id,
            (
              SELECT s.name
              FROM booking_pets_services bps
              JOIN services s ON s.uuid = bps.services_uuid
              WHERE bps.booking_pets_uuid = bp.uuid AND s.category = 'boarding_rate'
              ORDER BY bps.created_at
              LIMIT 1
            ) AS service_type,
            p.uuid::text AS pet_id,
            COALESCE(p.name, bp.pet_name, 'Deleted pet') AS pet_name,
            p.image_url AS pet_photo_url,
            bp.manager_review_status AS review_status,
            bp.check_in_outcome,
            bp.drop_off_time,
            bp.pick_up_time,
            f.name AS facility_name
     FROM booking_pets bp
     JOIN bookings b ON b.uuid = bp.bookings_uuid
     -- LEFT, and owned through the booking: a deleted pet's past stays still belong to this parent.
     LEFT JOIN pets p ON p.uuid = bp.pet_uuid
     LEFT JOIN LATERAL (
       SELECT e.facility_uuid
       FROM employee_assignments ea
       JOIN employees e ON e.users_uuid = ea.employees_uuid
       WHERE ea.pet_uuid = bp.pet_uuid
       ORDER BY ea.assignment_date DESC
       LIMIT 1
     ) roster ON true
     LEFT JOIN facilities f ON f.uuid = roster.facility_uuid
     WHERE b.pet_owners_uuid = $1::uuid
     ORDER BY bp.drop_off_time DESC NULLS LAST`,
    [petOwnersUuid],
  );
  return result.rows;
};
