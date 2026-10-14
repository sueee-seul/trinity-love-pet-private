import type { PoolClient } from 'pg';

/**
 * Moving a card-guaranteed stay to new dates, inside the caller's `withLockedBooking` transaction.
 */

export interface MovedPet {
  bookingPetsUuid: string;
  dropOffAt: Date;
  pickUpAt: Date;
}

/**
 * New dates for each pet still on the booking. The reminder is sent again for the new drop-off,
 * and `countsAsDateChange` counts the guest's own change. `returnToReview` sends every moved
 * pet back to the manager (a guest's own change: the manager agreed to the old dates only); staff
 * moving a stay for an emergency keep the decisions they already made.
 */
export const moveStay = async (
  client: PoolClient,
  bookingId: string,
  pets: MovedPet[],
  countsAsDateChange: boolean,
  returnToReview: boolean,
): Promise<void> => {
  const reviewReset = returnToReview
    ? `, manager_review_status = 'pending', approved_at = NULL, refusal_reason = NULL, reviewed_by_uuid = NULL`
    : '';
  for (const pet of pets) {
    await client.query(
      `UPDATE booking_pets SET drop_off_time = $3, pick_up_time = $4${reviewReset}
        WHERE uuid = $1::uuid AND bookings_uuid = $2::uuid`,
      [pet.bookingPetsUuid, bookingId, pet.dropOffAt, pet.pickUpAt],
    );
  }
  await client.query(
    `UPDATE bookings
        SET reminder_sent_at = NULL, reschedule_count = reschedule_count + $2
      WHERE uuid = $1::uuid`,
    [bookingId, countsAsDateChange ? 1 : 0],
  );
};

export interface RenewedGuarantee {
  status: 'pending' | 'authorized';
  amount: number;
  /** The new hold, or null when it is placed later, 48 hours before the new drop-off. */
  paymentIntentId: string | null;
}

/** The card now guarantees the new total; the old hold is gone. */
export const renewGuarantee = async (
  client: PoolClient,
  paymentId: string,
  renewal: RenewedGuarantee,
): Promise<void> => {
  await client.query(
    `UPDATE booking_payments
        SET status = $2, amount = $3, processor_payment_intent_id = $4, captured_amount = NULL
      WHERE uuid = $1::uuid`,
    [paymentId, renewal.status, renewal.amount, renewal.paymentIntentId],
  );
};

/**
 * The card no longer holds anything, so the 48-hour job holds the booking again on its next pass
 * (at once when drop-off is already within 48 hours) and sends the reminder with the new amount.
 * The released hold's id stays on the pending payment: the next hold's idempotency key includes
 * it, so the processor treats that hold as new instead of replaying the released one.
 */
export const awaitNewHold = async (
  client: PoolClient,
  bookingId: string,
  paymentId: string,
): Promise<void> => {
  await client.query(
    `UPDATE booking_payments SET status = 'pending', captured_amount = NULL WHERE uuid = $1::uuid`,
    [paymentId],
  );
  await client.query(`UPDATE bookings SET reminder_sent_at = NULL WHERE uuid = $1::uuid`, [
    bookingId,
  ]);
};
