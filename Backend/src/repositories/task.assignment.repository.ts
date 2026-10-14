import { pool } from '../config/database.js';
import type { QueryResult } from 'pg';

export const findAvailableAssignments = async (
  petId: string,
  dueDatetime: string | null,
  excludeTaskId: string | null,
): Promise<QueryResult> => {
  return pool.query(
    `SELECT a.uuid::text AS assignment_id, a.employees_uuid::text AS staff_id,
        u.username AS staff_name, a.assignment_date, a.shift_start, a.shift_end
     FROM employee_assignments a JOIN users u ON u.uuid = a.employees_uuid
     WHERE a.pet_uuid = $1::uuid
      AND ($2::text IS NULL OR a.assignment_date = substring($2::text, 1, 10)::date)
      AND ($2::text IS NULL OR a.shift_start IS NULL OR substring($2::text, 12, 8)::time >= a.shift_start)
      AND ($2::text IS NULL OR a.shift_end IS NULL OR substring($2::text, 12, 8)::time < a.shift_end)
       AND ($2::timestamptz IS NULL OR NOT EXISTS (
         SELECT 1 FROM tasks existing
         WHERE existing.employees_uuid = a.employees_uuid AND existing.scheduled_at = $2::timestamptz
           AND existing.status <> 'cancelled'
           AND ($3::uuid IS NULL OR existing.uuid <> $3::uuid)
       ))
       AND ($2::timestamptz IS NULL OR NOT EXISTS (
         SELECT 1 FROM tasks existing
         WHERE existing.pet_uuid = a.pet_uuid AND existing.scheduled_at = $2::timestamptz
           AND existing.status <> 'cancelled' AND existing.employees_uuid <> a.employees_uuid
           AND ($3::uuid IS NULL OR existing.uuid <> $3::uuid)
       ))
    ORDER BY u.username`,
    [petId, dueDatetime, excludeTaskId],
  );
};

// Whether the given date falls inside ANY of this pet's approved bookings,
// not just the most recent one, since a pet can have several. `within_stay`
// stays NULL when the pet has no dated approved booking at all (nothing to
// check against), so callers keep treating "no data" differently from
// "has bookings, but not this date."
export const findPetStayForDate = (petId: string, dueDatetime: string): Promise<QueryResult> =>
  pool.query(
    `SELECT
       CASE
         WHEN NOT EXISTS (
           SELECT 1 FROM booking_pets bp
           WHERE bp.pet_uuid = $1::uuid
             AND bp.manager_review_status = 'approved'
             AND bp.drop_off_time IS NOT NULL
             AND bp.pick_up_time IS NOT NULL
         ) THEN NULL
         ELSE EXISTS (
           SELECT 1 FROM booking_pets bp
           WHERE bp.pet_uuid = $1::uuid
             AND bp.manager_review_status = 'approved'
             AND bp.drop_off_time IS NOT NULL
             AND bp.pick_up_time IS NOT NULL
             AND substring($2::text, 1, 10)::date BETWEEN
               (bp.drop_off_time AT TIME ZONE 'Pacific/Auckland')::date AND
               (bp.pick_up_time AT TIME ZONE 'Pacific/Auckland')::date
         )
       END AS within_stay`,
    [petId, dueDatetime],
  );
