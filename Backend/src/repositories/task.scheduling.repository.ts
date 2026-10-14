import { pool } from '../config/database.js';
import type { QueryResult } from 'pg';

// A staff member's tasks must be at least this far apart. Two tasks closer than
// this (in either direction) count as a scheduling conflict for that person.
const STAFF_TASK_GAP = "interval '30 minutes'";

// Whether one employees.shift_details JSON `entry` covers the task datetime held
// in $1 (text 'YYYY-MM-DD"T"HH:MM:SS'). A row missing either bound is a legacy
// entry and counts as the whole day it is dated for. A normal shift
// (finish > start) covers start <= time < finish on its date. An overnight shift
// (finish <= start) covers time >= start on its date plus time < finish on the
// day after. finish == start reads as a full 24h wrap. Shared by the free-staff
// list and the single-staff check so both apply the same rule.
const SHIFT_ENTRY_COVERS_DUE = `(
       (entry->>'start' IS NULL OR entry->>'finish' IS NULL)
       AND entry->>'date' = substring($1::text, 1, 10)
     )
  OR (
       (entry->>'finish')::time > (entry->>'start')::time
       AND entry->>'date' = substring($1::text, 1, 10)
       AND substring($1::text, 12, 8)::time >= (entry->>'start')::time
       AND substring($1::text, 12, 8)::time <  (entry->>'finish')::time
     )
  OR (
       (entry->>'finish')::time <= (entry->>'start')::time
       AND entry->>'date' = substring($1::text, 1, 10)
       AND substring($1::text, 12, 8)::time >= (entry->>'start')::time
     )
  OR (
       (entry->>'finish')::time <= (entry->>'start')::time
       AND entry->>'date' = to_char(
             substring($1::text, 1, 10)::date - INTERVAL '1 day', 'YYYY-MM-DD')
       AND substring($1::text, 12, 8)::time < (entry->>'finish')::time
     )`;

export const findAssignmentSlot = (
  assignmentId: string,
  petId: string,
  dueDatetime: string | null,
  excludeTaskId: string | null,
): Promise<QueryResult> =>
  pool.query(
    `SELECT a.uuid FROM employee_assignments a WHERE a.uuid = $1::uuid AND a.pet_uuid = $2::uuid
    AND ($3::text IS NULL OR a.assignment_date = substring($3::text, 1, 10)::date)
    AND ($3::text IS NULL OR a.shift_start IS NULL OR substring($3::text, 12, 8)::time >= a.shift_start)
    AND ($3::text IS NULL OR a.shift_end IS NULL OR substring($3::text, 12, 8)::time < a.shift_end)
   AND ($3::timestamptz IS NULL OR NOT EXISTS (
     SELECT 1 FROM tasks existing WHERE existing.employees_uuid = a.employees_uuid
       AND existing.scheduled_at > $3::timestamptz - ${STAFF_TASK_GAP}
       AND existing.scheduled_at < $3::timestamptz + ${STAFF_TASK_GAP}
       AND existing.status <> 'cancelled'
       AND ($4::uuid IS NULL OR existing.uuid <> $4::uuid)))`,
    [assignmentId, petId, dueDatetime, excludeTaskId],
  );

export const findPetTimeConflict = (
  petId: string,
  dueDatetime: string,
  excludeTaskId: string | null,
): Promise<QueryResult> =>
  pool.query(
    `SELECT 1 FROM tasks existing WHERE existing.pet_uuid = $1::uuid AND existing.scheduled_at = $2::timestamptz
     AND existing.status <> 'cancelled' AND ($3::uuid IS NULL OR existing.uuid <> $3::uuid)`,
    [petId, dueDatetime, excludeTaskId],
  );

// Staff (not managers) whose Staff Shift Table roster actually covers the task's
// date AND time, minus anyone already on a task within 30 minutes of that time.
// The shift table is a JSON array in employees.shift_details (see
// staff.shift.repository); legacy prose values never match the '[' guard and so
// contribute no roster days. An entry counts as covering the task time when:
//   - it is dated for the task day and start/finish is missing (legacy row) -> whole day;
//   - normal shift (finish > start): dated for the task day and start <= time < finish;
//   - overnight shift (finish <= start): the evening part is dated for the task
//     day (time >= start), the morning part is dated for the day before
//     (time < finish). finish == start is read as a full 24h wrap.
// The matched entry's hours ride along so the picker can show "name (09:00-17:00)".
export const findFreeStaff = (
  dueDatetime: string,
  excludeTaskId: string | null,
): Promise<QueryResult> =>
  pool.query(
    `SELECT u.uuid::text AS id, u.username AS name,
            shift.entry->>'start' AS shift_start,
            shift.entry->>'finish' AS shift_end
     FROM users u
     JOIN employees e ON e.users_uuid = u.uuid
     JOIN LATERAL (
       SELECT entry
       FROM jsonb_array_elements(
              CASE WHEN btrim(COALESCE(e.shift_details, '')) LIKE '[%'
                   THEN e.shift_details::jsonb
                   ELSE '[]'::jsonb END
            ) AS entry
       WHERE ${SHIFT_ENTRY_COVERS_DUE}
       ORDER BY entry->>'date' DESC, entry->>'start' NULLS FIRST
       LIMIT 1
     ) shift ON TRUE
     WHERE u.is_employee = TRUE
       AND e.staff_role = 'staff'
       AND NOT EXISTS (
         SELECT 1 FROM tasks existing
         WHERE existing.employees_uuid = u.uuid
           AND existing.scheduled_at > $1::timestamptz - ${STAFF_TASK_GAP}
           AND existing.scheduled_at < $1::timestamptz + ${STAFF_TASK_GAP}
           AND existing.status <> 'cancelled'
           AND ($2::uuid IS NULL OR existing.uuid <> $2::uuid)
       )
     ORDER BY u.username`,
    [dueDatetime, excludeTaskId],
  );

// One-staff version of the findFreeStaff roster check: does this staff member's
// Staff Shift Table (employees.shift_details JSON) have an entry that covers the
// task's date AND time? Same coverage rule, including overnight shifts.
export const findStaffShiftInRoster = (
  dueDatetime: string,
  staffId: string,
): Promise<QueryResult> =>
  pool.query(
    `SELECT 1
     FROM users u
     JOIN employees e ON e.users_uuid = u.uuid
     JOIN LATERAL (
       SELECT 1
       FROM jsonb_array_elements(
              CASE WHEN btrim(COALESCE(e.shift_details, '')) LIKE '[%'
                   THEN e.shift_details::jsonb
                   ELSE '[]'::jsonb END
            ) AS entry
       WHERE ${SHIFT_ENTRY_COVERS_DUE}
       LIMIT 1
     ) shift ON TRUE
     WHERE u.uuid = $2::uuid
       AND u.is_employee = TRUE
       AND e.staff_role = 'staff'
     LIMIT 1`,
    [dueDatetime, staffId],
  );

// Check the staff member has a shift on that date whose window covers the task time
export const findStaffShift = (staffId: string, dueDatetime: string): Promise<QueryResult> =>
  pool.query(
    `SELECT 1 FROM employee_assignments ea
     WHERE ea.employees_uuid = $1::uuid
       AND ea.assignment_date = substring($2::text, 1, 10)::date
       AND (ea.shift_start IS NULL OR substring($2::text, 12, 8)::time >= ea.shift_start)
       AND (ea.shift_end IS NULL OR substring($2::text, 12, 8)::time < ea.shift_end)
     LIMIT 1`,
    [staffId, dueDatetime],
  );

// 2) Check if the staff has already current task at the same time, or if the pet has another task at the same time with a different staff member
export const findStaffTimeConflict = (
  staffId: string,
  dueDatetime: string,
  excludeTaskId: string | null,
): Promise<QueryResult> =>
  pool.query(
    `SELECT 1 FROM tasks existing WHERE existing.employees_uuid = $1::uuid
     AND existing.scheduled_at > $2::timestamptz - ${STAFF_TASK_GAP}
     AND existing.scheduled_at < $2::timestamptz + ${STAFF_TASK_GAP}
     AND existing.status <> 'cancelled'
     AND ($3::uuid IS NULL OR existing.uuid <> $3::uuid)`,
    [staffId, dueDatetime, excludeTaskId],
  );

// Check whether the task due date is in the past
export const findIsPastDueDatetime = (dueDatetime: string): Promise<QueryResult> =>
  pool.query(`SELECT (NOW() AT TIME ZONE 'Pacific/Auckland')> $1::timestamp AS is_past`, [
    dueDatetime,
  ]);
