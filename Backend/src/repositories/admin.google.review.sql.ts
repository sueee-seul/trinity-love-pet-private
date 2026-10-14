export const UNIQUE_REVIEWER_IDENTITY_JOIN = `
      LEFT JOIN (
        SELECT
          lower(display_name) AS normalized_display_name,
          MIN(email) AS email
        FROM reviewer_identities
        GROUP BY lower(display_name)
        HAVING COUNT(*) = 1
      ) reviewer_identity
        ON reviewer_identity.normalized_display_name = lower(review.reviewer_display_name)`;

export const GOOGLE_REVIEW_PROJECTION = `
       review.uuid::text AS id,
       review.reviewer_display_name,
       reviewer_identity.email AS reviewer_email,
       review.reviewer_profile_photo_url,
       review.reviewer_is_anonymous,
       review.rating,
       review.comment,
       review.google_created_at,
       review.google_updated_at,
       latest_reply.reply_body AS owner_reply,
       latest_reply.sent_at AS owner_reply_updated_at,
       COALESCE((SELECT array_agg(media.photo_url ORDER BY media.created_at)
          FROM google_review_media_logs media
          WHERE media.google_business_reviews_uuid = review.uuid), ARRAY[]::text[]) AS photo_urls,
       latest_manager_correction.event_payload AS manager_correction,
       external.is_read,
       external.current_status,
       external.assigned_employee_uuid::text AS assigned_employee_uuid`;

export const LATEST_REPLY_JOIN = `
       LEFT JOIN LATERAL (
         SELECT reply.reply_body, reply.sent_at
         FROM external_feedback_replies reply
         WHERE reply.external_feedback_uuid = external.uuid
           AND reply.reply_status = 'sent'
       ORDER BY reply.created_at DESC, reply.sent_at DESC, reply.uuid DESC
       LIMIT 1
       ) latest_reply ON true`;

export const LATEST_MANAGER_CORRECTION_JOIN = `
       LEFT JOIN LATERAL (
         SELECT event.event_payload
         FROM feedback_timeline_events event
         WHERE event.external_feedback_uuid = external.uuid
           AND event.step = 'manager_correction'
         ORDER BY event.created_at DESC, event.uuid DESC
         LIMIT 1
       ) latest_manager_correction ON true`;
