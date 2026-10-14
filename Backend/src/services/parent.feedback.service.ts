import {
  type FeedbackInsights,
  type FeedbackNotificationInput,
  type FeedbackRatingDetails,
  type FeedbackType,
} from '../contracts/feedback.contract.js';
import * as staffService from './staff.service.js';
import { notifySuggestionManager } from './feedback.notification.service.js';
import { AppError } from '../common/middlewares/error.middleware.js';
import { calculateFeedbackRating, generateFeedbackInsights } from './feedback.service.js';
import { removeFeedbackAudio, saveFeedbackAudio } from './feedback.audio.storage.js';
import {
  createFeedbackRecord,
  findOwnedPetFeedbackContext,
  type FeedbackTimelineEventPayload,
} from '../repositories/feedback.repository.js';

interface FeedbackPayload {
  pet_uuid: string;
  category: FeedbackType;
  rating_details: FeedbackRatingDetails;
  raw_answer: string;
}

export interface CreatedFeedback {
  uuid: string;
  category: FeedbackType;
  rating: number;
  audio_url: string | null;
  transcript: string | null;
  ai_insights: FeedbackInsights;
}

export const createFeedback = async (
  payload: FeedbackPayload,
  ownerId: string,
  audioFile?: Express.Multer.File,
): Promise<CreatedFeedback> => {
  let feedbackContext: { parent_name: string; pet_name: string } | null;
  try {
    feedbackContext = await findOwnedPetFeedbackContext(payload.pet_uuid, ownerId);
  } catch {
    throw new AppError(
      'Feedback ownership could not be verified',
      'FEEDBACK_OWNERSHIP_UNAVAILABLE',
      503,
    );
  }

  if (!feedbackContext) {
    throw new AppError(
      'You can only submit feedback for your own pet',
      'FEEDBACK_OWNERSHIP_FORBIDDEN',
      403,
    );
  }

  const rating = calculateFeedbackRating(payload.rating_details);
  let insights;
  try {
    insights = await generateFeedbackInsights({
      ratingDetails: payload.rating_details,
      rawAnswer: payload.raw_answer,
      category: payload.category,
    });
  } catch (error: unknown) {
    console.error(
      'Feedback insight generation failed',
      error instanceof Error ? error.message : 'Unknown LLM error',
    );
    throw new AppError(
      'Feedback analysis is temporarily unavailable',
      'FEEDBACK_INSIGHTS_UNAVAILABLE',
      503,
    );
  }

  let audio_url: string | undefined;
  if (audioFile) {
    try {
      audio_url = await saveFeedbackAudio(audioFile);
    } catch (error: unknown) {
      console.error(
        'Feedback audio storage failed',
        error instanceof Error ? error.message : 'Unknown audio storage error',
      );
      throw new AppError(
        'Feedback audio storage is temporarily unavailable',
        'FEEDBACK_AUDIO_STORAGE_UNAVAILABLE',
        503,
      );
    }
  }

  const managerRecipient =
    payload.category === 'Suggestion' ? await staffService.getManagerRecipient() : null;
  const initialTimelineStep = payload.category === 'Suggestion' ? 'captured' : 'submitted';
  const initialEventPayload: FeedbackTimelineEventPayload = managerRecipient
    ? {
        workflow_type: 'suggestion',
        ownerId: managerRecipient.id,
        decision: null,
        evidenceSummary: null,
        decisionReason: null,
        nextReviewAt: null,
        actor: 'System',
      }
    : { actor: 'System' };

  let persistedFeedback: { uuid: string };
  try {
    persistedFeedback = await createFeedbackRecord({
      pet_uuid: payload.pet_uuid,
      pet_owners_uuid: ownerId,
      category: payload.category,
      rating,
      rating_details: payload.rating_details,
      raw_answer: payload.raw_answer,
      audio_url: audio_url ?? null,
      ai_insights: insights,
      initial_timeline_step: initialTimelineStep,
      initial_event_payload: initialEventPayload,
    });
  } catch (error: unknown) {
    if (audio_url) {
      await removeFeedbackAudio(audio_url);
    }
    console.error(
      'Feedback persistence failed',
      error instanceof Error ? error.message : 'Unknown database error',
    );
    throw new AppError('Feedback could not be saved', 'FEEDBACK_PERSISTENCE_UNAVAILABLE', 503);
  }

  const createdFeedback: CreatedFeedback = {
    uuid: persistedFeedback.uuid,
    category: payload.category,
    rating,
    audio_url: audio_url ?? null,
    transcript: null,
    ai_insights: insights,
  };

  if (managerRecipient) {
    const notificationFeedback: FeedbackNotificationInput = {
      uuid: createdFeedback.uuid,
      parentName: feedbackContext.parent_name,
      petName: feedbackContext.pet_name,
      serviceType: '',
      aiSummary: insights.summary,
    };
    await notifySuggestionManager(notificationFeedback, managerRecipient);
  }

  return createdFeedback;
};
