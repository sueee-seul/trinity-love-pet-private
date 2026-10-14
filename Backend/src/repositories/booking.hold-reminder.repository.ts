import type { PoolClient } from 'pg';
import { pool } from '../config/database.js';
import { BOOKING_ARRIVAL_UNMARKED } from '../contracts/booking.notification.contract.js';
import {
  CARD_GUARANTEE_PROCESSORS,
  PET_NIGHTLY_RATE_SQL,
  PET_PRICE_SQL,
} from './booking.check-in.repository.js';
import { insertManagerFlag, type ManagerNotice } from './booking.notification.repository.js';
import {
  PAY_AT_REQUEST_TERMS_VERSION,
  TERMS_VERSION_LABEL_SQL,
} from './booking.agreement.repository.js';

/**
 * The SQL behind the 48-hour job (services/booking.hold-reminder.ts).
 *
 * Only bookings made with a saved card count: status 'confirmed' and a payment method from Stripe
 * or the development fake. Older bookings (the classic form's 'paid' ones) are never touched.
 *
 * Each write is guarded by the state it expects (a payment still 'pending', a reminder not yet
 * sent, no flag yet for this booking), so running the same step twice changes nothing.
 */

/** 'succeeded' only for a pay-at-request booking already charged: it gets the reminder alone. */
export type GuaranteePaymentStatus = 'pending' | 'authorized' | 'failed' | 'succeeded';

/** What an approved pet's cancellation fee is worked out from (booking.fee-policy.ts). */
export interface DuePetFeeTerms {
  price: number;
  nightlyRate: number;
  approvedAt: Date | null;
  dropOffAt: Date;
}

export interface DueBooking {
  bookingId: string;
  bookedAt: Date;
  dropOffAt: Date;
  pickUpAt: Date;
  ownerEmail: string;
  ownerFirstName: string | null;
  petNames: string[];
  /** The approved pets' total: what the hold is for. */
  amount: number;
  /** One entry per approved pet, so the reminder can state what cancelling costs. */
  approvedPets: DuePetFeeTerms[];
  paymentStatus: GuaranteePaymentStatus;
  /** Agreed to the pay-at-request terms: charged on confirmation, tiered fees. */
  paysAtRequest: boolean;
  /** The terms version label the booking agreed to, '' when it has none; picks its fee rules. */
  termsVersion: string;
  /**
   * The hold released when the approved pets changed, if any. A new hold must not reuse that
   * hold's idempotency key, or the processor would answer with the released one.
   */
  releasedHoldId: string | null;
  /** The processor the card was saved with (payment_methods.processor). */
  processor: string;
  paymentMethodId: string;
}

export interface HoldResult {
  status: 'authorized' | 'failed';
  paymentIntentId: string | null;
  /** What was held: the approved pets' total, which is what the card now guarantees. */
  amount: number;
}

/** A flag for managers, raised once per booking. */
export type ManagerFlag = ManagerNotice;

export interface UnmarkedArrival {
  bookingId: string;
  dropOffAt: Date;
  petNames: string[];
}

/**
 * Separate from the capacity lock, so a long job run never blocks a guest who is booking. Held
 * for one run, inside a transaction, which also works through a transaction-mode pooler.
 */
const BOOKING_JOBS_LOCK_KEY = 20260930;

/** How far back an unmarked arrival is still worth a flag. */
const UNMARKED_ARRIVAL_LOOKBACK_DAYS = 7;

const DUE_BATCH_SIZE = 50;

/**
 * Only stays a manager approved are held, reminded and expected at the desk. A request still
 * waiting for review holds nothing: it is not a booking yet.
 */
const CONFIRMED_PET = `bp.manager_review_status = 'approved'`;

interface DueBookingRow {
  booking_id: string;
  booked_at: Date;
  drop_off_at: Date;
  pick_up_at: Date;
  owner_email: string;
  owner_first_name: string | null;
  pet_names: string[];
  amount: string;
  approved_pets: {
    price: number;
    nightlyRate: number;
    approvedAt: string | null;
    dropOffAt: string;
  }[];
  payment_status: GuaranteePaymentStatus;
  pays_at_request: boolean;
  terms_version: string;
  released_hold_id: string | null;
  processor: string;
  payment_method_id: string;
}

const FIND_DUE_BOOKINGS = `
  SELECT b.uuid::text AS booking_id,
         b.created_at AS booked_at,
         MIN(bp.drop_off_time) AS drop_off_at,
         MAX(bp.pick_up_time) AS pick_up_at,
         u.email AS owner_email,
         po.first_name AS owner_first_name,
         array_agg(p.name ORDER BY bp.created_at, p.name) AS pet_names,
         SUM(${PET_PRICE_SQL})::text AS amount,
         json_agg(json_build_object(
           'price', (${PET_PRICE_SQL})::float8,
           'nightlyRate', (${PET_NIGHTLY_RATE_SQL})::float8,
           'approvedAt', bp.approved_at,
           'dropOffAt', bp.drop_off_time
         ) ORDER BY bp.created_at) AS approved_pets,
         pay.status AS payment_status,
         COALESCE(${TERMS_VERSION_LABEL_SQL}, '') >= $4 AS pays_at_request,
         COALESCE(${TERMS_VERSION_LABEL_SQL}, '') AS terms_version,
         CASE WHEN pay.status = 'pending' THEN pay.processor_payment_intent_id END
           AS released_hold_id,
         pm.processor,
         pm.processor_payment_method_id AS payment_method_id
    FROM bookings b
    JOIN pet_owners po ON po.users_uuid = b.pet_owners_uuid
    JOIN users u ON u.uuid = po.users_uuid
    JOIN booking_payments pay ON pay.bookings_uuid = b.uuid
    JOIN payment_methods pm ON pm.uuid = pay.payment_methods_uuid
    JOIN booking_pets bp ON bp.bookings_uuid = b.uuid
    JOIN pets p ON p.uuid = bp.pet_uuid
    LEFT JOIN bookings_agreements ba ON ba.bookings_uuid = b.uuid
    LEFT JOIN terms_versions tv ON tv.uuid = ba.terms_versions_uuid
   WHERE b.status = 'confirmed'
     AND b.reminder_sent_at IS NULL
     AND (pay.status IN ('pending', 'authorized', 'failed')
          OR (pay.status = 'succeeded' AND pay.captured_amount IS NULL))
     AND pm.processor = ANY($3::text[])
     AND ${CONFIRMED_PET}
     AND bp.drop_off_time IS NOT NULL
     AND bp.pick_up_time IS NOT NULL
   GROUP BY b.uuid, b.created_at, u.email, po.first_name, pay.uuid, pay.status,
            pay.processor_payment_intent_id, pm.processor, pm.processor_payment_method_id,
            tv.content
  HAVING MIN(bp.drop_off_time) > $1::timestamptz
     AND MIN(bp.drop_off_time) <= $1::timestamptz + make_interval(hours => $2::int)
   ORDER BY MIN(bp.drop_off_time)
   LIMIT ${DUE_BATCH_SIZE}
`;

const FIND_UNMARKED_ARRIVALS = `
  SELECT b.uuid::text AS booking_id,
         MIN(bp.drop_off_time) AS drop_off_at,
         array_agg(p.name ORDER BY bp.created_at, p.name) AS pet_names
    FROM bookings b
    JOIN booking_pets bp ON bp.bookings_uuid = b.uuid
    JOIN pets p ON p.uuid = bp.pet_uuid
   WHERE b.status = 'confirmed'
     AND ${CONFIRMED_PET}
     AND bp.check_in_outcome IS NULL
     AND (bp.drop_off_time AT TIME ZONE 'Pacific/Auckland')::date < $1::date
     AND (bp.drop_off_time AT TIME ZONE 'Pacific/Auckland')::date >= $1::date - $2::int
     AND EXISTS (
       SELECT 1 FROM booking_payments pay
         JOIN payment_methods pm ON pm.uuid = pay.payment_methods_uuid
        WHERE pay.bookings_uuid = b.uuid AND pm.processor = ANY($4::text[])
     )
     AND NOT EXISTS (
       SELECT 1 FROM notification n
        WHERE n.booking_uuid = b.uuid AND n.notification_setting = $3
     )
   GROUP BY b.uuid
   ORDER BY MIN(bp.drop_off_time)
`;

const inTransaction = async <T>(work: (client: PoolClient) => Promise<T>): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const value = await work(client);
    await client.query('COMMIT');
    return value;
  } catch (error: unknown) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Runs one job pass while holding the jobs lock, so two servers never run it at once. Returns
 * false, without running it, when another server holds the lock.
 */
export const withBookingJobLock = async (work: () => Promise<void>): Promise<boolean> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const lock = await client.query<{ locked: boolean }>(
      'SELECT pg_try_advisory_xact_lock($1) AS locked',
      [BOOKING_JOBS_LOCK_KEY],
    );
    if (!lock.rows[0]?.locked) return false;
    await work();
    return true;
  } finally {
    // Nothing was written on this connection; ending the transaction releases the lock.
    await client.query('ROLLBACK').catch(() => undefined);
    client.release();
  }
};

export const holdReminderStore = {
  async findDueBookings(now: Date, holdHoursBeforeDropOff: number): Promise<DueBooking[]> {
    const result = await pool.query<DueBookingRow>(FIND_DUE_BOOKINGS, [
      now,
      holdHoursBeforeDropOff,
      CARD_GUARANTEE_PROCESSORS,
      PAY_AT_REQUEST_TERMS_VERSION,
    ]);
    return result.rows.map((row) => ({
      bookingId: row.booking_id,
      bookedAt: row.booked_at,
      dropOffAt: row.drop_off_at,
      pickUpAt: row.pick_up_at,
      ownerEmail: row.owner_email,
      ownerFirstName: row.owner_first_name,
      petNames: row.pet_names,
      amount: Number(row.amount),
      approvedPets: row.approved_pets.map((pet) => ({
        price: Number(pet.price),
        nightlyRate: Number(pet.nightlyRate),
        approvedAt: pet.approvedAt ? new Date(pet.approvedAt) : null,
        dropOffAt: new Date(pet.dropOffAt),
      })),
      paymentStatus: row.payment_status,
      paysAtRequest: row.pays_at_request,
      termsVersion: row.terms_version,
      releasedHoldId: row.released_hold_id,
      processor: row.processor,
      paymentMethodId: row.payment_method_id,
    }));
  },

  /** Saves the hold only while the payment still waits for one; false when it no longer does. */
  async recordHold(
    bookingId: string,
    result: HoldResult,
    flag: ManagerFlag | null,
  ): Promise<boolean> {
    return inTransaction(async (client) => {
      const updated = await client.query(
        `UPDATE booking_payments
            SET status = $2,
                processor_payment_intent_id = COALESCE($3, processor_payment_intent_id),
                amount = $4
          WHERE bookings_uuid = $1::uuid AND status = 'pending'`,
        [bookingId, result.status, result.paymentIntentId, result.amount],
      );
      if (updated.rowCount === 0) return false;
      if (flag) await insertManagerFlag(client, flag);
      return true;
    });
  },

  async markReminderSent(bookingId: string, at: Date): Promise<void> {
    await pool.query(
      `UPDATE bookings SET reminder_sent_at = $2
        WHERE uuid = $1::uuid AND reminder_sent_at IS NULL`,
      [bookingId, at],
    );
  },

  async findUnmarkedArrivals(today: string): Promise<UnmarkedArrival[]> {
    const result = await pool.query<{ booking_id: string; drop_off_at: Date; pet_names: string[] }>(
      FIND_UNMARKED_ARRIVALS,
      [today, UNMARKED_ARRIVAL_LOOKBACK_DAYS, BOOKING_ARRIVAL_UNMARKED, CARD_GUARANTEE_PROCESSORS],
    );
    return result.rows.map((row) => ({
      bookingId: row.booking_id,
      dropOffAt: row.drop_off_at,
      petNames: row.pet_names,
    }));
  },

  async flagManagers(flag: ManagerFlag): Promise<void> {
    await insertManagerFlag(pool, flag);
  },
};
