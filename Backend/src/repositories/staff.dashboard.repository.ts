import { pool } from '../config/database.js';
import type { QueryResult } from 'pg';

export type DashboardRange = 'today' | 'week' | 'month';

const SCHEDULED_UTC = "(t.scheduled_at AT TIME ZONE 'UTC')";
const NOW_AKL = "(NOW() AT TIME ZONE 'Pacific/Auckland')";
// A task is overdue only once this grace window past its scheduled time has passed
// (matches the 30-minute staff task gap). Exactly scheduled + 30 minutes is on time.
const OVERDUE_DEADLINE = `(${SCHEDULED_UTC} + interval '30 minutes')`;

//Filers for the date range of the dashboard
const rangeClause = (range: DashboardRange): string => {
  if (range === 'week') {
    return `t.scheduled_at IS NOT NULL AND date_trunc('week', ${SCHEDULED_UTC}) = date_trunc('week', ${NOW_AKL})`;
  }
  if (range === 'month') {
    return `t.scheduled_at IS NOT NULL AND date_trunc('month', ${SCHEDULED_UTC})= date_trunc('month', ${NOW_AKL})`;
  }
  return `t.scheduled_at IS NOT NULL AND ${SCHEDULED_UTC}::date = ${NOW_AKL}::date`;
};

//Manage overdue tasks for the dashboard
const OVERDUE = `(
    t.scheduled_at IS NOT NULL AND t.status <> 'cancelled'
    AND CASE
        WHEN t.status = 'completed' 
        THEN date_trunc('minute', t.completed_at AT TIME ZONE 'Pacific/Auckland') > ${OVERDUE_DEADLINE}
        ELSE date_trunc('minute', ${NOW_AKL}) > ${OVERDUE_DEADLINE}

    END
)`;

//Issue tasks for the dashboard
const ISSUE = `(
    btrim(coalesce(t.issue, '')) <> '' AND t.status NOT IN ('completed', 'cancelled') 
)`;

//Check working staff for the dashboard
const NOW_TXT = `to_char(now() AT TIME ZONE 'Pacific/Auckland', 'YYYY-MM-DD"T"HH24:MI:SS')`;
const ON_SHIFT = `EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
        CASE WHEN btrim(COALESCE(e.shift_details, '')) LIKE '[%'
             THEN e.shift_details::jsonb
             ELSE '[]'::jsonb END
    ) AS entry
    WHERE(
        (entry->>'start' IS NULL OR entry->>'finish' IS NULL)
        AND entry->>'date' = substring(${NOW_TXT}, 1, 10)
    )
    OR (
        (entry->>'finish')::time > (entry->>'start')::time
        AND entry->>'date' = substring(${NOW_TXT}, 1, 10)
        AND substring(${NOW_TXT}, 12, 8):: time >= (entry->>'start')::time
        AND substring(${NOW_TXT}, 12, 8):: time < (entry->>'finish')::time
    )
    OR (
        (entry->>'finish')::time <= (entry->>'start')::time 
        AND entry->>'date' = substring(${NOW_TXT}, 1, 10)
        AND substring(${NOW_TXT}, 12, 8):: time >= (entry->>'start')::time  
    )   
)`;

//Staff information for the dashboard
export const findStaffRollUp = (range: DashboardRange): Promise<QueryResult> => {
  const inRange = rangeClause(range);
  return pool.query(
    `SELECT
            u.uuid::text AS id,
            COALESCE(u.display_name, u.username) AS name,
            u.email AS email,
            e.employee_number AS employee_number,
            e.staff_role AS staff_role,
            e.employment_type AS employment_type,
            ${ON_SHIFT} AS on_shift,
            (count(t.uuid) FILTER(WHERE ${inRange} AND t.status <> 'cancelled')):: int AS tasks_total,
            (count(t.uuid) FILTER(WHERE ${inRange} AND t.status = 'completed')):: int AS tasks_done,
            (count(t.uuid) FILTER(
                WHERE ${inRange} AND ${OVERDUE} AND t.status NOT IN ('completed', 'cancelled')
            ))::int AS overdue,
            (count(t.uuid) FILTER( WHERE ${inRange} AND ${ISSUE}))::int AS issues
        FROM users u
        JOIN employees e ON e.users_uuid = u.uuid
        LEFT JOIN tasks t ON t.employees_uuid = u.uuid
        WHERE u.is_employee = TRUE AND e.staff_role = 'staff'
        GROUP BY u.uuid, u.display_name, u.username, u.email, e.employee_number, e.staff_role, e.employment_type, e.shift_details
        ORDER BY name`,
  );
};

export const countOverdueTasks = (range: DashboardRange): Promise<QueryResult> =>
  pool.query(
    `SELECT count(*)::int AS count
             FROM tasks t
             WHERE ${rangeClause(range)} 
                AND ${OVERDUE} 
                AND t.status NOT IN ('completed', 'cancelled')`,
  );

export const countOpenIssues = (range: DashboardRange): Promise<QueryResult> =>
  pool.query(
    `SELECT count(*)::int AS count
             FROM tasks t
             WHERE ${rangeClause(range)}
                AND ${ISSUE}`,
  );

//Staff detail page

//add work type, work status..

export const findStaffProfile = (staffId: string): Promise<QueryResult> =>
  pool.query(
    `SELECT
        u.uuid::text                        AS id,
        COALESCE(u.display_name, u.username) AS name,
        u.email                             AS email,
        e.employee_number                   AS employee_number,
        e.staff_role                        AS staff_role,
        e.employment_type                   AS employment_type,
        e.title                             AS notes,
        e.shift_details                     AS shift_details,
        ${ON_SHIFT}                         AS on_shift
     FROM users u
     JOIN employees e ON e.users_uuid = u.uuid
     WHERE u.uuid = $1 AND u.is_employee = TRUE`,
    [staffId],
  );

//Add done/overdue/pending, rate = done/ (done+ overdue + pending)
export const findCompletionBreakdown = (
  staffId: string,
  range: DashboardRange,
): Promise<QueryResult> => {
  const inRange = rangeClause(range);
  return pool.query(
    `SELECT
            count(*) FILTER (WHERE ${inRange} AND t.status = 'completed')::int AS done,
            count(*) FILTER (
              WHERE ${inRange} AND t.status NOT IN ('completed', 'cancelled') AND ${OVERDUE}
            )::int AS overdue,
            count(*) FILTER (
              WHERE ${inRange} AND t.status NOT IN ('completed', 'cancelled') AND NOT ${OVERDUE}
            )::int AS pending
        FROM tasks t
        WHERE t.employees_uuid = $1`,
    [staffId],
  );
};

//issue
export const findRecentIssues = (staffId: string, limit: number): Promise<QueryResult> =>
  pool.query(
    `SELECT
            t.uuid::text AS id,
            t.title      AS title,
            t.issue      AS issue,
            (t.status NOT IN ('completed', 'cancelled')) AS flagged,
            to_char(${SCHEDULED_UTC}, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS at
        FROM tasks t
        WHERE t.employees_uuid = $1
          AND btrim(coalesce(t.issue, '')) <> ''
        ORDER BY t.scheduled_at DESC NULLS LAST, t.created_at DESC
        LIMIT $2`,
    [staffId, limit],
  );

//filter today's task for each staff

export const findTodaysTasks = (staffId: string): Promise<QueryResult> =>
  pool.query(
    `SELECT
              t.uuid::text AS id,
              t.title      AS title,
              p.place      AS location,
              p.name       AS pet_name,
              to_char(${SCHEDULED_UTC}, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS scheduled_at,
              t.status     AS status,
              (${OVERDUE} AND t.status NOT IN ('completed', 'cancelled')) AS overdue,
              CASE
                WHEN t.status NOT IN ('completed', 'cancelled') AND date_trunc('minute', ${NOW_AKL}) > ${OVERDUE_DEADLINE}
                THEN floor(EXTRACT(EPOCH FROM (${NOW_AKL} - ${OVERDUE_DEADLINE})) / 60)::int
                ELSE NULL
              END AS overdue_minutes
          FROM tasks t
          LEFT JOIN pets p ON p.uuid = t.pet_uuid
          WHERE t.employees_uuid = $1
            AND t.scheduled_at IS NOT NULL
            AND ${SCHEDULED_UTC}::date = ${NOW_AKL}::date
          ORDER BY t.scheduled_at ASC`,
    [staffId],
  );
