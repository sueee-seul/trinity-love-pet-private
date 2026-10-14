import { pool } from '../config/database.js';

/** A task row for KPI reports, including the staff-written delay reason (`issue`). */
export interface ReportTaskRow {
  id: string;
  title: string;
  status: string;
  priority: string;
  task_type: string;
  scheduled_at: string | null;
  completed_at: string | null;
  created_at: string;
  pet_name: string | null;
  staff_name: string | null;
  issue: string | null;
  category: string;
}

// Auckland wall-clock timestamp of scheduled_at (stored in the UTC slot).
const SCHEDULED_AKL = "(t.scheduled_at AT TIME ZONE 'UTC')";

/** Non-cancelled tasks whose Auckland scheduled date is within [startDate, endDate). */
export const findReportTasksScheduledBetween = async (
  startDate: string,
  endDate: string,
): Promise<ReportTaskRow[]> => {
  const result = await pool.query<ReportTaskRow>(
    `SELECT t.uuid::text AS id, t.title,t.category, t.status, t.priority, t.task_type,
            t.scheduled_at, t.completed_at, t.created_at, t.issue,
            p.name AS pet_name, u.username AS staff_name
     FROM tasks t
     LEFT JOIN pets p ON p.uuid = t.pet_uuid
     LEFT JOIN users u ON u.uuid = t.employees_uuid
     WHERE t.scheduled_at IS NOT NULL
       AND t.status <> 'cancelled'
       AND ${SCHEDULED_AKL} >= $1::date
       AND ${SCHEDULED_AKL} < $2::date`,
    [startDate, endDate],
  );
  return result.rows;
};

/** Non-cancelled tasks created within [startDate, endDate) in Auckland time. */
export const countTasksCreatedBetween = async (
  startDate: string,
  endDate: string,
): Promise<number> => {
  const result = await pool.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count
     FROM tasks t
     WHERE t.status <> 'cancelled'
       AND (t.created_at AT TIME ZONE 'Pacific/Auckland') >= $1::date
       AND (t.created_at AT TIME ZONE 'Pacific/Auckland') < $2::date`,
    [startDate, endDate],
  );
  return result.rows[0]?.count ?? 0;
};

/** Report recipients: employees with the manager role. */
export const findManagerEmails = async (): Promise<string[]> => {
  const result = await pool.query<{ email: string }>(
    `SELECT u.email
     FROM employees e
     JOIN users u ON u.uuid = e.users_uuid
     WHERE e.staff_role = 'manager'
     ORDER BY u.email`,
  );
  return result.rows.map((row) => row.email);
};
