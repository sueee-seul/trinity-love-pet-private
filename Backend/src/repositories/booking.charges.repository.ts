import type { PoolClient } from 'pg';
import type { SqlRunner } from './booking.capacity.repository.js';

/**
 * The `booking_charges` ledger: every amount added while a pet is staying (an extension, an
 * add-on). The stay's own payment row is never rewritten by these; see
 * 20261007_booking_charges_ledger.sql.
 *
 * A row is either charged to the saved card at once (`processor` names the card processor) or,
 * on a booking without a saved card, owed and paid at the desk at check-out (`processor` is
 * DESK_PROCESSOR and there is no payment intent). The existing column carries this so no schema
 * change is needed.
 */

/**
 * 'early_pickup_refund' and 'late_pickup' are no longer written (early pick-up and pick-up
 * coordination were removed on 7 Oct 2026) but older rows may still carry them.
 */
export type BookingChargeKind = 'extension' | 'add_on' | 'early_pickup_refund' | 'late_pickup';

/** The `processor` of a charge the parent pays at the desk at check-out. */
export const DESK_PROCESSOR = 'desk';

export interface BookingChargeRow {
  uuid: string;
  bookingPetsUuid: string | null;
  kind: BookingChargeKind;
  servicesUuid: string | null;
  serviceDate: string | null;
  quantity: number | null;
  description: string;
  /** Positive: charged to the card. Negative: given back to it. */
  amount: number;
  processor: string;
  paymentIntentId: string | null;
  idempotencyKey: string;
  createdAt: Date;
}

interface ChargeSqlRow {
  uuid: string;
  booking_pets_uuid: string | null;
  kind: BookingChargeKind;
  services_uuid: string | null;
  service_date: string | null;
  quantity: number | null;
  description: string;
  amount: string;
  processor: string;
  processor_payment_intent_id: string | null;
  idempotency_key: string;
  created_at: Date;
}

const toRow = (row: ChargeSqlRow): BookingChargeRow => ({
  uuid: row.uuid,
  bookingPetsUuid: row.booking_pets_uuid,
  kind: row.kind,
  servicesUuid: row.services_uuid,
  serviceDate: row.service_date,
  quantity: row.quantity,
  description: row.description,
  amount: Number(row.amount),
  processor: row.processor,
  paymentIntentId: row.processor_payment_intent_id,
  idempotencyKey: row.idempotency_key,
  createdAt: row.created_at,
});

const CHARGE_COLUMNS = `
  uuid::text AS uuid, booking_pets_uuid::text AS booking_pets_uuid, kind,
  services_uuid::text AS services_uuid, to_char(service_date, 'YYYY-MM-DD') AS service_date,
  quantity, description, amount::text AS amount, processor, processor_payment_intent_id,
  idempotency_key, created_at`;

/** Oldest first, so a refund can walk the charges newest first by reversing. */
export const listChargesForBooking = async (
  runner: SqlRunner,
  bookingId: string,
): Promise<BookingChargeRow[]> => {
  const result = await runner.query<ChargeSqlRow>(
    `SELECT ${CHARGE_COLUMNS} FROM booking_charges
      WHERE bookings_uuid = $1::uuid
      ORDER BY created_at, uuid`,
    [bookingId],
  );
  return result.rows.map(toRow);
};

export interface NewBookingCharge {
  bookingId: string;
  bookingPetsUuid: string | null;
  kind: BookingChargeKind;
  servicesUuid?: string | null;
  serviceDate?: string | null;
  quantity?: number | null;
  description: string;
  amount: number;
  processor: string;
  paymentIntentId: string | null;
  idempotencyKey: string;
}

export const insertBookingCharge = async (
  runner: SqlRunner,
  charge: NewBookingCharge,
): Promise<string> => {
  const result = await runner.query<{ uuid: string }>(
    `INSERT INTO booking_charges
       (bookings_uuid, booking_pets_uuid, kind, services_uuid, service_date, quantity, description,
        amount, processor, processor_payment_intent_id, idempotency_key)
     VALUES ($1::uuid, $2::uuid, $3, $4::uuid, $5::date, $6, $7, $8, $9, $10, $11)
     RETURNING uuid::text AS uuid`,
    [
      charge.bookingId,
      charge.bookingPetsUuid,
      charge.kind,
      charge.servicesUuid ?? null,
      charge.serviceDate ?? null,
      charge.quantity ?? null,
      charge.description,
      charge.amount,
      charge.processor,
      charge.paymentIntentId,
      charge.idempotencyKey,
    ],
  );
  const inserted = result.rows[0];
  if (!inserted) throw new Error('booking_charges insert returned no row');
  return inserted.uuid;
};

/** Pet names by booking pet id; a deleted pet keeps the name recorded on its stay. */
export const readPetNamesForBooking = async (
  runner: SqlRunner,
  bookingId: string,
): Promise<Map<string, string>> => {
  const result = await runner.query<{ booking_pets_uuid: string; name: string }>(
    `SELECT bp.uuid::text AS booking_pets_uuid, COALESCE(p.name, bp.pet_name, 'your pet') AS name
       FROM booking_pets bp
       LEFT JOIN pets p ON p.uuid = bp.pet_uuid
      WHERE bp.bookings_uuid = $1::uuid`,
    [bookingId],
  );
  return new Map(result.rows.map((row) => [row.booking_pets_uuid, row.name]));
};

/** Every pet still on the booking leaves at the new time; the reminder is sent for the new day. */
export const movePickUp = async (
  client: PoolClient,
  bookingId: string,
  bookingPetsUuids: string[],
  pickUpAt: Date,
): Promise<void> => {
  await client.query(
    `UPDATE booking_pets SET pick_up_time = $3
      WHERE bookings_uuid = $1::uuid AND uuid = ANY($2::uuid[])`,
    [bookingId, bookingPetsUuids, pickUpAt],
  );
};

export interface PetTimes {
  dropOffAt?: Date;
  pickUpAt?: Date;
}

/** A new time of day on the booked dates for one pet; a field left out keeps its value. */
export const setPetTimes = async (
  client: PoolClient,
  bookingId: string,
  bookingPetsUuid: string,
  times: PetTimes,
): Promise<void> => {
  await client.query(
    `UPDATE booking_pets
        SET drop_off_time = COALESCE($3, drop_off_time),
            pick_up_time = COALESCE($4, pick_up_time)
      WHERE bookings_uuid = $1::uuid AND uuid = $2::uuid`,
    [bookingId, bookingPetsUuid, times.dropOffAt ?? null, times.pickUpAt ?? null],
  );
};
