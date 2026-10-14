import { pool } from '../config/database.js';
import type { QueryResult } from 'pg';

export const insertTask = (values: unknown[]): Promise<QueryResult> =>
  pool.query(
    `INSERT INTO tasks (pet_uuid, employees_uuid, generated_from, title, task_type, priority, scheduled_at, description, issue)
     SELECT $1::uuid, a.employees_uuid, $3::uuid, $4, $5, $6, $7, $8, $9
     FROM employee_assignments a WHERE a.uuid = $2::uuid AND a.pet_uuid = $1::uuid
     RETURNING uuid`,
    values,
  );
/**
 * Updates a task; null values keep the current column value.
 *
 * completed_at follows status so KPI charts stay consistent with the
 * Task Timeline dropdown, which saves through this path rather than
 * completeTaskRecord:
 * - first move to 'completed'        → NOW()
 * - move away from 'completed'       → NULL (no longer completed)
 * - no status change / already done  → unchanged
 * `status` on the right-hand side is the pre-update value in PostgreSQL.
 */
export const updateTaskRecord = (taskId: string, values: unknown[]): Promise<QueryResult> =>
  pool.query(
    `UPDATE tasks SET title = COALESCE($2, title), task_type = COALESCE($3, task_type), priority = COALESCE($4, priority),
  scheduled_at = COALESCE($5, scheduled_at), status = COALESCE($6, status),
  completed_at = CASE
    WHEN $6::varchar = 'completed' AND status <> 'completed' THEN NOW()
    WHEN $6::varchar <> 'completed' AND status = 'completed' THEN NULL
    ELSE completed_at
  END,
  description = COALESCE($7, description), issue = COALESCE($8, issue),
  employees_uuid = COALESCE($10::uuid, (SELECT employees_uuid FROM employee_assignments WHERE uuid = $9::uuid), employees_uuid)
  WHERE uuid = $1::uuid RETURNING uuid`,
    [taskId, ...values],
  );

export const completeTaskRecord = (taskId: string): Promise<QueryResult> =>
  pool.query("UPDATE tasks SET status = 'completed', completed_at = NOW() WHERE uuid = $1::uuid", [
    taskId,
  ]);
export const deleteTaskRecord = (taskId: string): Promise<QueryResult> =>
  pool.query('DELETE FROM tasks WHERE uuid = $1::uuid RETURNING uuid', [taskId]);

// 3) Create task using employees_uuid without employee_assignments
export const insertAdHocTask = (values: unknown[]): Promise<QueryResult> =>
  pool.query(
    `INSERT INTO tasks (pet_uuid, employees_uuid, generated_from, title, task_type, priority, scheduled_at, description, issue)
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9)
     RETURNING uuid`,
    values,
  );
