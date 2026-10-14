/**
 * How every page names one stay (one `booking_pets` row): the pet parent's pages and the staff pet
 * list read the same status. Mirrored by Frontend/src/features/pet-parent/types/stays.ts.
 */

import type { CheckInOutcome } from './booking.check-in.contract.js';

/** `booking_pets.manager_review_status`; the database CHECK constraint allows only these. */
export type ManagerReviewStatus = 'pending' | 'approved' | 'refused' | 'cancelled';

/**
 * The manager's decision, what the desk recorded on arrival, and the clock (see
 * services/stay-status.ts). The API sends these values and the frontend turns them into words.
 */
export type StayStatus =
  | 'waiting_for_review'
  | 'approved'
  | 'staying_now'
  | 'stay_ended'
  | 'did_not_arrive'
  | 'refused'
  | 'cancelled';

/** The facts a stay's status is read from (one `booking_pets` row). */
export interface ReviewedStay {
  reviewStatus: ManagerReviewStatus;
  /** What staff recorded at the desk (booking_pets.check_in_outcome); null until then. */
  checkInOutcome: CheckInOutcome | null;
  dropOffTime: Date | null;
  pickUpTime: Date | null;
}
