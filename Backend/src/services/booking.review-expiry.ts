import { formatNewZealandDay, formatNewZealandTime } from '../common/utils/new-zealand-time.js';
import { BOOKING_REVIEW_DUE } from '../contracts/booking.notification.contract.js';
import {
  withLockedBooking,
  type PetAtTheDesk,
} from '../repositories/booking.check-in.repository.js';
import {
  insertManagerFlag,
  type ParentNoticeDraft,
} from '../repositories/booking.notification.repository.js';
import {
  findUnchargedDecidedRequests,
  findWaitingRequests,
  type WaitingRequest,
} from '../repositories/booking.review-expiry.repository.js';
import { refuseBookingPet } from '../repositories/manager.booking.review.repository.js';
import { pool } from '../config/database.js';
import { BOOKING_POLICY } from './booking.fee-policy.js';
import { composeRefusedNotice } from './booking.notifications.js';
import { chargeWhenDecided } from './booking.settlement.js';
import { postBookingNoticeToChat } from './booking.chat-notices.js';
import { sendBookingNoticeEmail } from './booking.transaction-emails.js';
import type { CardProcessor } from './payments/card-processor.js';
import { toConfirmationNumber } from './petparent.booking.js';

/**
 * The review window for pay-at-request bookings, run by the booking job every 15 minutes:
 *
 * 1. Four hours before a request's deadline, every manager gets one "Decision due soon" flag.
 * 2. At the deadline (24 hours after the request, or drop-off if sooner; for a booking made before
 *    pay at request, its drop-off) each pet still waiting is refused with no reviewer, the parent
 *    is told, and the booking settles: the pets already confirmed are charged and the rest of the
 *    hold is released, so an undecided request never keeps a room or the guest's money. An older
 *    booking has no hold for a waiting pet, so nothing moves on its card.
 * 3. A decided request whose hold was never charged (the processor could not be reached at the
 *    time) is charged now.
 *
 * Each step changes only the state it expects, so running twice does nothing more. A processor
 * that cannot be reached leaves the booking for the next run.
 */

export const EXPIRED_REVIEW_REASON =
  'Our manager could not check this request in time, so it was not accepted and nothing was charged for it.';

export interface ReviewExpiryContext {
  cardProcessor: CardProcessor | null;
  now: Date;
  log: (message: string) => void;
}

export interface ReviewExpirySummary {
  /** Requests within 4 hours of their deadline; a flag already raised is not raised again. */
  dueSoon: number;
  expired: number;
  charged: number;
  retryLater: number;
}

const reminderSummary = (request: WaitingRequest): string =>
  `Decision due by ${formatNewZealandTime(request.deadline)} ${formatNewZealandDay(
    request.deadline,
  )}: ${request.petNames.join(', ')} (${toConfirmationNumber(
    request.bookingId,
  )}). After that the request is released and nothing is charged for it.`;

/** Refuses every pet still waiting and settles the booking, all in one locked transaction. */
const expireRequest = async (
  bookingId: string,
  cards: CardProcessor | null,
): Promise<ParentNoticeDraft[]> => {
  const notices: ParentNoticeDraft[] = [];
  await withLockedBooking(bookingId, async (booking, client) => {
    const waiting = booking.pets.filter((pet) => pet.reviewStatus === 'pending');
    if (waiting.length === 0) return;
    for (const pet of waiting) {
      await refuseBookingPet(
        pet.bookingPetsUuid,
        null,
        EXPIRED_REVIEW_REASON,
        (reviewed) => {
          const notice = composeRefusedNotice(EXPIRED_REVIEW_REASON)(reviewed);
          if (notice) notices.push(notice);
          return notice;
        },
        client,
      );
    }
    const decided: PetAtTheDesk[] = booking.pets.map((pet) =>
      pet.reviewStatus === 'pending' ? { ...pet, reviewStatus: 'refused' } : pet,
    );
    await chargeWhenDecided(booking, decided, client, cards);
  });
  return notices;
};

const chargeDecidedRequest = async (
  bookingId: string,
  cards: CardProcessor | null,
): Promise<boolean> => {
  const outcome = await withLockedBooking(bookingId, (booking, client) =>
    chargeWhenDecided(booking, booking.pets, client, cards),
  );
  return outcome === 'charged' || outcome === 'released';
};

export const runReviewExpiryPass = async (
  context: ReviewExpiryContext,
): Promise<ReviewExpirySummary> => {
  const summary: ReviewExpirySummary = { dueSoon: 0, expired: 0, charged: 0, retryLater: 0 };
  const waiting = await findWaitingRequests(
    context.now,
    BOOKING_POLICY.reviewWindowHours,
    BOOKING_POLICY.reviewReminderHours,
  );
  for (const request of waiting) {
    try {
      if (request.deadline.getTime() <= context.now.getTime()) {
        const notices = await expireRequest(request.bookingId, context.cardProcessor);
        for (const notice of notices) {
          void sendBookingNoticeEmail(notice);
          void postBookingNoticeToChat(notice);
        }
        summary.expired += 1;
      } else {
        await insertManagerFlag(pool, {
          bookingId: request.bookingId,
          setting: BOOKING_REVIEW_DUE,
          summary: reminderSummary(request),
        });
        summary.dueSoon += 1;
      }
    } catch (error: unknown) {
      summary.retryLater += 1;
      context.log(
        `Review job left ${toConfirmationNumber(request.bookingId)} for the next run (${
          error instanceof Error ? error.name : 'unknown'
        })`,
      );
    }
  }
  for (const bookingId of await findUnchargedDecidedRequests()) {
    try {
      if (await chargeDecidedRequest(bookingId, context.cardProcessor)) summary.charged += 1;
    } catch (error: unknown) {
      summary.retryLater += 1;
      context.log(
        `Review job could not charge ${toConfirmationNumber(bookingId)} yet (${
          error instanceof Error ? error.name : 'unknown'
        })`,
      );
    }
  }
  return summary;
};
