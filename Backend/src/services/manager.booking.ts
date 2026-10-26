import type { PoolClient } from 'pg';
import { pool } from '../config/database.js';
import {
  formatNewZealandDay,
  newZealandDateOf,
  newZealandWallClockToDate,
} from '../common/utils/new-zealand-time.js';
import type { NewDates, RescheduleResult } from '../contracts/booking.change.contract.js';
import { BOOKING_MOVED_BY_STAFF } from '../contracts/booking.notification.contract.js';
import {
  insertManagerNotice,
  type ParentNoticeDraft,
} from '../repositories/booking.notification.repository.js';
import * as managerBookingRepository from '../repositories/manager.booking.repository.js';
import type { ManagerBookingRecord } from '../repositories/manager.booking.repository.js';
import * as bookingReviewRepository from '../repositories/manager.booking.review.repository.js';
import {
  findBookingIdOfPet,
  isActivePet,
  withLockedBooking,
  type LockedBooking,
  type PetAtTheDesk,
} from '../repositories/booking.check-in.repository.js';
import { AppError } from '../common/middlewares/error.middleware.js';
import {
  releaseGuarantee,
  releaseHoldForNewTotal,
  type GuaranteeDependencies,
} from './booking.guarantee.js';
import { assertRoomForStay } from './booking.capacity.js';
import { rescheduleAsException } from './booking.guest-reschedule.js';
import { chargeWhenDecided, isChargedUnsettled, refundChargedPet } from './booking.settlement.js';
import { postBookingNoticeToChat } from './booking.chat-notices.js';
import { sendBookingNoticeEmail } from './booking.transaction-emails.js';
import { toConfirmationNumber } from './petparent.booking.js';
import { getCardProcessor } from './payments/card-processor.factory.js';
import { createTasksForBookingPet, deleteTasksForBookingPet } from './task.fromBooking.service.js';
import {
  composeApprovedNotice,
  composeBackInReviewNotice,
  composeRefusedNotice,
} from './booking.notifications.js';

const notFound = (): AppError => new AppError('Booking not found', 'NOT_FOUND', 404);

/** Whether Stripe runs on test keys is the one thing SQL cannot know; the fake is always a test. */
export const getAllBookings = (): Promise<ManagerBookingRecord[]> => {
  const processor = getCardProcessor();
  return managerBookingRepository.listAllBookings({
    stripeTestMode: processor?.name === 'stripe' && processor.testMode,
  });
};

/**
 * A manager's decision on one pet of a request. The decision, the parent's notice and any change
 * to the card hold happen in one transaction with the booking's payment locked, so a decision
 * never leaves the hold out of step with the pets Wagstay agreed to.
 */
interface ReviewChange {
  bookingPetsUuid: string;
  /** Applies the decision in `client`'s transaction; false when the booking pet is gone. */
  apply: (client: PoolClient) => Promise<boolean>;
  /** What else the decision does to the hold, given the pet as it stood before the decision. */
  afterDecision: (booking: LockedBooking, pet: PetAtTheDesk, client: PoolClient) => Promise<void>;
  /** Whether the pet holds a place afterwards (pending or approved), so it counts against capacity. */
  keepsPlace: boolean;
}

const settledError = (): AppError =>
  new AppError(
    'This booking is settled: its card hold was released or charged. The guest needs to book again.',
    'BOOKING_SETTLED',
    409,
  );

const arrivedError = (): AppError =>
  new AppError(
    'This pet has arrived. Record "We can\'t take this pet" at the desk instead.',
    'BOOKING_ALREADY_ARRIVED',
    409,
  );

/** The booking's pets with one pet's new decision applied, for working out what is now owed. */
const withDecision = (
  booking: LockedBooking,
  bookingPetsUuid: string,
  reviewStatus: string,
): PetAtTheDesk[] =>
  booking.pets.map((pet) =>
    pet.bookingPetsUuid === bookingPetsUuid ? { ...pet, reviewStatus } : pet,
  );

const alreadyPaidError = (): AppError =>
  new AppError(
    'This stay is already paid. Use "Cancel without a fee" to give the money back instead.',
    'BOOKING_ALREADY_PAID',
    409,
  );

/**
 * A refused or cancelled pet no longer counts against capacity, and its place may have been taken
 * since. Taking it back (approve, or undo to pending) needs its nights to have room again; this
 * runs under the capacity lock, inside the decision's transaction.
 */
const assertRoomForReturningPet = async (pet: PetAtTheDesk, client: PoolClient): Promise<void> => {
  if (!pet.dropOffAt || !pet.pickUpAt) return;
  await assertRoomForStay(client, {
    startDate: newZealandDateOf(pet.dropOffAt),
    endDate: newZealandDateOf(pet.pickUpAt),
    petCount: 1,
  });
};

const recordReviewChange = async (change: ReviewChange): Promise<void> => {
  const bookingId = await findBookingIdOfPet(change.bookingPetsUuid);
  if (!bookingId) throw notFound();
  const done = await withLockedBooking(bookingId, async (booking, client) => {
    if (booking.payment && booking.payment.capturedAmount !== null) throw settledError();
    const pet = booking.pets.find(
      (candidate) => candidate.bookingPetsUuid === change.bookingPetsUuid,
    );
    if (!pet) throw notFound();
    if (pet.outcome) throw arrivedError();
    if (change.keepsPlace && !isActivePet(pet.reviewStatus)) {
      await assertRoomForReturningPet(pet, client);
    }
    if (!(await change.apply(client))) throw notFound();
    await change.afterDecision(booking, pet, client);
    return true;
  });
  if (!done) throw notFound();
};

/**
 * Approving agrees to the stay: the 48-hour job will hold its price with the others Wagstay
 * agreed to. If the card already holds an earlier total, that hold is released so the job holds
 * the new one. Approving also hands the pet's care to staff, so its Task Timeline is filled now.
 */
export const approveBooking = async (
  bookingPetsUuid: string,
  reviewerId: string,
  dependencies: GuaranteeDependencies = {},
): Promise<void> => {
  let emailNotice: ParentNoticeDraft | null = null;
  await recordReviewChange({
    bookingPetsUuid,
    keepsPlace: true,
    apply: (client) =>
      bookingReviewRepository.approveBookingPet(
        bookingPetsUuid,
        reviewerId,
        (reviewed) => {
          emailNotice = composeApprovedNotice(reviewed);
          return emailNotice;
        },
        client,
      ),
    afterDecision: async (booking, pet, client) => {
      if (pet.reviewStatus === 'approved') return;
      if (booking.paysAtRequest) {
        // Paid at request: once nobody waits, the confirmed pets are charged from the hold.
        const pets = withDecision(booking, bookingPetsUuid, 'approved');
        await chargeWhenDecided(booking, pets, client, dependencies.cardProcessor);
        return;
      }
      await releaseHoldForNewTotal(
        booking.bookingId,
        booking.payment,
        client,
        dependencies.cardProcessor,
      );
    },
  });
  void sendBookingNoticeEmail(emailNotice);
  void postBookingNoticeToChat(emailNotice);
  await createTasksForBookingPet(bookingPetsUuid);
};

/**
 * Wagstay cannot take this pet. Refusing the last pet still on the booking releases the card in
 * full, so a refusal never leaves money held; refusing one of several approved pets releases the
 * hold so the job holds the smaller total. A pet that has arrived is recorded at the desk instead.
 * `reason` is already validated non-empty by the controller's zod schema.
 */
export const refuseBooking = async (
  bookingPetsUuid: string,
  reviewerId: string,
  reason: string,
  dependencies: GuaranteeDependencies = {},
): Promise<void> => {
  let emailNotice: ParentNoticeDraft | null = null;
  await recordReviewChange({
    bookingPetsUuid,
    keepsPlace: false,
    apply: (client) =>
      bookingReviewRepository.refuseBookingPet(
        bookingPetsUuid,
        reviewerId,
        reason,
        (reviewed) => {
          emailNotice = composeRefusedNotice(reason)(reviewed);
          return emailNotice;
        },
        client,
      ),
    afterDecision: async (booking, pet, client) => {
      const stillOnBooking = booking.pets.some(
        (candidate) =>
          candidate.bookingPetsUuid !== bookingPetsUuid && isActivePet(candidate.reviewStatus),
      );
      const { payment } = booking;
      if (booking.paysAtRequest && payment) {
        // A pet already charged gets its price back; otherwise the hold is settled once nobody
        // waits, charging only the pets still confirmed.
        if (isChargedUnsettled(payment)) {
          if (pet.reviewStatus !== 'approved') return;
          await refundChargedPet(payment, pet, stillOnBooking, client, dependencies.cardProcessor);
          return;
        }
        const pets = withDecision(booking, bookingPetsUuid, 'refused');
        await chargeWhenDecided(booking, pets, client, dependencies.cardProcessor);
        return;
      }
      if (!stillOnBooking) {
        await releaseGuarantee(booking.payment, client, dependencies.cardProcessor);
      } else if (pet.reviewStatus === 'approved') {
        await releaseHoldForNewTotal(
          booking.bookingId,
          booking.payment,
          client,
          dependencies.cardProcessor,
        );
      }
    },
  });
  void sendBookingNoticeEmail(emailNotice);
  void postBookingNoticeToChat(emailNotice);
  // A refused pet is not staying, so any care plan made when it was approved goes too.
  await deleteTasksForBookingPet(bookingPetsUuid);
};

const dayOf = (isoDate: string): string =>
  formatNewZealandDay(newZealandWallClockToDate(isoDate, '12:00'));

/**
 * Moves a stay for an emergency, a MetService red warning or a pet a vet says is too unwell: no
 * charge, and the guest keeps their free change. The reason has no column of its own, so it is
 * kept as a notice for every manager. The move stands even if that notice cannot be written.
 */
export const rescheduleForException = async (
  bookingId: string,
  dates: NewDates,
  reason: string,
  dependencies: GuaranteeDependencies = {},
): Promise<RescheduleResult> => {
  const moved = await rescheduleAsException(bookingId, dates, dependencies);
  const summary = `${toConfirmationNumber(bookingId)} moved to ${dayOf(dates.startDate)} (pick-up ${dayOf(dates.endDate)}) without a charge. Reason: ${reason}`;
  await insertManagerNotice(pool, {
    bookingId,
    setting: BOOKING_MOVED_BY_STAFF,
    summary,
  }).catch((error: unknown) => {
    console.error('Could not keep the reason for a stay moved by staff', {
      name: error instanceof Error ? error.name : 'unknown',
    });
  });
  return moved;
};

/**
 * Puts a decision back to pending. Not once the booking is settled (its hold was released or
 * charged; the guest would need to book again), nor once the pet has arrived. An approved pet
 * going back to review is no longer held: the hold is released for the job to hold the rest.
 */
export const undoBookingReview = async (
  bookingPetsUuid: string,
  dependencies: GuaranteeDependencies = {},
): Promise<void> => {
  await recordReviewChange({
    bookingPetsUuid,
    keepsPlace: true,
    apply: (client) =>
      bookingReviewRepository.resetBookingPetReview(
        bookingPetsUuid,
        composeBackInReviewNotice,
        client,
      ),
    afterDecision: async (booking, pet, client) => {
      if (booking.paysAtRequest) {
        // A charged stay is not sent back to review: that would leave money taken for a request.
        if (booking.payment && isChargedUnsettled(booking.payment)) throw alreadyPaidError();
        // While the hold stands, the pet simply waits again; nothing is charged until all decide.
        return;
      }
      if (pet.reviewStatus !== 'approved') return;
      await releaseHoldForNewTotal(
        booking.bookingId,
        booking.payment,
        client,
        dependencies.cardProcessor,
      );
    },
  });
  await deleteTasksForBookingPet(bookingPetsUuid);
};
