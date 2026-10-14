export const ADMIN_FEEDBACK_TIMELINE_AGGREGATION = `
       COALESCE(
         json_agg(
           json_build_object(
             'step', timeline.step,
             'created_at', timeline.created_at,
             'actor', COALESCE(
               timeline.event_payload ->> 'actorId',
               timeline.event_payload ->> 'actor',
               employee_user.username,
               'System'
             ),
             'event_payload', COALESCE(timeline.event_payload, '{}'::jsonb)
           )
           ORDER BY timeline.created_at
         ) FILTER (WHERE timeline.feedback_uuid IS NOT NULL),
         '[]'::json
       ) AS timeline`;

export const ADMIN_FEEDBACK_DETAIL_PROJECTION = `
       f.uuid::text AS uuid,
       CONCAT_WS(' ', po.first_name, po.last_name) AS parent_name,
       COALESCE(p.name, 'Deleted pet') AS pet_name,
       f.created_at,
       f.category,
       f.is_read,
       f.current_status,
       f.rating::double precision AS rating,
       f.rating_details,
       f.raw_answer,
       f.transcript,
       f.audio_url,
       f.ai_insights,
       (
         SELECT assignment_event.employees_uuid::text
         FROM feedback_timeline_events assignment_event
         WHERE assignment_event.feedback_uuid = f.uuid
           AND assignment_event.step = 'assigned'
         ORDER BY assignment_event.created_at DESC
         LIMIT 1
       ) AS assignee_uuid,${ADMIN_FEEDBACK_TIMELINE_AGGREGATION}`;

const ADMIN_FEEDBACK_DETAIL_FROM = `
     FROM feedback f
     -- LEFT: feedback stays on record after the parent deletes the pet's profile.
     LEFT JOIN pets p ON p.uuid = f.pet_uuid
     JOIN pet_owners po ON po.users_uuid = f.pet_owners_uuid
     LEFT JOIN feedback_timeline_events timeline ON timeline.feedback_uuid = f.uuid
     LEFT JOIN users employee_user ON employee_user.uuid = timeline.employees_uuid`;

export interface AdminFeedbackDetailQueryOptions {
  whereSql?: string;
  orderBySql?: string;
  limitOne?: boolean;
}

export const buildAdminFeedbackDetailQuery = ({
  whereSql = '',
  orderBySql = '',
  limitOne = false,
}: AdminFeedbackDetailQueryOptions = {}): string => `${`SELECT${ADMIN_FEEDBACK_DETAIL_PROJECTION}${ADMIN_FEEDBACK_DETAIL_FROM}`} ${whereSql}
     GROUP BY f.uuid, p.name, po.first_name, po.last_name
     ${orderBySql}${limitOne ? '\n     LIMIT 1' : ''}`;
