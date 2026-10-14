import { pool } from '../config/database.js';
import type { QueryResult } from 'pg';

// A task is overdue only once this grace window past its scheduled time has passed
// (matches the 30-minute staff task gap). Exactly scheduled + 30 minutes is on time.
const OVERDUE_DEADLINE = "((t.scheduled_at AT TIME ZONE 'UTC') + interval '30 minutes')";

const taskSelect = `
  SELECT t.uuid::text AS id, t.task_type, t.title, t.status, t.priority,
         t.scheduled_at AS due_datetime, t.description, t.issue,
         (t.scheduled_at IS NOT NULL AND t.status <> 'cancelled'
          AND CASE
                WHEN t.status = 'completed'
                  THEN date_trunc('minute', t.completed_at AT TIME ZONE 'Pacific/Auckland') > ${OVERDUE_DEADLINE}
                ELSE date_trunc('minute', NOW() AT TIME ZONE 'Pacific/Auckland') > ${OVERDUE_DEADLINE}
              END) AS overdue,
         a.uuid::text AS assignment_id, t.employees_uuid::text AS staff_id,
         p.uuid::text AS pet_id, p.name AS pet_name,
         CONCAT_WS(' ', po.first_name, po.last_name) AS owner_name,
         employee_user.username AS staff_name,
         dr.title AS template_title,
         (SELECT COALESCE(
            json_agg(
              json_build_object(
                'stored_name', m.photo_url,
                'name', m.caption,
                'at', to_char(m.created_at AT TIME ZONE 'UTC', 'YYYYMMDDHH24MISS')
              )
              ORDER BY m.created_at
            ),
            '[]'::json
          )
          FROM media_logs m WHERE m.tasks_uuid = t.uuid) AS photos
  FROM tasks t
  JOIN pets p ON p.uuid = t.pet_uuid
  JOIN pet_owners po ON po.users_uuid = p.pet_owners_uuid
  LEFT JOIN LATERAL (
    SELECT ea.uuid
    FROM employee_assignments ea
    WHERE ea.pet_uuid = t.pet_uuid
      AND ea.employees_uuid = t.employees_uuid
      AND (t.scheduled_at IS NULL OR ea.assignment_date = t.scheduled_at::date)
    ORDER BY ea.assignment_date DESC, ea.created_at DESC
    LIMIT 1
  ) a ON TRUE
  LEFT JOIN users employee_user ON employee_user.uuid = t.employees_uuid
  LEFT JOIN daily_routine dr ON dr.uuid = t.generated_from
  WHERE t.uuid = $1::uuid`;

export type StaffTaskRange = 'today' | 'week' | 'month';
export type PetTaskRange = 'all' | StaffTaskRange;

// Constrain a task to the current day / ISO week / calendar month. Returns null
// for 'all' (no filter).
//
// scheduled_at holds the wall-clock time the manager typed, stored verbatim as
// UTC (the write session is UTC and the datetime-local value carries no zone),
// the same value formatTaskTime() renders back literally. So read its day from
// the UTC fields, and compare against the facility's real current date
// (Pacific/Auckland). Anything else drifts a task typed for "Sep 3, 12:40" into
// Sep 4 for a UTC+12/13 facility.
const rangePredicate = (range: PetTaskRange): string | null => {
  if (range === 'all') return null;
  const scheduled = "(t.scheduled_at AT TIME ZONE 'UTC')";
  const today = "(NOW() AT TIME ZONE 'Pacific/Auckland')";
  if (range === 'week') return `date_trunc('week', ${scheduled}) = date_trunc('week', ${today})`;
  if (range === 'month') return `date_trunc('month', ${scheduled}) = date_trunc('month', ${today})`;
  return `${scheduled}::date = ${today}::date`;
};

export const findPetTasks = (petId: string, range: PetTaskRange = 'all'): Promise<QueryResult> => {
  const predicate = rangePredicate(range);
  return pool.query(
    `${taskSelect.replace(
      'WHERE t.uuid = $1::uuid',
      `WHERE t.pet_uuid = $1::uuid${predicate ? ` AND ${predicate}` : ''}`,
    )} ORDER BY due_datetime NULLS LAST`,
    [petId],
  );
};

export const findNextPetTaskToday = (petId: string): Promise<QueryResult> =>
  pool.query(
    `SELECT uuid::text AS id, title, task_type, scheduled_at AS due_datetime,
            description, status,
            (SELECT COALESCE(json_agg(json_build_object('stored_name', m.photo_url, 'name', m.caption)
                                      ORDER BY m.created_at), '[]'::json)
             FROM media_logs m WHERE m.tasks_uuid = tasks.uuid) AS photos
     FROM tasks
     WHERE tasks.pet_uuid = $1::uuid
       AND scheduled_at IS NOT NULL
       AND status NOT IN ('completed', 'cancelled')
       AND (scheduled_at AT TIME ZONE 'UTC')::date =
           (NOW() AT TIME ZONE 'Pacific/Auckland')::date
       AND (scheduled_at AT TIME ZONE 'UTC') >= NOW() AT TIME ZONE 'Pacific/Auckland'
     ORDER BY scheduled_at ASC
     LIMIT 1`,
    [petId],
  );

export const findLatestPetTask = (petId: string): Promise<QueryResult> =>
  pool.query(
    `SELECT t.uuid::text AS id, t.title, t.task_type, t.scheduled_at AS due_datetime,
            t.completed_at, t.description, t.status,
            (SELECT COALESCE(json_agg(json_build_object('stored_name', m.photo_url, 'name', m.caption)
                                      ORDER BY m.created_at), '[]'::json)
             FROM media_logs m WHERE m.tasks_uuid = t.uuid) AS photos
     FROM tasks t
     WHERE t.pet_uuid = $1::uuid
       AND t.status = 'completed'
       AND (t.completed_at IS NOT NULL OR t.scheduled_at IS NOT NULL)
     ORDER BY t.completed_at DESC NULLS LAST, t.scheduled_at DESC
     LIMIT 1`,
    [petId],
  );

export const findStaffTasks = (
  staffId: string,
  range: StaffTaskRange = 'today',
): Promise<QueryResult> =>
  pool.query(
    `${taskSelect.replace(
      'WHERE t.uuid = $1::uuid',
      `WHERE t.employees_uuid = $1::uuid AND ${rangePredicate(range)}`,
    )} ORDER BY due_datetime NULLS LAST`,
    [staffId],
  );

export const findTask = (taskId: string): Promise<QueryResult> =>
  pool.query(
    `SELECT t.*, a.uuid::text AS assignment_id
     FROM tasks t
     LEFT JOIN LATERAL (
       SELECT ea.uuid
       FROM employee_assignments ea
       WHERE ea.pet_uuid = t.pet_uuid AND ea.employees_uuid = t.employees_uuid
       ORDER BY ea.assignment_date DESC, ea.created_at DESC
       LIMIT 1
     ) a ON TRUE
     WHERE t.uuid = $1::uuid`,
    [taskId],
  );
export const findTaskPetOwner = (taskId: string): Promise<QueryResult> =>
  pool.query(
    `SELECT p.pet_owners_uuid::text AS pet_owners_uuid
     FROM tasks t JOIN pets p ON p.uuid = t.pet_uuid
     WHERE t.uuid = $1::uuid`,
    [taskId],
  );

export const findTaskWithDetails = (taskId: string): Promise<QueryResult> =>
  pool.query(taskSelect, [taskId]);
export const findTemplates = (): Promise<QueryResult> =>
  pool.query(
    'SELECT uuid::text AS id, title, category FROM daily_routine WHERE is_active = TRUE ORDER BY category, title',
  );

export const findTaskStaff = (): Promise<QueryResult> =>
  pool.query(
    `SELECT u.uuid::text AS id, u.username AS name
     FROM users u
     JOIN employees e ON e.users_uuid = u.uuid
     WHERE u.is_employee = TRUE
     ORDER BY u.username`,
  );

// Tasks carry no booking id, so scope to one stay by bounding scheduled_at to
// that booking_pets row's own drop_off_time..pick_up_time window instead
// (same trick petparent.livecare.repository.ts's findDayTasks uses).
export const findTasksForBookingPet = (bookingPetsUuid: string): Promise<QueryResult> =>
  pool.query(
    `${taskSelect.replace(
      'WHERE t.uuid = $1::uuid',
      `JOIN booking_pets bp ON bp.pet_uuid = t.pet_uuid
       WHERE bp.uuid = $1::uuid
         AND t.scheduled_at BETWEEN bp.drop_off_time AND bp.pick_up_time`,
    )} ORDER BY due_datetime NULLS LAST`,
    [bookingPetsUuid],
  );
