import { z } from 'zod';

export const FEEDBACK_TYPES = ['Issue', 'Suggestion', 'Praise'] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

export const FEEDBACK_PROGRESS_STEPS = [
  'submitted',
  'review_started',
  'fact_checked',
  'sent',
] as const;
export type FeedbackProgressStep = (typeof FEEDBACK_PROGRESS_STEPS)[number];

export const FEEDBACK_RATING_KEYS = [
  'Professional',
  'Service',
  'Communication',
  'Safety',
  'Cost',
] as const;
export type FeedbackRatingKey = (typeof FEEDBACK_RATING_KEYS)[number];
export type FeedbackRatings = Record<FeedbackRatingKey, number>;

export const feedbackInsightsSchema = z
  .object({
    summary: z.string().describe('A concise one-sentence summary of the feedback'),
    insights: z
      .array(z.string())
      .max(5)
      .describe(
        'Up to 5 key insights extracted from the feedback without inferring unstated facts',
      ),
  })
  .strict();

export type FeedbackInsights = z.infer<typeof feedbackInsightsSchema>;

export const feedbackRatingDetailsSchema = z
  .object({
    Professional: z.number().int().min(1).max(5),
    Service: z.number().int().min(1).max(5),
    Communication: z.number().int().min(1).max(5),
    Safety: z.number().int().min(1).max(5),
    Cost: z.number().int().min(1).max(5),
  })
  .strict();

export type FeedbackRatingDetails = z.infer<typeof feedbackRatingDetailsSchema>;

export interface TimelineEvent {
  step: FeedbackProgressStep;
  timestamp: string;
  actor: string;
}

export const SUGGESTION_WORKFLOW_STATUSES = [
  'captured',
  'under_review',
  'decision_recorded',
  'closed',
] as const;
export type SuggestionWorkflowStatus = (typeof SUGGESTION_WORKFLOW_STATUSES)[number];

export const SUGGESTION_DECISIONS = [
  'quick_improvement',
  'pilot',
  'future_scope',
  'not_planned',
] as const;
export type SuggestionDecision = (typeof SUGGESTION_DECISIONS)[number];

export interface SuggestionWorkflowEvent {
  status: SuggestionWorkflowStatus;
  timestamp: string;
  actor: string;
}

export interface SuggestionWorkflowSummary {
  status: SuggestionWorkflowStatus;
  decision: SuggestionDecision | null;
}

export interface SuggestionWorkflow extends SuggestionWorkflowSummary {
  ownerId: string;
  evidenceSummary: string | null;
  decisionReason: string | null;
  nextReviewAt: string | null;
  events: SuggestionWorkflowEvent[];
}

export interface AdminFeedback {
  uuid: string;
  initials: string;
  parentName: string;
  petName: string;
  date: string;
  timestamp: number;
  serviceType: string;
  rating: number;
  aiSummary: string;
  category: FeedbackType;
  is_read: boolean;
  assigneeId: string | null;
  walkId: string;
  ai_insights: string[];
  detailedRatings: FeedbackRatings;
  questions: string[];
  answers: string[];
  transcript?: string;
  audio_url?: string;
  current_status: FeedbackProgressStep;
  timeline: TimelineEvent[];
  suggestionWorkflow?: SuggestionWorkflow;
}

export interface FeedbackNotificationInput {
  uuid: string;
  parentName: string;
  petName: string;
  serviceType: string;
  aiSummary: string;
}
