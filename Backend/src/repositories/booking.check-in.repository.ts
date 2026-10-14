import type { PoolClient } from 'pg';
import { pool } from '../config/database.js';
import type { CheckInOutcome } from '../contracts/booking.check-in.contract.js';
import {
  PAY_AT_REQUEST_TERMS_VERSION,
  TERMS_VERSION_LABEL_SQL,
} from './booking.agreement.repository.js';

/**
 * The SQL behind the desk: each pet's arrival, and the booking's card payment while money moves.
 *
 * A booking is "settled" once its card payment has a captured amount: what finishing check-in or
 * a cancellation finally kept (0 when nothing was). A settled booking's arrivals are final.
 *
 * A pay-at-request booking (terms concierge-terms-2026-10-02 on) moves through 'authorized' (the
 * price held when the request was sent) to 'succeeded' with no captured amount yet (the confirmed
 * pets were charged; `amount` is what was charged), and is settled at the desk or on cancellation,
 * when anything not owed is refunded.
 */

export type CardGuaranteeStatus =
  'pending' | 'authorized' | 'succeeded' | 'canceled' | 'failed' | 'refunded';

/** Processors whose payment rows are card guarantees; the classic form's rows are not. */
export const CARD_GUARANTEE_PROCESSORS = ['stripe', 'fake'];

export interface GuaranteePayment {
  paymentId: string;
  status: CardGuaranteeStatus;
  amount: number;
  capturedAmount: number | null;
  paymentIntentId: string | null;
  paymentMethodId: string;
  processor: string;
}

export interface PetAtTheDesk {
  bookingPetsUuid: string;
  reviewStatus: string;
  approvedAt: Date | null;
  outcome: CheckInOutcome | null;
  /** This pet's share of the booking: its recorded lines, nights counted in Auckland dates. */
  price: number;
  /** The part of `price` charged per night, and the rest, so new dates can be priced alike. */
  nightlyRate: number;
  flatPrice: number;
  dropOffAt: Date | null;
  pickUpAt: Date | null;
}

export interface LockedBooking {
  bookingId: string;
  ownerId: string;
  bookedAt: Date;
  /** Held at request and charged on confirmation (newer terms), not held 48 hours ahead. */
  paysAtRequest: boolean;
  /** The terms version label the booking agreed to, '' when it has none; picks its fee rules. */
  termsVersion: string;
  /** Date changes the guest has made. */
  rescheduleCount: number;
  /** Null when the booking was not made with a saved card. */
  payment: GuaranteePayment | null;
  pets: PetAtTheDesk[];
}

export interface ArrivalTarget {
  bookingId: string;
  reviewStatus: string;
  outcome: CheckInOutcome | null;
  dropOffAt: Date | null;
  settled: boolean;
}

/**
 * Pets still on the booking: a request waiting for a manager, or a stay the manager approved. Not
 * refused, not cancelled. A waiting request keeps its place and its saved card.
 */
export const isActivePet = (reviewStatus: string): boolean =>
  reviewStatus === 'pending' || reviewStatus === 'approved';

/**
 * Stays Wagstay agreed to: only these are held on the card, checked in at the desk and charged.
 * A request still waiting for a manager is not a booking yet (Fair Trading Act 1986 s9, s11).
 */
export const isConfirmedPet = (reviewStatus: string): boolean => reviewStatus === 'approved';

/** Nights in Auckland dates, as the price was quoted; a same-day stay counts as one. */
export const AUCKLAND_NIGHTS = `GREATEST(
  (bp.pick_up_time AT TIME ZONE 'Pacific/Auckland')::date
    - (bp.drop_off_time AT TIME ZONE 'Pacific/Auckland')::date,
  1)`;

/** One pet's price from its recorded lines, by the shared rule in booking.pricing.ts. */
export const PET_PRICE_SQL = `COALESCE((
  SELECT SUM(bps.price_at_booking * bps.quantity
             * CASE WHEN s.price_unit IN ('per night', 'per day') THEN ${AUCKLAND_NIGHTS} ELSE 1 END)
    FROM booking_pets_services bps
    JOIN services s ON s.uuid = bps.services_uuid
   WHERE bps.booking_pets_uuid = bp.uuid
), 0)`;

/**
 * `LEFT JOIN LATERAL` that adds `guarantee` (status, amount, captured_amount, processor): the
 * saved card behind booking `b`, if it was made with one. `processorsParam` is the placeholder
 * bound to CARD_GUARANTEE_PROCESSORS, e.g. "$1".
 */
export const cardGuaranteeJoin = (processorsParam: string): string => `
  LEFT JOIN LATERAL (
    SELECT pay.status, pay.amount, pay.captured_amount, pm.processor
      FROM booking_payments pay
      JOIN payment_methods pm ON pm.uuid = pay.payment_methods_uuid
     WHERE pay.bookings_uuid = b.uuid AND pm.processor = ANY(${processorsParam}::text[])
     ORDER BY pay.uuid
     LIMIT 1
  ) guarantee ON TRUE`;

/** One pet's recorded lines that are charged per night (`nightly`) or once (the rest). */
const petLinesSql = (nightly: boolean): string => `COALESCE((
  SELECT SUM(bps.price_at_booking * bps.quantity)
    FROM booking_pets_services bps
    JOIN services s ON s.uuid = bps.services_uuid
   WHERE bps.booking_pets_uuid = bp.uuid
     AND ${nightly ? '' : 'NOT '}COALESCE(s.price_unit IN ('per night', 'per day'), FALSE)
), 0)`;

/**
 * One night of a pet's per-night lines: the base of its late-cancellation and no-show fee
 * (`lateFee` in booking.fee-policy.ts caps it at the pet's price).
 */
export const PET_NIGHTLY_RATE_SQL = petLinesSql(true);

interface PaymentRow {
  payment_id: string;
  status: CardGuaranteeStatus;
  amount: string;
  captured_amount: string | null;
  payment_intent_id: string | null;
  payment_method_id: string;
  processor: string;
}

interface PetRow {
  booking_pets_uuid: string;
  review_status: string;
  approved_at: Date | null;
  outcome: CheckInOutcome | null;
  price: string;
  nightly_rate: string;
  flat_price: string;
  drop_off_at: Date | null;
  pick_up_at: Date | null;
  owner_id: string;
  booked_at: Date;
  reschedule_count: number | string;
  terms_version: string | null;
}

const toPayment = (row: PaymentRow): GuaranteePayment => ({
  paymentId: row.payment_id,
  status: row.status,
  amount: Number(row.amount),
  capturedAmount: row.captured_amount === null ? null : Number(row.captured_amount),
  paymentIntentId: row.payment_intent_id,
  paymentMethodId: row.payment_method_id,
  processor: row.processor,
});

export const findArrivalTarget = async (bookingPetsUuid: string): Promise<ArrivalTarget | null> => {
  const result = await pool.query<{
    booking_id: string;
    review_status: string;
    outcome: CheckInOutcome | null;
    drop_off_at: Date | null;
    settled: boolean;
  }>(
    `SELECT bp.bookings_uuid::text AS booking_id,
            bp.manager_review_status AS review_status,
            bp.check_in_outcome AS outcome,
            bp.drop_off_time AS drop_off_at,
            EXISTS (
              SELECT 1 FROM booking_payments pay
               WHERE pay.bookings_uuid = bp.bookings_uuid AND pay.captured_amount IS NOT NULL
            ) AS settled
       FROM booking_pets bp
      WHERE bp.uuid = $1::uuid`,
    [bookingPetsUuid],
  );
  const row = result.rows[0];
  return row
    ? {
        bookingId: row.booking_id,
        reviewStatus: row.review_status,
        outcome: row.outcome,
        dropOffAt: row.drop_off_at,
        settled: row.settled,
      }
    : null;
};

/** Records the arrival while the pet is on the booking and the booking is not settled. */
export const saveArrival = async (
  bookingPetsUuid: string,
  outcome: CheckInOutcome,
  at: Date,
): Promise<boolean> => {
  const result = await pool.query(
    `UPDATE booking_pets bp
        SET check_in_outcome = $2, check_in_recorded_at = $3
      WHERE bp.uuid = $1::uuid
        AND bp.manager_review_status = 'approved'
        AND NOT EXISTS (
          SELECT 1 FROM booking_payments pay
           WHERE pay.bookings_uuid = bp.bookings_uuid AND pay.captured_amount IS NOT NULL
        )`,
    [bookingPetsUuid, outcome, at],
  );
  return (result.rowCount ?? 0) > 0;
};

export const findBookingIdOfPet = async (bookingPetsUuid: string): Promise<string | null> => {
  const result = await pool.query<{ booking_id: string }>(
    'SELECT bookings_uuid::text AS booking_id FROM booking_pets WHERE uuid = $1::uuid',
    [bookingPetsUuid],
  );
  return result.rows[0]?.booking_id ?? null;
};

const readLockedBooking = async (
  client: PoolClient,
  bookingId: string,
): Promise<LockedBooking | null> => {
  // Locked first, so two managers finishing the same check-in wait for each other.
  const payment = await client.query<PaymentRow>(
    `SELECT pay.uuid::text AS payment_id, pay.status, pay.amount::text AS amount,
            pay.captured_amount::text AS captured_amount,
            pay.processor_payment_intent_id AS payment_intent_id,
            pm.processor_payment_method_id AS payment_method_id, pm.processor
       FROM booking_payments pay
       JOIN payment_methods pm ON pm.uuid = pay.payment_methods_uuid
      WHERE pay.bookings_uuid = $1::uuid AND pm.processor = ANY($2::text[])
      ORDER BY pay.uuid
      LIMIT 1
        FOR UPDATE OF pay`,
    [bookingId, CARD_GUARANTEE_PROCESSORS],
  );
  const pets = await client.query<PetRow>(
    `SELECT bp.uuid::text AS booking_pets_uuid,
            bp.manager_review_status AS review_status,
            bp.check_in_outcome AS outcome,
            bp.approved_at,
            ${PET_PRICE_SQL}::text AS price,
            ${PET_NIGHTLY_RATE_SQL}::text AS nightly_rate,
            ${petLinesSql(false)}::text AS flat_price,
            bp.drop_off_time AS drop_off_at,
            bp.pick_up_time AS pick_up_at,
            b.pet_owners_uuid::text AS owner_id,
            b.created_at AS booked_at,
            b.reschedule_count,
            ${TERMS_VERSION_LABEL_SQL} AS terms_version
       FROM booking_pets bp
       JOIN bookings b ON b.uuid = bp.bookings_uuid
       LEFT JOIN bookings_agreements ba ON ba.bookings_uuid = b.uuid
       LEFT JOIN terms_versions tv ON tv.uuid = ba.terms_versions_uuid
      WHERE bp.bookings_uuid = $1::uuid
      ORDER BY bp.created_at, bp.uuid`,
    [bookingId],
  );
  const [first] = pets.rows;
  if (!first) return null;
  const [paymentRow] = payment.rows;
  return {
    bookingId,
    ownerId: first.owner_id,
    bookedAt: first.booked_at,
    // Labels are dated, so a later version sorts after the first pay-at-request one.
    paysAtRequest: (first.terms_version ?? '') >= PAY_AT_REQUEST_TERMS_VERSION,
    termsVersion: first.terms_version ?? '',
    rescheduleCount: Number(first.reschedule_count),
    payment: paymentRow ? toPayment(paymentRow) : null,
    pets: pets.rows.map((row) => ({
      bookingPetsUuid: row.booking_pets_uuid,
      reviewStatus: row.review_status,
      approvedAt: row.approved_at ?? null,
      outcome: row.outcome,
      price: Number(row.price),
      nightlyRate: Number(row.nightly_rate),
      flatPrice: Number(row.flat_price),
      dropOffAt: row.drop_off_at,
      pickUpAt: row.pick_up_at,
    })),
  };
};

/**
 * Runs `work` in one transaction with the booking's card payment locked. Everything `work` writes
 * is kept only if it finishes; money it moves must therefore be safe to repeat (idempotency keys,
 * releases). Null when the booking does not exist.
 */
export const withLockedBooking = async <T>(
  bookingId: string,
  work: (booking: LockedBooking, client: PoolClient) => Promise<T>,
): Promise<T | null> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const booking = await readLockedBooking(client, bookingId);
    const value = booking ? await work(booking, client) : null;
    await client.query('COMMIT');
    return value;
  } catch (error: unknown) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
};

export interface PaymentSettlement {
  status: CardGuaranteeStatus;
  capturedAmount: number | null;
  paymentIntentId?: string | null;
}

export const settlePayment = async (
  client: PoolClient,
  paymentId: string,
  settlement: PaymentSettlement,
): Promise<void> => {
  await client.query(
    `UPDATE booking_payments
        SET status = $2,
            captured_amount = $3,
            processor_payment_intent_id = COALESCE($4, processor_payment_intent_id)
      WHERE uuid = $1::uuid`,
    [paymentId, settlement.status, settlement.capturedAmount, settlement.paymentIntentId ?? null],
  );
};

/**
 * The confirmed pets were charged (pay-at-request): `amount` becomes what is on the card now. The
 * booking is not settled yet, so the desk and a cancellation can still refund what is not owed.
 */
export const recordCharge = async (
  client: PoolClient,
  paymentId: string,
  charged: number,
): Promise<void> => {
  await client.query(
    `UPDATE booking_payments
        SET status = 'succeeded', amount = $2, captured_amount = NULL
      WHERE uuid = $1::uuid`,
    [paymentId, charged],
  );
};

/** Cancels every pet still on the booking that has not arrived, keeping the reason. */
export const cancelActivePets = async (
  client: PoolClient,
  bookingId: string,
  reason: string,
): Promise<string[]> => {
  const result = await client.query<{ uuid: string }>(
    `UPDATE booking_pets
        SET manager_review_status = 'cancelled', refusal_reason = $2
      WHERE bookings_uuid = $1::uuid
        AND manager_review_status IN ('pending', 'approved')
        AND check_in_outcome IS NULL
      RETURNING uuid::text AS uuid`,
    [bookingId, reason],
  );
  return result.rows.map((row) => row.uuid);
};
