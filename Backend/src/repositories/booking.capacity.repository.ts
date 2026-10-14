import type { QueryResult, QueryResultRow } from 'pg';
import { pool } from '../config/database.js';

/** The shared pool, or a client inside a booking transaction: both run SQL the same way. */
export interface SqlRunner {
  query<Row extends QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<Row>>;
}

/**
 * Advisory lock key that serialises booking writes, so two guests sending at the same moment
 * cannot both take the last place. Any fixed number works; it only has to be the same everywhere.
 */
const CAPACITY_LOCK_KEY = 20260929;

/**
 * Pets per night that count against capacity: every pet on a confirmed or paid booking that has
 * not been refused or cancelled and did not end up as a no-show or a pet Wagstay could not take.
 * A stay occupies its drop-off night up to the night before pick-up, in New Zealand dates.
 */
const PETS_PER_NIGHT_QUERY = `
  WITH occupied AS (
    SELECT (bp.drop_off_time AT TIME ZONE 'Pacific/Auckland')::date AS first_night,
           (bp.pick_up_time AT TIME ZONE 'Pacific/Auckland')::date AS leave_day
      FROM booking_pets bp
      JOIN bookings b ON b.uuid = bp.bookings_uuid
     WHERE b.status IN ('paid', 'confirmed')
       AND bp.manager_review_status IN ('pending', 'approved')
       AND (bp.check_in_outcome IS NULL OR bp.check_in_outcome = 'checked_in')
       AND bp.drop_off_time IS NOT NULL
       AND bp.pick_up_time IS NOT NULL
       -- A booking being moved to new dates does not compete with itself.
       AND ($3::uuid IS NULL OR b.uuid <> $3::uuid)
  )
  SELECT to_char(night, 'YYYY-MM-DD') AS night,
         (SELECT count(*) FROM occupied o
           WHERE o.first_night <= night::date AND o.leave_day > night::date)::int AS booked
    FROM generate_series($1::date, $2::date, interval '1 day') AS night
   ORDER BY night
`;

export interface NightOccupancy {
  night: string;
  booked: number;
}

/**
 * The facility's pets-per-night capacity. Bookings do not name a facility, so the number only has
 * a meaning while exactly one facility exists; otherwise this returns null.
 */
export const readFacilityCapacity = async (runner: SqlRunner = pool): Promise<number | null> => {
  const result = await runner.query<{ capacity: number | string }>(
    'SELECT capacity FROM facilities ORDER BY created_at LIMIT 2',
  );
  const [facility, another] = result.rows;
  if (!facility || another) return null;
  return Number(facility.capacity);
};

export const countPetsPerNight = async (
  firstNight: string,
  lastNight: string,
  runner: SqlRunner = pool,
  excludeBookingId: string | null = null,
): Promise<NightOccupancy[]> => {
  const result = await runner.query<NightOccupancy>(PETS_PER_NIGHT_QUERY, [
    firstNight,
    lastNight,
    excludeBookingId,
  ]);
  return result.rows;
};

/** Held until the booking transaction ends; call it before counting inside that transaction. */
export const lockBookingCapacity = async (runner: SqlRunner): Promise<void> => {
  await runner.query('SELECT pg_advisory_xact_lock($1)', [CAPACITY_LOCK_KEY]);
};
