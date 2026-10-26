import { AppError } from '../common/middlewares/error.middleware.js';
import {
  ADD_ON_PRICE_CHANGED,
  EXTENSION_PRICE_CHANGED,
  type AddOnInput,
  type ChangeTimesInput,
  type ExtendStayInput,
  type ManagerStayChangeRequestView,
  type StayChangeRequestDetails,
  type StayChangeRequestView,
} from '../contracts/booking.change.contract.js';
import { BOOKING_CHANGE_REQUESTED } from '../contracts/booking.notification.contract.js';
import { pool } from '../config/database.js';
import { readPetNamesForBooking } from '../repositories/booking.charges.repository.js';
import {
  findBookingRequestSubject,
  insertManagerNotice,
  recordParentNotice,
  type ParentNoticeDraft,
} from '../repositories/booking.notification.repository.js';
import * as requests from '../repositories/stay-change-request.repository.js';
import { postBookingNoticeToChat } from './booking.chat-notices.js';
import { assertPreviewedAmount } from './booking.guest-change.js';
import { bookAddOn, listAddOns } from './booking.guest-addon.js';
import { extendStay, previewExtension } from './booking.guest-extend.js';
import { changeStayTimes } from './booking.guest-times.js';
import { bookingNotFound } from './booking.guarantee.js';
import {
  changeApprovedBody,
  changeRefusedBody,
  changeRequestedBody,
  managerChangeRequestBody,
  stayChangeSummary,
} from './booking.notification.messages.js';
import { fromCents, toCents } from './booking.in-stay.js';
import { scalesWithNights } from './booking.pricing.js';
import { toConfirmationNumber } from './petparent.booking.js';

/**
 * A change to a stay under way is a request (owner decision 2026-10-14). The parent asks in My
 * Stays or the chat: the change is checked and priced exactly as before (it must be possible now),
 * but nothing on the booking moves. A manager then approves it, which makes the change with the
 * same code the parent used to run directly (booking dates, bill, care tasks and receipts), or
 * refuses it with a reason. The parent hears each step in the bell and in the chat. Nothing is
 * paid online: any amount is added to the bill and paid at the desk at pick-up.
 */

const notFound = (): AppError =>
  new AppError('Change request not found', 'STAY_CHANGE_REQUEST_NOT_FOUND', 404);

const alreadyDecided = (): AppError =>
  new AppError(
    'This request was already decided or withdrawn.',
    'STAY_CHANGE_REQUEST_DECIDED',
    409,
  );

const toDetails = (row: requests.StayChangeRequestRow): StayChangeRequestDetails =>
  ({ ...row.details, kind: row.kind }) as StayChangeRequestDetails;

const amountOf = (row: requests.StayChangeRequestRow): number | null =>
  row.quoted_amount === null ? null : Number(row.quoted_amount);

/** The pets a request is about: its one pet, or every pet on the booking. */
const petNamesFor = async (bookingId: string, bookingPetId: string | null): Promise<string[]> => {
  const names = await readPetNamesForBooking(pool, bookingId);
  if (bookingPetId) return [names.get(bookingPetId) ?? 'your pet'];
  return [...names.values()];
};

const summaryOf = (row: requests.StayChangeRequestRow, petNames: readonly string[]): string =>
  stayChangeSummary(toDetails(row), petNames, amountOf(row));

const toView = (
  row: requests.StayChangeRequestRow,
  petNames: readonly string[],
): StayChangeRequestView => ({
  id: row.uuid,
  bookingId: row.bookings_uuid,
  bookingPetId: row.booking_pets_uuid,
  details: toDetails(row),
  quotedAmount: amountOf(row),
  status: row.status,
  refusalReason: row.refusal_reason,
  summary: summaryOf(row, petNames),
  createdAt: row.created_at.toISOString(),
  decidedAt: row.decided_at?.toISOString() ?? null,
});

const logFailure = (event: string, requestId: string, error: unknown): void => {
  // Ids and the error name only: the text holds pet names and a reason.
  console.error('[stay change request] notice was not written', {
    event,
    requestId,
    error: error instanceof Error ? error.name : 'unknown',
  });
};

/** How a request is announced; the chat skips its own copy when it writes the receipt itself. */
export interface RequestOptions {
  announceInChat?: boolean;
}

/** Tells the parent (bell and chat) and every manager that a request is waiting. Never throws. */
const announceRequest = async (
  row: requests.StayChangeRequestRow,
  summary: string,
  options: RequestOptions,
): Promise<void> => {
  const notice: ParentNoticeDraft = {
    ownerId: row.pet_owners_uuid,
    bookingId: row.bookings_uuid,
    kind: 'booking_change_requested',
    body: changeRequestedBody(summary),
  };
  try {
    await recordParentNotice(notice);
  } catch (error: unknown) {
    logFailure('booking_change_requested', row.uuid, error);
  }
  if (options.announceInChat !== false) void postBookingNoticeToChat(notice);
  try {
    const subject = await findBookingRequestSubject(row.bookings_uuid);
    await insertManagerNotice(pool, {
      bookingId: row.bookings_uuid,
      setting: BOOKING_CHANGE_REQUESTED,
      summary: managerChangeRequestBody(
        subject?.petNames ?? [],
        summary,
        toConfirmationNumber(row.bookings_uuid),
      ),
    });
  } catch (error: unknown) {
    logFailure(BOOKING_CHANGE_REQUESTED, row.uuid, error);
  }
};

const saveRequest = async (
  request: requests.NewStayChangeRequest,
  options: RequestOptions,
): Promise<StayChangeRequestView> => {
  const row = await requests.insertStayChangeRequest(request);
  const petNames = await petNamesFor(row.bookings_uuid, row.booking_pets_uuid);
  const view = toView(row, petNames);
  await announceRequest(row, view.summary, options);
  return view;
};

// ----- The parent asks ---------------------------------------------------------------------------

/** More nights: checked and priced now (room, at most 60 nights), made once a manager approves. */
export const requestExtension = async (
  ownerId: string,
  bookingId: string,
  input: ExtendStayInput,
  options: RequestOptions = {},
): Promise<StayChangeRequestView> => {
  const preview = await previewExtension(ownerId, bookingId, input.endDate);
  assertPreviewedAmount(
    input.expectedAmount,
    preview.amount,
    EXTENSION_PRICE_CHANGED,
    'The price of the extra nights has changed since you checked it. Please look at the new price and confirm again.',
  );
  return saveRequest(
    {
      bookingId,
      bookingPetId: null,
      ownerId,
      details: { kind: 'extend', endDate: preview.newEndDate },
      quotedAmount: preview.amount,
    },
    options,
  );
};

const notOffered = (): AppError =>
  new AppError('That add-on is not offered for this stay.', 'ADD_ON_NOT_OFFERED', 422);

/** An add-on for one day: checked and priced now, booked once a manager approves. */
export const requestAddOn = async (
  ownerId: string,
  bookingId: string,
  bookingPetId: string,
  input: AddOnInput,
  options: RequestOptions = {},
): Promise<StayChangeRequestView> => {
  if ((await requests.findBookingOwnerForPet(bookingId, bookingPetId)) !== ownerId) {
    throw bookingNotFound();
  }
  const catalogue = await listAddOns(ownerId, bookingId);
  const offer = catalogue.offers.find((candidate) => candidate.serviceId === input.serviceId);
  if (!offer || !catalogue.days.includes(input.date)) throw notOffered();
  // A per-stay service (grooming) happens once; the quantity only means something per day.
  const quantity = scalesWithNights(offer.priceUnit) ? input.quantity : 1;
  const amount = fromCents(toCents(offer.price) * quantity);
  assertPreviewedAmount(
    input.expectedAmount,
    amount,
    ADD_ON_PRICE_CHANGED,
    'The price of this add-on has changed since you saw it. Please look at the new price and confirm again.',
  );
  return saveRequest(
    {
      bookingId,
      bookingPetId,
      ownerId,
      details: {
        kind: 'add_on',
        serviceId: offer.serviceId,
        serviceName: offer.name,
        date: input.date,
        quantity,
      },
      quotedAmount: amount,
    },
    options,
  );
};

/** A new drop-off or pick-up time of day: free, and made once a manager approves. */
export const requestTimes = async (
  ownerId: string,
  bookingId: string,
  bookingPetId: string,
  input: ChangeTimesInput,
  options: RequestOptions = {},
): Promise<StayChangeRequestView> => {
  if ((await requests.findBookingOwnerForPet(bookingId, bookingPetId)) !== ownerId) {
    throw bookingNotFound();
  }
  return saveRequest(
    {
      bookingId,
      bookingPetId,
      ownerId,
      details: {
        kind: 'times',
        ...(input.dropOffTime !== undefined ? { dropOffTime: input.dropOffTime } : {}),
        ...(input.pickUpTime !== undefined ? { pickUpTime: input.pickUpTime } : {}),
      },
      quotedAmount: null,
    },
    options,
  );
};

/** The parent's own requests, newest first, for My Stays. */
export const listMyStayChangeRequests = async (
  ownerId: string,
): Promise<StayChangeRequestView[]> => {
  const rows = await requests.listOwnerStayChangeRequests(ownerId);
  const namesByBooking = new Map<string, Map<string, string>>();
  const views: StayChangeRequestView[] = [];
  for (const row of rows) {
    let names = namesByBooking.get(row.bookings_uuid);
    if (!names) {
      names = await readPetNamesForBooking(pool, row.bookings_uuid);
      namesByBooking.set(row.bookings_uuid, names);
    }
    const petNames = row.booking_pets_uuid
      ? [names.get(row.booking_pets_uuid) ?? 'your pet']
      : [...names.values()];
    views.push(toView(row, petNames));
  }
  return views;
};

/** The parent takes back a request our manager has not decided yet. */
export const withdrawStayChangeRequest = async (
  ownerId: string,
  requestId: string,
): Promise<void> => {
  const row = await requests.findStayChangeRequest(requestId);
  if (!row || row.pet_owners_uuid !== ownerId) throw notFound();
  if (
    !(await requests.decideStayChangeRequest(requestId, { status: 'cancelled', deciderId: null }))
  ) {
    throw alreadyDecided();
  }
};

// ----- The manager decides -----------------------------------------------------------------------

export const listStayChangeRequestsForManagers = async (
  onlyPending: boolean,
): Promise<ManagerStayChangeRequestView[]> => {
  const rows = await requests.listManagerStayChangeRequests(onlyPending);
  return rows.map((row) => ({
    ...toView(row, row.pet_names),
    reference: toConfirmationNumber(row.bookings_uuid),
    ownerName: row.owner_name,
    petNames: row.pet_names,
  }));
};

/** Makes the change the parent asked for, as the parent; its own receipts and tasks follow. */
const makeChange = async (row: requests.StayChangeRequestRow): Promise<void> => {
  const details = toDetails(row);
  const owner = row.pet_owners_uuid;
  const bookingId = row.bookings_uuid;
  switch (details.kind) {
    case 'extend':
      await extendStay(owner, bookingId, { endDate: details.endDate });
      return;
    case 'add_on':
      await bookAddOn(owner, bookingId, row.booking_pets_uuid ?? '', {
        serviceId: details.serviceId,
        date: details.date,
        quantity: details.quantity,
      });
      return;
    case 'times':
      await changeStayTimes(owner, bookingId, row.booking_pets_uuid ?? '', {
        ...(details.dropOffTime !== undefined ? { dropOffTime: details.dropOffTime } : {}),
        ...(details.pickUpTime !== undefined ? { pickUpTime: details.pickUpTime } : {}),
      });
      return;
    case 'early_check_out':
      throw new AppError(
        'Early pick-up is arranged with the team, not online.',
        'STAY_CHANGE_NOT_SUPPORTED',
        422,
      );
  }
};

/**
 * Approves a waiting request and makes the change. If the change can no longer be made (the nights
 * filled up, the stay ended), the request goes back to waiting and the manager hears why.
 */
export const approveStayChangeRequest = async (
  requestId: string,
  managerId: string,
): Promise<void> => {
  const row = await requests.decideStayChangeRequest(requestId, {
    status: 'approved',
    deciderId: managerId,
  });
  if (!row) {
    if (!(await requests.findStayChangeRequest(requestId))) throw notFound();
    throw alreadyDecided();
  }
  try {
    await makeChange(row);
  } catch (error: unknown) {
    await requests.reopenStayChangeRequest(requestId);
    throw error;
  }
  const summary = summaryOf(row, await petNamesFor(row.bookings_uuid, row.booking_pets_uuid));
  // The bell already has the change's own receipt; the chat hears that it was approved.
  void postBookingNoticeToChat({
    ownerId: row.pet_owners_uuid,
    bookingId: row.bookings_uuid,
    kind: 'booking_change_approved',
    body: changeApprovedBody(summary),
  });
};

/** Refuses a waiting request; the parent reads the reason in the bell, the chat and My Stays. */
export const refuseStayChangeRequest = async (
  requestId: string,
  managerId: string,
  reason: string,
): Promise<void> => {
  const row = await requests.decideStayChangeRequest(requestId, {
    status: 'refused',
    deciderId: managerId,
    reason: reason.trim(),
  });
  if (!row) {
    if (!(await requests.findStayChangeRequest(requestId))) throw notFound();
    throw alreadyDecided();
  }
  const summary = summaryOf(row, await petNamesFor(row.bookings_uuid, row.booking_pets_uuid));
  const notice: ParentNoticeDraft = {
    ownerId: row.pet_owners_uuid,
    bookingId: row.bookings_uuid,
    kind: 'booking_change_refused',
    body: changeRefusedBody(summary, reason),
  };
  try {
    await recordParentNotice(notice);
  } catch (error: unknown) {
    logFailure('booking_change_refused', row.uuid, error);
  }
  void postBookingNoticeToChat(notice);
};
