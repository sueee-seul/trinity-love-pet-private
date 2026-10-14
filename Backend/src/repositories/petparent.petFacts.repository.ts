import { pool } from '../config/database.js';
import type { CheckInOutcome } from '../contracts/booking.check-in.contract.js';
import type { ManagerReviewStatus } from '../contracts/stay-status.contract.js';

// What the account already records about each of an owner's pets, so the booking page does not
// ask the parent again (GET /api/petparent/pets). The rows are raw: the service decides what they
// mean with the shared stay status rule. Reads only; no column is added for this.

/** One `booking_pets` row of a pet: the manager's decision and the booked times. */
export interface OwnerPetStayRow {
  petId: string;
  reviewStatus: ManagerReviewStatus;
  /** What the desk recorded on arrival; null until then. */
  checkInOutcome: CheckInOutcome | null;
  dropOffTime: Date | null;
  pickUpTime: Date | null;
}

export interface OwnerPetFactRows {
  /** Pets with at least one `pet_medications` row still marked active. */
  activeMedicationPetIds: Set<string>;
  /** Every stay of every pet on the account, whatever the manager decided. */
  stays: OwnerPetStayRow[];
}

interface MedicatedPetSqlRow {
  pet_id: string;
}

interface PetStaySqlRow {
  pet_id: string;
  review_status: ManagerReviewStatus;
  check_in_outcome: CheckInOutcome | null;
  drop_off_time: Date | null;
  pick_up_time: Date | null;
}

export const listPetFactsForOwner = async (petOwnersUuid: string): Promise<OwnerPetFactRows> => {
  const [medicated, stays] = await Promise.all([
    pool.query<MedicatedPetSqlRow>(
      `SELECT DISTINCT m.pet_uuid::text AS pet_id
       FROM pet_medications m
       JOIN pets p ON p.uuid = m.pet_uuid
       WHERE p.pet_owners_uuid = $1::uuid AND m.active`,
      [petOwnersUuid],
    ),
    pool.query<PetStaySqlRow>(
      `SELECT
         bp.pet_uuid::text AS pet_id,
         bp.manager_review_status AS review_status,
         bp.check_in_outcome,
         bp.drop_off_time,
         bp.pick_up_time
       FROM booking_pets bp
       JOIN pets p ON p.uuid = bp.pet_uuid
       WHERE p.pet_owners_uuid = $1::uuid`,
      [petOwnersUuid],
    ),
  ]);
  return {
    activeMedicationPetIds: new Set(medicated.rows.map((row) => row.pet_id)),
    stays: stays.rows.map((row) => ({
      petId: row.pet_id,
      reviewStatus: row.review_status,
      checkInOutcome: row.check_in_outcome,
      dropOffTime: row.drop_off_time,
      pickUpTime: row.pick_up_time,
    })),
  };
};
