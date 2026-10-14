import { pool } from '../config/database.js';
import type { Pool, PoolClient, QueryResult } from 'pg';

// ---------------------------------------------------------------------------
// Booking -> task generation
//
// Reads the parts of a booking that the "Task Connection in Pet profile" table
// turns into pet tasks (per-pet services + the intake questionnaire), so the
// task service can fan them out into `tasks` rows. Nothing here writes to the
// booking tables; it only reads them.
// ---------------------------------------------------------------------------

export const findBookingSummary = (bookingId: string): Promise<QueryResult> =>
  pool.query('SELECT status FROM bookings WHERE uuid = $1::uuid', [bookingId]);

export const findBookingTaskInputs = (bookingId: string): Promise<QueryResult> =>
  pool.query(
    `SELECT bp.pet_uuid::text AS pet_id,
            to_char(bp.drop_off_time AT TIME ZONE 'Pacific/Auckland', 'YYYY-MM-DD') AS drop_off_date,
            to_char(bp.pick_up_time AT TIME ZONE 'Pacific/Auckland', 'YYYY-MM-DD') AS pick_up_date,
            ci.feeding_routine,
            ci.medication_instructions,
            COALESCE(
              json_agg(json_build_object('name', s.name, 'category', s.category, 'price_unit', s.price_unit))
                FILTER (WHERE s.uuid IS NOT NULL),
              '[]'::json
            ) AS services
     FROM booking_pets bp
     LEFT JOIN booking_pets_caring_info ci ON ci.booking_pets_uuid = bp.uuid
     LEFT JOIN booking_pets_services bps ON bps.booking_pets_uuid = bp.uuid
     LEFT JOIN services s ON s.uuid = bps.services_uuid
     WHERE bp.bookings_uuid = $1::uuid
     GROUP BY bp.uuid, bp.pet_uuid, bp.drop_off_time, bp.pick_up_time, ci.feeding_routine, ci.medication_instructions
     ORDER BY bp.created_at`,
    [bookingId],
  );

// Same shape as findBookingTaskInputs, but scoped to a single booking_pets row
// instead of the whole booking. Needed because manager approval happens per
// pet (booking_pets_uuid), not per booking. Generating tasks for the whole
// booking here would also create tasks for sibling pets that aren't approved
// (or were refused) yet.
export const findBookingPetTaskInput = (bookingPetsUuid: string): Promise<QueryResult> =>
  pool.query(
    `SELECT bp.pet_uuid::text AS pet_id,
            to_char(bp.drop_off_time AT TIME ZONE 'Pacific/Auckland', 'YYYY-MM-DD') AS drop_off_date,
            to_char(bp.pick_up_time AT TIME ZONE 'Pacific/Auckland', 'YYYY-MM-DD') AS pick_up_date,
            ci.feeding_routine,
            ci.medication_instructions,
            COALESCE(
              json_agg(json_build_object('name', s.name, 'category', s.category, 'price_unit', s.price_unit))
                FILTER (WHERE s.uuid IS NOT NULL),
              '[]'::json
            ) AS services
     FROM booking_pets bp
     LEFT JOIN booking_pets_caring_info ci ON ci.booking_pets_uuid = bp.uuid
     LEFT JOIN booking_pets_services bps ON bps.booking_pets_uuid = bp.uuid
     LEFT JOIN services s ON s.uuid = bps.services_uuid
     WHERE bp.uuid = $1::uuid
     GROUP BY bp.uuid, bp.pet_uuid, bp.drop_off_time, bp.pick_up_time, ci.feeding_routine, ci.medication_instructions`,
    [bookingPetsUuid],
  );

// Inserts one generated task, but only when the same pet does not already have a
// task with that title on that day, so re-running the booking generation (approval,
// then check-in) is a no-op instead of piling up duplicates. Generated tasks carry
// no staff (employees_uuid NULL) and no template link (generated_from NULL); the
// schema allows both. `scheduledAt` is the day with its usual time ('YYYY-MM-DDTHH:MM:00Z'),
// or a date-only string cast to midnight when the task has no usual time (grooming); the
// manager can move either when fitting the task to a staff shift. The day, not the time, is compared: once a manager has moved the
// medication task to 08:00, a second midnight copy would be a second dose.
// scheduled_at holds Auckland wall-clock time in the UTC slot, so its day is read
// in UTC.
export const insertGeneratedTask = (
  petId: string,
  title: string,
  scheduledAt: string | null,
  description: string | null,
  issue: string | null,
  priority: string,
): Promise<QueryResult> =>
  pool.query(
    `INSERT INTO tasks (pet_uuid, title, task_type, priority, scheduled_at, description, issue, status)
     SELECT $1::uuid, $2::varchar, 'pet', $3, $4::timestamptz, $5, $6, 'pending'
     WHERE EXISTS (SELECT 1 FROM pets WHERE uuid = $1::uuid)
       AND NOT EXISTS (
         SELECT 1 FROM tasks
         WHERE pet_uuid = $1::uuid AND title = $2
           AND (scheduled_at AT TIME ZONE 'UTC')::date
               IS NOT DISTINCT FROM ($4::timestamptz AT TIME ZONE 'UTC')::date
       )
     RETURNING uuid`,
    [petId, title, priority, scheduledAt, description, issue],
  );

// When manager withdraw approved booking, deletes every task that falls inside this booking's own stay window, using the
// same date-range match findTasksForBookingPet reads by, since tasks carry no
// booking id to delete by directly. Used when a manager undoes an approval,
// so the generated tasks don't linger after the decision is reverted.
// `runner` is a transaction's client when the stay's dates are about to change in it: the window
// is read from booking_pets, so the delete must run before the new dates are written.
export const deleteTasksForBookingPet = (
  bookingPetsUuid: string,
  runner: Pool | PoolClient = pool,
): Promise<QueryResult> =>
  runner.query(
    `DELETE FROM tasks t
     USING booking_pets bp
     WHERE bp.uuid = $1::uuid
       AND t.pet_uuid = bp.pet_uuid
       AND t.scheduled_at BETWEEN bp.drop_off_time AND bp.pick_up_time
     RETURNING t.pet_uuid::text AS pet_id`,
    [bookingPetsUuid],
  );
