import type { PoolClient } from 'pg';
import { AppError } from '../common/middlewares/error.middleware.js';
import { newZealandDateOf } from '../common/utils/new-zealand-time.js';
import {
  DESK_PROCESSOR,
  insertBookingCharge,
  listChargesForBooking,
  type BookingChargeKind,
  type BookingChargeRow,
  type NewBookingCharge,
} from '../repositories/booking.charges.repository.js';
import type {
  GuaranteePayment,
  LockedBooking,
  PetAtTheDesk,
} from '../repositories/booking.check-in.repository.js';
import { bookingNotFound, processorFor, withProcessor } from './booking.guarantee.js';
import type { ChargeSettlement } from '../contracts/booking.change.contract.js';
import type { CardProcessor } from './payments/card-processor.js';
import { toConfirmationNumber } from './petparent.booking.js';

/**
 * Shared by the changes a parent makes while the pet is staying (booking.guest-extend.ts,
 * booking.guest-addon.ts, booking.guest-times.ts). A stay is "under way" from the moment staff
 * record the pet as checked in until its check-out time. Money for these changes is its own row in
 * the `booking_charges` ledger: charged to the booking's saved card at once, or, when the booking
 * has no saved card, owed and paid at the desk at check-out (owner decision, 7 Oct 2026). The
 * stay's own payment row stays as the desk left it.
 */

export const toCents = (amount: number): number => Math.round(amount * 100);
export const fromCents = (cents: number): number => cents / 100;

/** A pet in the facility right now, with the dates every change reads. */
export type StayingPet = PetAtTheDesk & { dropOffAt: Date; pickUpAt: Date };

export interface StayUnderWay {
  booking: LockedBooking;
  /**
   * The booking's saved card; its status may already be settled by the desk. Null when the booking
   * was made without one: changes are then owed at the desk.
   */
  payment: GuaranteePayment | null;
  pets: StayingPet[];
  /** The earliest drop-off and the latest pick-up over the pets. */
  dropOffAt: Date;
  pickUpAt: Date;
  /** Everything already charged or refunded on this booking while it stayed. */
  charges: BookingChargeRow[];
}

export const notUnderWay = (): AppError =>
  new AppError(
    'This change is for a stay that is under way: after check-in and before check-out. For anything else, please contact our team.',
    'STAY_NOT_UNDER_WAY',
    409,
  );

/**
 * The owner's stay, with every pet still on the booking checked in and not yet gone home. A pet
 * a manager refused or the parent cancelled is not on the booking; a pet that never arrived, or a
 * booking the desk has not checked in yet, is not under way.
 */
export const stayUnderWay = async (
  booking: LockedBooking,
  ownerId: string | null,
  now: Date,
  client: PoolClient,
): Promise<StayUnderWay> => {
  if (ownerId !== null && booking.ownerId !== ownerId) throw bookingNotFound();
  const payment = booking.payment ?? null;
  const onBooking = booking.pets.filter((pet) => pet.reviewStatus === 'approved');
  const pets = onBooking.flatMap((pet): StayingPet[] =>
    pet.outcome === 'checked_in' && pet.dropOffAt && pet.pickUpAt
      ? [{ ...pet, dropOffAt: pet.dropOffAt, pickUpAt: pet.pickUpAt }]
      : [],
  );
  if (pets.length === 0 || pets.length < onBooking.length) throw notUnderWay();
  const pickUpAt = new Date(Math.max(...pets.map((pet) => pet.pickUpAt.getTime())));
  if (now.getTime() >= pickUpAt.getTime()) throw notUnderWay();
  const dropOffAt = new Date(Math.min(...pets.map((pet) => pet.dropOffAt.getTime())));
  const charges = await listChargesForBooking(client, booking.bookingId);
  return { booking, payment, pets, dropOffAt, pickUpAt, charges };
};

/** Nights between two instants in New Zealand dates; a same-day stay counts as one night. */
export const aucklandNightsBetween = (from: Date, to: Date): number => {
  const start = Date.parse(`${newZealandDateOf(from)}T00:00:00Z`);
  const end = Date.parse(`${newZealandDateOf(to)}T00:00:00Z`);
  return Math.max(Math.round((end - start) / 86_400_000), 1);
};

/**
 * The next ordinal for a charge of this shape on this booking, so a retry after a failure that
 * charged but did not record replays the same processor key instead of charging again.
 */
export const nextChargeOrdinal = (
  charges: readonly BookingChargeRow[],
  matches: (charge: BookingChargeRow) => boolean,
): number => charges.filter((charge) => charge.amount > 0 && matches(charge)).length + 1;

export const cardDeclined = (what: string): AppError =>
  new AppError(
    `Your card was declined, so ${what}. Please contact our team or try another card.`,
    'CARD_DECLINED',
    402,
  );

export interface LedgerCharge {
  kind: BookingChargeKind;
  bookingPetsUuid: string | null;
  description: string;
  amount: number;
  idempotencyKey: string;
  servicesUuid?: string | null;
  serviceDate?: string | null;
  quantity?: number | null;
}

/** How a change on this stay is paid, shown to the parent before they confirm. */
export const settlementFor = (stay: StayUnderWay): ChargeSettlement =>
  stay.payment ? 'card' : 'desk';

const ledgerFieldsOf = (
  stay: StayUnderWay,
  charge: LedgerCharge,
): Omit<NewBookingCharge, 'processor' | 'paymentIntentId'> => ({
  bookingId: stay.booking.bookingId,
  bookingPetsUuid: charge.bookingPetsUuid,
  kind: charge.kind,
  servicesUuid: charge.servicesUuid ?? null,
  serviceDate: charge.serviceDate ?? null,
  quantity: charge.quantity ?? null,
  description: charge.description,
  amount: charge.amount,
  idempotencyKey: charge.idempotencyKey,
});

/**
 * Charges the saved card at once and records the charge. The processor call carries the ledger
 * key, so the same key never moves money twice; the row is written in the caller's transaction.
 */
const chargeSavedCard = async (
  stay: StayUnderWay,
  payment: GuaranteePayment,
  charge: LedgerCharge,
  declinedWhat: string,
  client: PoolClient,
  processor: CardProcessor | null | undefined,
): Promise<string> => {
  const cards = processorFor(payment, processor);
  const result = await withProcessor(() =>
    cards.chargeNow({
      paymentMethodId: payment.paymentMethodId,
      amount: charge.amount,
      reference: toConfirmationNumber(stay.booking.bookingId),
      idempotencyKey: charge.idempotencyKey,
    }),
  );
  if (result.status !== 'succeeded') throw cardDeclined(declinedWhat);
  return insertBookingCharge(client, {
    ...ledgerFieldsOf(stay, charge),
    processor: cards.name,
    paymentIntentId: result.paymentIntentId,
  });
};

export interface RecordedCharge {
  chargeId: string;
  settlement: ChargeSettlement;
}

/**
 * Records the amount of a change on the ledger. With a saved card it is charged at once; without
 * one nothing is charged now and the row is owed, paid at the desk at check-out.
 */
export const recordInStayCharge = async (
  stay: StayUnderWay,
  charge: LedgerCharge,
  declinedWhat: string,
  client: PoolClient,
  processor: CardProcessor | null | undefined,
): Promise<RecordedCharge> => {
  if (!stay.payment) {
    const chargeId = await insertBookingCharge(client, {
      ...ledgerFieldsOf(stay, charge),
      processor: DESK_PROCESSOR,
      paymentIntentId: null,
    });
    return { chargeId, settlement: 'desk' };
  }
  const chargeId = await chargeSavedCard(
    stay,
    stay.payment,
    charge,
    declinedWhat,
    client,
    processor,
  );
  return { chargeId, settlement: 'card' };
};
