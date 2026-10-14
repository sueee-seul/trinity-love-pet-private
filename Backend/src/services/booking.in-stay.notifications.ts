import { receiptLines } from '../config/business-identity.js';
import { BOOKING_CHANGED_BY_GUEST } from '../contracts/booking.notification.contract.js';
import type {
  AddOnResult,
  ChangeTimesResult,
  ChargeSettlement,
  ExtensionResult,
} from '../contracts/booking.change.contract.js';
import { pool } from '../config/database.js';
import { readPetNamesForBooking } from '../repositories/booking.charges.repository.js';
import {
  findBookingRequestSubject,
  insertManagerNotice,
  recordParentNotice,
  type ParentNoticeDraft,
} from '../repositories/booking.notification.repository.js';
import {
  addOnBookedBody,
  cancelledByParentBody,
  formatNoticeMoney,
  managerInStayChangeBody,
  stayExtendedBody,
  timesChangedBody,
} from './booking.notification.messages.js';
import { sendBookingNoticeEmail } from './booking.transaction-emails.js';
import { toConfirmationNumber } from './petparent.booking.js';

/**
 * What the parent and the managers hear after a change to a stay under way. The parent's notice
 * doubles as the receipt: its email names the amount, the GST inside it and the supplier. An
 * amount added to the bill for the desk is not paid yet, so it carries no receipt lines. Like
 * every booking notice it is a courtesy on top of the change: a failure here is logged with ids
 * only and never undoes the charge or the new dates.
 */

const logFailure = (event: string, bookingId: string, error: unknown): void => {
  console.error('[notifications] in-stay change notice was not written', {
    event,
    bookingId,
    error: error instanceof Error ? error.name : 'unknown',
  });
};

interface InStayNotice {
  kind: ParentNoticeDraft['kind'];
  parentBody: string;
  managerChange: string;
  /** Positive for a charge, negative for a refund, absent when no money moved. */
  receiptAmount?: number;
}

const tell = async (bookingId: string, notice: InStayNotice): Promise<void> => {
  try {
    const subject = await findBookingRequestSubject(bookingId);
    if (!subject) throw new Error('BookingNotFound');
    const reference = toConfirmationNumber(bookingId);
    const draft: ParentNoticeDraft = {
      ownerId: subject.ownerId,
      bookingId,
      kind: notice.kind,
      body: notice.parentBody,
    };
    await recordParentNotice(draft);
    await insertManagerNotice(pool, {
      bookingId,
      setting: BOOKING_CHANGED_BY_GUEST,
      summary: managerInStayChangeBody(subject, reference, notice.managerChange),
    });
    const receipt =
      notice.receiptAmount === undefined
        ? ''
        : `\n\n${receiptLines(notice.receiptAmount, new Date())}`;
    void sendBookingNoticeEmail({ ...draft, body: `${notice.parentBody}${receipt}` });
  } catch (error: unknown) {
    logFailure(notice.kind, bookingId, error);
  }
};

/** The managers' words for the money: charged, or owed at the desk so staff collect it. */
const moneyLine = (amount: number, settlement: ChargeSettlement): string =>
  settlement === 'desk'
    ? `${formatNoticeMoney(amount)} to pay at check-out, no saved card`
    : `${formatNoticeMoney(amount)} charged`;

const receiptFor = (
  amount: number,
  settlement: ChargeSettlement,
): Pick<InStayNotice, 'receiptAmount'> => (settlement === 'card' ? { receiptAmount: amount } : {});

export const notifyStayExtended = async (
  bookingId: string,
  result: ExtensionResult,
): Promise<void> => {
  const subject = await findBookingRequestSubject(bookingId).catch(() => null);
  if (!subject) return logFailure('booking_extended', bookingId, new Error('BookingNotFound'));
  await tell(bookingId, {
    kind: 'booking_extended',
    parentBody: stayExtendedBody(
      subject,
      result.newEndDate,
      result.addedNights,
      result.amount,
      result.settlement,
    ),
    managerChange: `the parent extended the stay to ${result.newEndDate} (${result.addedNights} more night${result.addedNights === 1 ? '' : 's'}, ${moneyLine(result.amount, result.settlement)}). The care plan has the new days.`,
    ...receiptFor(result.amount, result.settlement),
  });
};

/** Fills the pet's name into the result, then tells both sides. */
export const notifyAddOnBooked = async (
  bookingId: string,
  result: AddOnResult,
): Promise<AddOnResult> => {
  const names = await readPetNamesForBooking(pool, bookingId).catch(
    () => new Map<string, string>(),
  );
  const petName = names.get(result.bookingPetId) ?? 'your pet';
  const named = { ...result, petName };
  await tell(bookingId, {
    kind: 'booking_add_on_booked',
    parentBody: addOnBookedBody(
      petName,
      result.serviceName,
      result.quantity,
      result.date,
      result.amount,
      result.settlement,
    ),
    managerChange: `the parent booked ${result.quantity} x ${result.serviceName} for ${petName} on ${result.date} (${moneyLine(result.amount, result.settlement)}). A task for that day is on the plan.`,
    ...receiptFor(result.amount, result.settlement),
  });
  return named;
};

export const notifyTimesChanged = async (
  bookingId: string,
  bookingPetId: string,
  result: ChangeTimesResult,
): Promise<void> => {
  const names = await readPetNamesForBooking(pool, bookingId).catch(
    () => new Map<string, string>(),
  );
  const petName = names.get(bookingPetId) ?? 'your pet';
  const dropOffAt = new Date(result.dropOffAt);
  const pickUpAt = new Date(result.pickUpAt);
  await tell(bookingId, {
    kind: 'booking_times_changed',
    parentBody: timesChangedBody(petName, dropOffAt, pickUpAt),
    managerChange: `the parent changed ${petName}'s times: check-in ${dropOffAt.toISOString()}, check-out ${pickUpAt.toISOString()}.`,
  });
};

/**
 * After the parent cancelled or withdrew in My Stays: a receipt for them and a line for the
 * managers, so a freed room and a refund are never a surprise to either side.
 */
export const notifyCancelledByParent = async (bookingId: string, fee: number): Promise<void> => {
  const subject = await findBookingRequestSubject(bookingId).catch(() => null);
  if (!subject) {
    return logFailure('booking_cancelled_by_parent', bookingId, new Error('BookingNotFound'));
  }
  const reference = toConfirmationNumber(bookingId);
  await tell(bookingId, {
    kind: 'booking_cancelled_by_parent',
    parentBody: cancelledByParentBody(subject, reference, fee),
    managerChange: `the parent cancelled the stay in My Stays${fee > 0 ? ` (${formatNoticeMoney(fee)} kept)` : ' (nothing kept)'}. The room is free again.`,
    ...(fee > 0 ? { receiptAmount: fee } : {}),
  });
};
