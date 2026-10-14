import { pool } from '../config/database.js';
import { SUGGESTION_WORKFLOW_STATUSES } from '../contracts/feedback.contract.js';
import { buildAdminFeedbackDetailQuery } from './admin.feedback.sql.js';
import type {
  AdminFeedbackDetailRecord,
  AdminFeedbackListQuery,
  AdminFeedbackListRecord,
  AdminFeedbackListSort,
  EmployeeStaffOptionRecord,
} from './admin.feedback.repository.types.js';

const SORT_EXPRESSIONS: Record<AdminFeedbackListSort, string> = {
  newest: 'f.created_at DESC, f.uuid DESC',
  oldest: 'f.created_at ASC, f.uuid ASC',
  highest: 'f.rating DESC, f.created_at DESC, f.uuid DESC',
  lowest: 'f.rating ASC, f.created_at ASC, f.uuid ASC',
};

export const listAdminFeedbackRecords = async (
  query: AdminFeedbackListQuery,
): Promise<AdminFeedbackListRecord[]> => {
  const whereClauses: string[] = [];
  const values: unknown[] = [];

  const addValue = (value: string | number): string => {
    values.push(value);
    return `$${values.length}`;
  };

  const addArrayValue = (value: readonly string[]): string => {
    values.push([...value]);
    return `$${values.length}`;
  };

  const searchTerm = query.search?.trim();
  if (searchTerm) {
    const searchParameter = addValue(`%${searchTerm}%`);
    whereClauses.push(
      `(CONCAT_WS(' ', po.first_name, po.last_name) ILIKE ${searchParameter}
        OR p.name ILIKE ${searchParameter}
        OR COALESCE(f.raw_answer, '') ILIKE ${searchParameter}
        OR COALESCE(f.ai_insights ->> 'summary', '') ILIKE ${searchParameter})`,
    );
  }

  if (query.category) {
    whereClauses.push(`f.category = ${addValue(query.category)}`);
  }

  if (query.status === 'unread') {
    whereClauses.push('f.is_read = false');
  } else if (query.status === 'read') {
    whereClauses.push('f.is_read = true');
  }

  if (query.timeRange === 'last_7_days') {
    whereClauses.push("f.created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'");
  } else if (query.timeRange === 'last_30_days') {
    whereClauses.push("f.created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'");
  } else if (query.timeRange === 'custom' && query.dateFrom && query.dateTo) {
    const dateFromParameter = addValue(query.dateFrom);
    const dateToParameter = addValue(query.dateTo);
    whereClauses.push(
      `f.created_at >= (${dateFromParameter}::date AT TIME ZONE 'Pacific/Auckland')`,
    );
    whereClauses.push(
      `f.created_at < ((${dateToParameter}::date + INTERVAL '1 day') AT TIME ZONE 'Pacific/Auckland')`,
    );
  }

  if (query.ratingMin !== undefined && query.ratingMax !== undefined) {
    const ratingMinParameter = addValue(query.ratingMin);
    const ratingMaxParameter = addValue(query.ratingMax);
    whereClauses.push(`f.rating >= ${ratingMinParameter}`);
    whereClauses.push(`f.rating <= ${ratingMaxParameter}`);
  } else if (query.rating === 'low') {
    whereClauses.push('f.rating <= 2');
  } else if (query.rating === 'medium') {
    whereClauses.push('f.rating > 2 AND f.rating < 4');
  } else if (query.rating === 'high') {
    whereClauses.push('f.rating >= 4');
  }

  const suggestionStatusesParameter = addArrayValue(SUGGESTION_WORKFLOW_STATUSES);
  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join('\n       AND ')}` : '';
  const result = await pool.query<AdminFeedbackListRecord>(
    `SELECT
       f.uuid::text AS uuid,
       CONCAT_WS(' ', po.first_name, po.last_name) AS parent_name,
       COALESCE(p.name, 'Deleted pet') AS pet_name,
       f.created_at,
       f.category,
       f.is_read,
       f.current_status,
       f.rating::double precision AS rating,
       COALESCE(f.ai_insights ->> 'summary', '') AS ai_summary,
       (
         SELECT assignment_event.employees_uuid::text
         FROM feedback_timeline_events assignment_event
         WHERE assignment_event.feedback_uuid = f.uuid
           AND assignment_event.step = 'assigned'
       ) AS assignee_uuid,
       CASE WHEN f.category = 'Suggestion' THEN (
         SELECT json_build_object(
           'status', suggestion_event.step,
           'decision', suggestion_event.event_payload ->> 'decision'
         )
         FROM feedback_timeline_events suggestion_event
         WHERE suggestion_event.feedback_uuid = f.uuid
           AND suggestion_event.step = ANY(${suggestionStatusesParameter}::varchar[])
         ORDER BY suggestion_event.created_at DESC, suggestion_event.step DESC
         LIMIT 1
       ) ELSE NULL END AS suggestion_workflow
     FROM feedback f
     -- LEFT: feedback stays on record after the parent deletes the pet's profile.
     LEFT JOIN pets p ON p.uuid = f.pet_uuid
     JOIN pet_owners po ON po.users_uuid = f.pet_owners_uuid
     ${whereSql}
     ORDER BY ${SORT_EXPRESSIONS[query.sort]}`,
    values,
  );

  return result.rows;
};

export const getAdminFeedbackRecord = async (
  feedbackUuid: string,
): Promise<AdminFeedbackDetailRecord | null> => {
  const result = await pool.query<AdminFeedbackDetailRecord>(
    buildAdminFeedbackDetailQuery({ whereSql: 'WHERE f.uuid = $1::uuid', limitOne: true }),
    [feedbackUuid],
  );

  return result.rows[0] ?? null;
};

export const listAdminFeedbackDetailRecords = async (): Promise<AdminFeedbackDetailRecord[]> => {
  const result = await pool.query<AdminFeedbackDetailRecord>(
    buildAdminFeedbackDetailQuery({ orderBySql: 'ORDER BY f.created_at DESC, f.uuid DESC' }),
  );

  return result.rows;
};

export const listEmployeeStaffOptions = async (): Promise<EmployeeStaffOptionRecord[]> => {
  const result = await pool.query<EmployeeStaffOptionRecord>(
    `SELECT
       u.uuid::text AS id,
       u.username AS name
     FROM users u
     JOIN employees e ON e.users_uuid = u.uuid
     WHERE u.is_employee = TRUE
     ORDER BY u.username ASC`,
  );

  return result.rows;
};
