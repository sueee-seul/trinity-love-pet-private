import { pool } from '../config/database.js';
import { withDatabaseTransaction } from '../common/utils/database-transaction.js';
import type {
  FeedbackInsights,
  FeedbackRatingDetails,
  FeedbackType,
} from '../contracts/feedback.contract.js';

export interface CreateFeedbackRecordInput {
  pet_uuid: string;
  pet_owners_uuid: string;
  category: FeedbackType;
  rating: number;
  rating_details: FeedbackRatingDetails;
  raw_answer: string;
  audio_url: string | null;
  ai_insights: FeedbackInsights;
  initial_timeline_step: 'submitted' | 'captured';
  initial_event_payload: FeedbackTimelineEventPayload;
}

export type FeedbackTimelineEventPayload =
  | {
      actor: 'System';
    }
  | {
      workflow_type: 'suggestion';
      ownerId: string;
      decision: null;
      evidenceSummary: null;
      decisionReason: null;
      nextReviewAt: null;
      actor: 'System';
    };

export interface CreatedFeedbackRecord {
  uuid: string;
}

export interface OwnedPetFeedbackContext {
  parent_name: string;
  pet_name: string;
}

export const findOwnedPetFeedbackContext = async (
  petUuid: string,
  ownerUuid: string,
): Promise<OwnedPetFeedbackContext | null> => {
  const result = await pool.query<OwnedPetFeedbackContext>(
    `SELECT concat_ws(' ', po.first_name, po.last_name) AS parent_name,
            p.name AS pet_name
     FROM pets p
     JOIN pet_owners po ON po.users_uuid = p.pet_owners_uuid
     WHERE p.uuid = $1::uuid
       AND po.users_uuid = $2::uuid
     LIMIT 1`,
    [petUuid, ownerUuid],
  );

  return result.rows[0] ?? null;
};

export const createFeedbackRecord = async (
  input: CreateFeedbackRecordInput,
): Promise<CreatedFeedbackRecord> => {
  return withDatabaseTransaction(async (client) => {
    const result = await client.query<CreatedFeedbackRecord>(
      `INSERT INTO feedback (
        pet_uuid,
        pet_owners_uuid,
        category,
        current_status,
        rating,
        rating_details,
        raw_answer,
        audio_url,
        ai_insights
      )
      VALUES ($1, $2, $3, 'submitted', $4, $5::jsonb, $6, $7, $8::jsonb)
      RETURNING uuid`,
      [
        input.pet_uuid,
        input.pet_owners_uuid,
        input.category,
        input.rating,
        JSON.stringify(input.rating_details),
        input.raw_answer,
        input.audio_url,
        JSON.stringify(input.ai_insights),
      ],
    );

    const createdRecord = result.rows[0];
    if (!createdRecord) {
      throw new Error('Feedback insert returned no UUID');
    }

    await client.query(
      `INSERT INTO feedback_timeline_events (
        feedback_uuid,
        step,
        event_payload
      )
      VALUES ($1::uuid, $2, $3::jsonb)`,
      [
        createdRecord.uuid,
        input.initial_timeline_step,
        JSON.stringify(input.initial_event_payload),
      ],
    );

    return { transaction: 'commit', value: createdRecord };
  });
};
