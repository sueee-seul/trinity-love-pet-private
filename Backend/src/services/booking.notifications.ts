import type { ParentBookingNotificationKind } from '../contracts/booking.notification.contract.js';
import {
  findBookingRequestSubject,
  recordManagerRequestNotices,
  recordParentNotice,
  type ParentNoticeDraft,
} from '../repositories/booking.notification.repository.js';
import type {
  DecisionNoticeComposer,
  ReviewedBookingPet,
} from '../repositories/manager.booking.review.repository.js';
import {
  approvedBody,
  backInReviewBody,
  datesChangedBody,
  managerDatesChangedBody,
  managerRequestBody,
  refusedBody,
  requestReceivedBody,
  type PlacedPet,
} from './booking.notification.messages.js';
import { postBookingNoticeToChat } from './booking.chat-notices.js';
import { sendBookingNoticeEmail } from './booking.transaction-emails.js';
import { toConfirmationNumber } from './petparent.booking.js';

// When a parent and the managers are told about a booking request, and what each notice says.
// A notice is a courtesy on top of the event: a failure to write one is logged and never undoes
// or blocks the request or the decision it describes.

const logNoticeFailure = (event: string, bookingId: string, error: unknown): void => {
  // Ids and the error name only: the notice text holds pet names and a refusal reason.
  console.error('[notifications] booking notice was not written', {
    event,
    bookingId,
    error: error instanceof Error ? error.name : 'unknown',
  });
};

const recordSafely = async (
  event: string,
  bookingId: string,
  write: () => Promise<unknown>,
): Promise<void> => {
  try {
    await write();
  } catch (error: unknown) {
    logNoticeFailure(event, bookingId, error);
  }
};

/**
 * Tells the parent their request arrived and waits for our manager, and tells every manager there
 * is a request to decide. Called right after checkout has saved the booking, with the pets in
 * quote order. Never throws, so a guest whose request was saved always gets their receipt, which
 * carries a copy of the terms they agreed to.
 */
export const notifyBookingPlaced = async (
  bookingId: string,
  pets: readonly PlacedPet[],
): Promise<void> => {
  let found: Awaited<ReturnType<typeof findBookingRequestSubject>>;
  try {
    found = await findBookingRequestSubject(bookingId);
  } catch (error: unknown) {
    logNoticeFailure('booking_request', bookingId, error);
    return;
  }
  if (!found) {
    logNoticeFailure('booking_request', bookingId, new Error('BookingNotFound'));
    return;
  }

  // The names in quote order, as the guest listed them; the saved rows share one insert time.
  const subject = { ...found, petNames: pets.map((pet) => pet.name) };
  const reference = toConfirmationNumber(bookingId);
  const parentNotice: ParentNoticeDraft = {
    ownerId: subject.ownerId,
    bookingId,
    kind: 'booking_request_received',
    body: requestReceivedBody(subject, reference),
  };
  await recordSafely(parentNotice.kind, bookingId, () => recordParentNotice(parentNotice));
  await recordSafely('booking_request_created', bookingId, () =>
    recordManagerRequestNotices({
      bookingId,
      body: managerRequestBody(subject, reference, pets),
    }),
  );
  void sendBookingNoticeEmail({ ...parentNotice, withAgreedTerms: true });
  void postBookingNoticeToChat(parentNotice);
};

/**
 * After a guest moved their own stay under older terms: every moved pet waits for review again, so
 * the managers are told it needs a decision, and the parent that nothing is held until then (in the bell, and by
 * email when SES is set up). Called after the move has committed; never throws.
 */
export const notifyBookingDatesChanged = async (bookingId: string): Promise<void> => {
  let subject: Awaited<ReturnType<typeof findBookingRequestSubject>>;
  try {
    subject = await findBookingRequestSubject(bookingId);
  } catch (error: unknown) {
    logNoticeFailure('booking_dates_changed', bookingId, error);
    return;
  }
  if (!subject) {
    logNoticeFailure('booking_dates_changed', bookingId, new Error('BookingNotFound'));
    return;
  }

  const reference = toConfirmationNumber(bookingId);
  const parentNotice: ParentNoticeDraft = {
    ownerId: subject.ownerId,
    bookingId,
    kind: 'booking_back_in_review',
    body: datesChangedBody(subject),
  };
  await recordSafely('booking_back_in_review', bookingId, () => recordParentNotice(parentNotice));
  await recordSafely('booking_request_created', bookingId, () =>
    recordManagerRequestNotices({ bookingId, body: managerDatesChangedBody(subject, reference) }),
  );
  void sendBookingNoticeEmail(parentNotice);
};

const decisionNotice = (
  reviewed: ReviewedBookingPet,
  kind: ParentBookingNotificationKind,
  body: string,
): ParentNoticeDraft => ({ ownerId: reviewed.ownerId, bookingId: reviewed.bookingId, kind, body });

/** Approving a pet that is already approved tells the parent nothing new. */
export const composeApprovedNotice: DecisionNoticeComposer = (reviewed) =>
  reviewed.previousStatus === 'approved'
    ? null
    : decisionNotice(reviewed, 'booking_approved', approvedBody(reviewed.subject));

/** A refusal is news, and so is a changed reason; the same refusal saved twice is not. */
export const composeRefusedNotice =
  (refusalReason: string): DecisionNoticeComposer =>
  (reviewed) =>
    reviewed.previousStatus === 'refused' &&
    reviewed.previousRefusalReason?.trim() === refusalReason.trim()
      ? null
      : decisionNotice(reviewed, 'booking_refused', refusedBody(reviewed.subject, refusalReason));

/** Undo is news only when there was something to undo: a request still waiting has not moved. */
export const composeBackInReviewNotice: DecisionNoticeComposer = (reviewed) =>
  reviewed.previousStatus === 'pending'
    ? null
    : decisionNotice(reviewed, 'booking_back_in_review', backInReviewBody(reviewed.subject));
