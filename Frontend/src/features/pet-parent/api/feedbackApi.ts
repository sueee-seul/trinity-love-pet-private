import { API_BASE_URL } from '../../../shared/api';
import {
  RATING_CATEGORIES,
  type FeedbackRatings,
  type FeedbackType,
} from '../../../shared/types/feedback';

export interface SubmitFeedbackInput {
  pet_uuid: string;
  ratings: FeedbackRatings;
  answer: string;
  category: FeedbackType;
  audioBlob: Blob | null;
}

export interface FeedbackSubmissionResult {
  uuid: string;
  pet_uuid: string;
  pet_owners_uuid: string;
  rating: number;
  rating_details: FeedbackRatings;
  raw_answer: string;
  transcript: string | null;
  audio_url: string | null;
  category: FeedbackType;
  summary: string;
  insights: string[];
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const isFeedbackRatings = (value: unknown): value is FeedbackRatings => {
  return (
    isRecord(value) && RATING_CATEGORIES.every((category) => typeof value[category] === 'number')
  );
};

const isStringArray = (value: unknown): value is string[] => {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
};

const isFeedbackInsights = (value: unknown): value is { summary: string; insights: string[] } => {
  return (
    isRecord(value) &&
    typeof value.summary === 'string' &&
    isStringArray(value.insights) &&
    value.insights.length <= 5
  );
};

export const submitPetParentFeedback = async (
  input: SubmitFeedbackInput,
): Promise<FeedbackSubmissionResult> => {
  const payload = {
    pet_uuid: input.pet_uuid,
    category: input.category,
    rating_details: input.ratings,
    raw_answer: input.answer,
  };
  const formData = new FormData();
  formData.append('payload', JSON.stringify(payload));
  if (input.audioBlob) {
    formData.append('audio', input.audioBlob, 'feedback.webm');
  }

  const response = await fetch(`${API_BASE_URL}/feedback`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
  const responseBody: unknown = await response.json();

  if (!response.ok) {
    const message =
      isRecord(responseBody) && isRecord(responseBody.error)
        ? responseBody.error.message
        : undefined;
    throw new Error(typeof message === 'string' ? message : 'Failed to submit feedback');
  }

  if (!isRecord(responseBody)) {
    throw new Error('Invalid feedback submission response');
  }

  const insights = isFeedbackInsights(responseBody.ai_insights) ? responseBody.ai_insights : null;
  const ratingDetails = isFeedbackRatings(responseBody.rating_details)
    ? responseBody.rating_details
    : null;

  if (
    typeof responseBody.uuid !== 'string' ||
    typeof responseBody.pet_uuid !== 'string' ||
    typeof responseBody.pet_owners_uuid !== 'string' ||
    typeof responseBody.rating !== 'number' ||
    typeof responseBody.raw_answer !== 'string' ||
    (responseBody.transcript !== null && typeof responseBody.transcript !== 'string') ||
    (responseBody.audio_url !== null && typeof responseBody.audio_url !== 'string') ||
    !insights ||
    !ratingDetails
  ) {
    throw new Error('Invalid feedback submission response');
  }

  return {
    uuid: responseBody.uuid,
    pet_uuid: responseBody.pet_uuid,
    pet_owners_uuid: responseBody.pet_owners_uuid,
    rating: responseBody.rating,
    rating_details: ratingDetails,
    raw_answer: responseBody.raw_answer,
    transcript: responseBody.transcript,
    audio_url: responseBody.audio_url,
    category: input.category,
    summary: insights.summary,
    insights: insights.insights,
  };
};
