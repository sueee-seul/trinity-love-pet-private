import type {
  ManagerReviewStatus,
  ReviewedStay,
  StayStatus,
} from '../contracts/stay-status.contract.js';

export type { ReviewedStay } from '../contracts/stay-status.contract.js';

// The one rule behind every stay anyone sees: the pet parent's Home, My stays, Live care, profile,
// vaccination page and AI chatbot, and the staff pet list. The manager's decision on the booking
// pet decides it, then what the desk recorded on arrival, then the clock. `bookings.status` only
// says the checkout finished (every booking is 'paid'), so it never decides a stay's status. Pure,
// so each branch is unit-tested without a database.

// An approved stay follows the desk first: a no-show did not arrive, and a pet Wagstay could not
// take was not accepted after all. A pet checked in is staying even before its booked drop-off
// time that day. Otherwise the clock decides; a missing drop-off reads as not started and a
// missing pick-up as not ended.
const approvedStayStatus = (stay: ReviewedStay, now: Date): StayStatus => {
  if (stay.checkInOutcome === 'no_show') return 'did_not_arrive';
  if (stay.checkInOutcome === 'wagstay_unable') return 'refused';
  const nowMs = now.getTime();
  const checkedIn = stay.checkInOutcome === 'checked_in';
  if (!checkedIn && (stay.dropOffTime === null || nowMs < stay.dropOffTime.getTime())) {
    return 'approved';
  }
  if (stay.pickUpTime !== null && nowMs > stay.pickUpTime.getTime()) return 'stay_ended';
  return 'staying_now';
};

/**
 * A pending request stays "waiting for review" even once its dates arrive: the pet is not
 * booked in until the manager approves it.
 */
export const toStayStatus = (stay: ReviewedStay, now: Date): StayStatus => {
  switch (stay.reviewStatus) {
    case 'cancelled':
      return 'cancelled';
    case 'refused':
      return 'refused';
    case 'pending':
      return 'waiting_for_review';
    case 'approved':
      return approvedStayStatus(stay, now);
    default: {
      // The CHECK constraint makes this unreachable; a new value must be named here first.
      const unknownStatus: never = stay.reviewStatus;
      throw new Error(`Unknown manager review status: ${String(unknownStatus)}`);
    }
  }
};

/** A request that still stands: waiting for the manager, or accepted. */
export const isOpenRequest = (reviewStatus: ManagerReviewStatus): boolean =>
  reviewStatus === 'pending' || reviewStatus === 'approved';

/** Only a stay the manager accepted has live care; nobody cares for a pet that was not booked in. */
export const hasLiveCare = (reviewStatus: ManagerReviewStatus): boolean =>
  reviewStatus === 'approved';

/**
 * The first name of the manager who decided, while that decision stands. The manager is the
 * parent's direct contact, so the parent sees who confirmed or refused. A stay confirmed at
 * checkout, or decided before this was recorded, has no name; a staff cancellation keeps none.
 */
export const reviewerNameFor = (
  reviewStatus: ManagerReviewStatus,
  reviewerName: string | null,
): string | null =>
  reviewStatus === 'approved' || reviewStatus === 'refused'
    ? reviewerName?.trim().split(/\s+/)[0] || null
    : null;

/** The manager's reason, only while the request stands refused, and never an empty string. */
export const refusalReasonFor = (
  reviewStatus: ManagerReviewStatus,
  refusalReason: string | null,
): string | null => (reviewStatus === 'refused' ? refusalReason?.trim() || null : null);

/**
 * The words for replies the server writes itself (the AI chatbot's retrieved records). The web
 * pages hold the same words in Frontend/src/features/pet-parent/components/stays/stayStatus.ts.
 */
export const STAY_STATUS_LABELS: Record<StayStatus, string> = {
  waiting_for_review: 'Waiting for review',
  approved: 'Confirmed',
  staying_now: 'Staying now',
  stay_ended: 'Stay ended',
  did_not_arrive: 'Did not arrive',
  refused: 'Not accepted',
  cancelled: 'Cancelled',
};
