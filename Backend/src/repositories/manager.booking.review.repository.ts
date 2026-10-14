import type { PoolClient } from 'pg';
import { withDatabaseTransaction } from '../common/utils/database-transaction.js';
import type { ManagerReviewStatus } from '../contracts/stay-status.contract.js';
import {
  insertParentNoticeWithinTransaction,
  type BookingNoticeSubject,
  type ParentNoticeDraft,
} from './booking.notification.repository.js';

// A manager's decision on one booking pet, and the parent's notice about it, in one transaction.

/** The booking pet as it stood just before the decision, with what a notice about it needs. */
export interface ReviewedBookingPet {
  bookingId: string;
  ownerId: string;
  subject: BookingNoticeSubject;
  previousStatus: ManagerReviewStatus;
  previousRefusalReason: string | null;
}

/** The parent's notice for a decision, or null when the decision tells the parent nothing new. */
export type DecisionNoticeComposer = (reviewed: ReviewedBookingPet) => ParentNoticeDraft | null;

interface ReviewDecision {
  status: Extract<ManagerReviewStatus, 'pending' | 'approved' | 'refused'>;
  refusalReason: string | null;
  /** The manager who decided; null when the stay goes back to review. */
  reviewerId: string | null;
}

interface ReviewedBookingPetRow {
  booking_id: string;
  owner_id: string;
  pet_name: string;
  drop_off_time: Date | null;
  pick_up_time: Date | null;
  manager_review_status: ManagerReviewStatus;
  refusal_reason: string | null;
}

const toReviewedBookingPet = (row: ReviewedBookingPetRow): ReviewedBookingPet => ({
  bookingId: row.booking_id,
  ownerId: row.owner_id,
  subject: {
    petNames: [row.pet_name],
    dropOffTime: row.drop_off_time,
    pickUpTime: row.pick_up_time,
  },
  previousStatus: row.manager_review_status,
  previousRefusalReason: row.refusal_reason,
});

/**
 * Locks the booking pet, applies the decision and writes the notice the service composed from the
 * status it replaced. The lock means two managers pressing at once each see the other's result, so
 * the parent is told once per real change. A notice that cannot be written never undoes the
 * decision (see insertParentNoticeWithinTransaction). Returns false when no booking pet has this id.
 */
const applyReviewDecision = async (
  client: PoolClient,
  bookingPetsUuid: string,
  decision: ReviewDecision,
  composeNotice: DecisionNoticeComposer,
): Promise<boolean> => {
  const locked = await client.query<ReviewedBookingPetRow>(
    // LEFT: a pet whose profile the owner deleted keeps its stays, and a request of it that nobody
    // decided must still be refusable; the notice uses the name it was booked under.
    `SELECT b.uuid::text AS booking_id,
            b.pet_owners_uuid::text AS owner_id,
            COALESCE(p.name, bp.pet_name) AS pet_name,
            bp.drop_off_time,
            bp.pick_up_time,
            bp.manager_review_status,
            bp.refusal_reason
     FROM booking_pets bp
     JOIN bookings b ON b.uuid = bp.bookings_uuid
     LEFT JOIN pets p ON p.uuid = bp.pet_uuid
     WHERE bp.uuid = $1::uuid
     FOR UPDATE OF bp`,
    [bookingPetsUuid],
  );
  const row = locked.rows[0];
  if (!row) return false;

  await client.query(
    `UPDATE booking_pets
     SET manager_review_status = $2::varchar, refusal_reason = $3,
         approved_at = CASE
           WHEN $2::varchar <> 'approved' THEN NULL
           WHEN manager_review_status = 'approved' THEN approved_at
           ELSE CURRENT_TIMESTAMP
         END,
         reviewed_by_uuid = $4::uuid
     WHERE uuid = $1::uuid`,
    [bookingPetsUuid, decision.status, decision.refusalReason, decision.reviewerId],
  );

  const notice = composeNotice(toReviewedBookingPet(row));
  if (notice) {
    await insertParentNoticeWithinTransaction(client, notice);
  }
  return true;
};

/**
 * Runs the decision inside `client`'s transaction when one is given (a booking made with a saved
 * card also moves its hold in that transaction), or in a transaction of its own.
 */
const recordReviewDecision = (
  bookingPetsUuid: string,
  decision: ReviewDecision,
  composeNotice: DecisionNoticeComposer,
  client?: PoolClient,
): Promise<boolean> =>
  client
    ? applyReviewDecision(client, bookingPetsUuid, decision, composeNotice)
    : withDatabaseTransaction<boolean>(async (ownClient) => {
        const found = await applyReviewDecision(
          ownClient,
          bookingPetsUuid,
          decision,
          composeNotice,
        );
        return { transaction: found ? 'commit' : 'rollback', value: found };
      });

// Approving clears any previous refusal reason. Otherwise a booking that was
// refused and later re-approved would still show a stale reason on the detail page.
// `reviewerId` is the manager who approved; the parent and other managers see their name.
export const approveBookingPet = (
  bookingPetsUuid: string,
  reviewerId: string,
  composeNotice: DecisionNoticeComposer,
  client?: PoolClient,
): Promise<boolean> =>
  recordReviewDecision(
    bookingPetsUuid,
    { status: 'approved', refusalReason: null, reviewerId },
    composeNotice,
    client,
  );

// Returns false (rather than throwing) when no row matches, so the caller
// (service layer) can turn that into a 404 instead of a generic 500.
export const refuseBookingPet = (
  bookingPetsUuid: string,
  /** Null when no manager decided: the request ran out of its review window. */
  reviewerId: string | null,
  reason: string,
  composeNotice: DecisionNoticeComposer,
  client?: PoolClient,
): Promise<boolean> =>
  recordReviewDecision(
    bookingPetsUuid,
    { status: 'refused', refusalReason: reason, reviewerId },
    composeNotice,
    client,
  );

// Reverts a manager's approve/refuse decision back to pending so it reappears
// in the Booking tab. It also clears refusal_reason and the reviewer since they no longer apply.
export const resetBookingPetReview = (
  bookingPetsUuid: string,
  composeNotice: DecisionNoticeComposer,
  client?: PoolClient,
): Promise<boolean> =>
  recordReviewDecision(
    bookingPetsUuid,
    { status: 'pending', refusalReason: null, reviewerId: null },
    composeNotice,
    client,
  );
