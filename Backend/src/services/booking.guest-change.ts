import type { PoolClient } from 'pg';
import { AppError } from '../common/middlewares/error.middleware.js';
import {
  CANCELLATION_FEE_CHANGED,
  type CancellationPreview,
  type CancellationResult,
  type CancelStayInput,
  type GuestCancellationRule,
} from '../contracts/booking.change.contract.js';
import {
  cancelActivePets,
  isActivePet,
  settlePayment,
  withLockedBooking,
  type GuaranteePayment,
  type LockedBooking,
  type PetAtTheDesk,
} from '../repositories/booking.check-in.repository.js';
import { decideCancellation, feeScheduleFor } from './booking.fee-policy.js';
import {
  bookingNotFound,
  capToLiveHold,
  openGuaranteeOf,
  processorFor,
  releaseGuarantee,
  withProcessor,
  type GuaranteeDependencies,
} from './booking.guarantee.js';
import { notifyCancelledByParent } from './booking.in-stay.notifications.js';
import { isChargedUnsettled, settleCharged } from './booking.settlement.js';
import { readTeamContact } from './concierge/concierge.status.js';
import type { CardProcessor } from './payments/card-processor.js';
import { toConfirmationNumber } from './petparent.booking.js';
import { deleteTasksForBookingPet } from './task.fromBooking.service.js';

/**
 * A guest cancelling their own stay in My stays, before drop-off (booking.fee-policy.ts has the
 * rules: free 7 days or more ahead or inside the grace and cooling-off windows, one night per
 * confirmed pet from 72 hours to 7 days, half of each confirmed pet's stay after that). A stay
 * already charged (paid at request) is refunded all but the fee. Otherwise the fee is taken from
 * the hold and the rest released, or charged to the saved card when there is no hold yet; a
 * declined card cancels nothing. Moving the stay instead is booking.guest-reschedule.ts.
 */

export type ChangeDependencies = GuaranteeDependencies;

const GUEST_CANCELLATION_REASON = 'Cancelled by the guest';

export interface ChangeableStay {
  payment: GuaranteePayment;
  /** Pets still on the booking, each with its dates. */
  pets: (PetAtTheDesk & { dropOffAt: Date; pickUpAt: Date })[];
  dropOffAt: Date;
}

export const stayStarted = (): AppError =>
  new AppError(
    'This stay has started, so it cannot be changed online. Please contact our team.',
    'BOOKING_STARTED',
    409,
  );

const toCents = (amount: number): number => Math.round(amount * 100);

/**
 * The button must charge what it said. When the guest previewed an amount and it has since moved
 * (a fee tier passed while the dialog was open), nothing is charged: the new amount goes back in
 * the error for a second look.
 */
export const assertPreviewedAmount = (
  expected: number | undefined,
  actual: number,
  code: string,
  message: string,
): void => {
  if (expected === undefined || toCents(expected) === toCents(actual)) return;
  throw new AppError(message, code, 409, [{ amount: actual }]);
};

/**
 * A stay that can still change: made with a saved card, not settled, nobody arrived yet; and the
 * guest's own when `ownerId` is given (staff pass null).
 */
export const changeableStay = (booking: LockedBooking, ownerId: string | null): ChangeableStay => {
  if (ownerId !== null && booking.ownerId !== ownerId) throw bookingNotFound();
  const payment = openGuaranteeOf(booking);
  const onBooking = booking.pets.filter((pet) => isActivePet(pet.reviewStatus));
  if (onBooking.length === 0) {
    throw new AppError('This stay was cancelled.', 'BOOKING_NOT_ACTIVE', 409);
  }
  const pets = onBooking.flatMap((pet) =>
    pet.dropOffAt && pet.pickUpAt && pet.outcome === null
      ? [{ ...pet, dropOffAt: pet.dropOffAt, pickUpAt: pet.pickUpAt }]
      : [],
  );
  if (pets.length < onBooking.length) throw stayStarted();
  const dropOffAt = new Date(Math.min(...pets.map((pet) => pet.dropOffAt.getTime())));
  return { payment, pets, dropOffAt };
};

// ----- Cancelling --------------------------------------------------------------------------------

const guestCancellation = (
  booking: LockedBooking,
  stay: ChangeableStay,
  now: Date,
): { fee: number; rule: GuestCancellationRule } => {
  if (now.getTime() >= stay.dropOffAt.getTime()) throw stayStarted();
  const approved = stay.pets.filter((pet) => pet.reviewStatus === 'approved');
  const decisions = approved.map((pet) =>
    decideCancellation({
      bookedAt: booking.bookedAt,
      approvedAt: pet.approvedAt,
      dropOffAt: pet.dropOffAt,
      total: pet.price,
      nightlyRate: pet.nightlyRate,
      now,
      schedule: feeScheduleFor(booking.termsVersion),
    }),
  );
  let cents = 0;
  let rule: GuestCancellationRule = 'pending_request';
  for (const decision of decisions) {
    if (!decision.allowed || decision.rule === 'exception') throw stayStarted();
    cents += Math.round(decision.fee * 100);
    rule = decision.rule;
  }
  const fee = capToLiveHold(cents / 100, stay.payment);
  // A charged cancellation is named by its tier, so the guest reads why it costs what it does.
  return { fee, rule: fee > 0 && rule !== 'short_notice' ? 'late' : rule };
};

/** The cancellation fee: from the hold when there is one, else charged to the saved card now. */
const chargeLateFee = async (
  bookingId: string,
  payment: GuaranteePayment,
  fee: number,
  cards: CardProcessor,
  client: PoolClient,
): Promise<void> => {
  const key = `cancel-fee-${bookingId}`;
  if (payment.status === 'authorized' && payment.paymentIntentId) {
    const intent = payment.paymentIntentId;
    await withProcessor(() => cards.captureHold(intent, fee, key));
    await settlePayment(client, payment.paymentId, { status: 'succeeded', capturedAmount: fee });
    return;
  }
  const charge = await withProcessor(() =>
    cards.chargeNow({
      paymentMethodId: payment.paymentMethodId,
      amount: fee,
      reference: toConfirmationNumber(bookingId),
      idempotencyKey: key,
    }),
  );
  if (charge.status !== 'succeeded') {
    throw new AppError(
      'Your card was declined for the cancellation fee, so the stay is not cancelled. Please contact our team.',
      'CARD_DECLINED',
      402,
    );
  }
  await settlePayment(client, payment.paymentId, {
    status: 'succeeded',
    capturedAmount: fee,
    paymentIntentId: charge.paymentIntentId,
  });
};

export const previewCancellation = async (
  ownerId: string,
  bookingId: string,
  dependencies: ChangeDependencies = {},
): Promise<CancellationPreview> => {
  const now = dependencies.now ?? new Date();
  const preview = await withLockedBooking(bookingId, async (booking) => {
    const stay = changeableStay(booking, ownerId);
    const { fee, rule } = guestCancellation(booking, stay, now);
    return { fee, rule, total: stay.payment.amount, contact: readTeamContact() };
  });
  if (!preview) throw bookingNotFound();
  return preview;
};

export const cancelByGuest = async (
  ownerId: string,
  bookingId: string,
  input: CancelStayInput = {},
  dependencies: ChangeDependencies = {},
): Promise<CancellationResult> => {
  const now = dependencies.now ?? new Date();
  const done = await withLockedBooking(bookingId, async (booking, client) => {
    const stay = changeableStay(booking, ownerId);
    const { fee } = guestCancellation(booking, stay, now);
    assertPreviewedAmount(
      input.expectedFee,
      fee,
      CANCELLATION_FEE_CHANGED,
      'The cancellation fee has changed since you checked it. Please look at the new fee and confirm again.',
    );
    if (isChargedUnsettled(stay.payment)) {
      await settleCharged(stay.payment, fee, 'cancel', client, dependencies.cardProcessor);
    } else if (fee === 0) {
      await releaseGuarantee(stay.payment, client, dependencies.cardProcessor);
    } else {
      const cards = processorFor(stay.payment, dependencies.cardProcessor);
      await chargeLateFee(bookingId, stay.payment, fee, cards, client);
    }
    const cancelled = await cancelActivePets(client, bookingId, GUEST_CANCELLATION_REASON);
    return { fee, cancelled };
  });
  if (!done) throw bookingNotFound();
  for (const bookingPetsUuid of done.cancelled) await deleteTasksForBookingPet(bookingPetsUuid);
  void notifyCancelledByParent(bookingId, done.fee);
  return { fee: done.fee };
};
