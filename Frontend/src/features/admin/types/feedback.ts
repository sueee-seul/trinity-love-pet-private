import {
  FEEDBACK_TYPES,
  type FeedbackRatings,
  type FeedbackType,
} from '../../../shared/types/feedback';

export const FEEDBACK_PROGRESS_STEPS = [
  'submitted',
  'review_started',
  'fact_checked',
  'sent',
] as const;
export type FeedbackProgressStep = (typeof FEEDBACK_PROGRESS_STEPS)[number];

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

export const isSuggestionWorkflowStatus = (value: string): value is SuggestionWorkflowStatus => {
  return SUGGESTION_WORKFLOW_STATUSES.some((status) => status === value);
};

export const isSuggestionDecision = (value: string): value is SuggestionDecision => {
  return SUGGESTION_DECISIONS.some((decision) => decision === value);
};

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

export type FeedbackTypeFilter = 'All' | FeedbackType;

export type FeedbackStatusFilter = 'all' | 'unread' | 'read';

export type GoogleReviewAgeFilter = 'all' | 'approaching' | 'overdue';

export type FeedbackViewMode = 'table' | 'card';

export type FeedbackSource = 'internal' | 'google-reviews';

export const FEEDBACK_TIME_FILTERS = ['all', 'last_7_days', 'last_30_days', 'custom'] as const;
export type FeedbackTimeFilter = (typeof FEEDBACK_TIME_FILTERS)[number];

export const FEEDBACK_RATING_FILTERS = ['all', 'low', 'medium', 'high'] as const;
export type FeedbackRatingFilter = (typeof FEEDBACK_RATING_FILTERS)[number];

export const ADMIN_FEEDBACK_PAGE_SIZE = 5;

export const isFeedbackTypeFilter = (value: string): value is FeedbackTypeFilter => {
  return value === 'All' || FEEDBACK_TYPES.some((type) => type === value);
};

export const isGoogleReviewAgeFilter = (value: string): value is GoogleReviewAgeFilter => {
  return value === 'all' || value === 'approaching' || value === 'overdue';
};

export const FEEDBACK_SORT_OPTIONS = ['newest', 'oldest', 'highest', 'lowest'] as const;
export type FeedbackSortOption = (typeof FEEDBACK_SORT_OPTIONS)[number];

export const isFeedbackProgressStep = (value: string): value is FeedbackProgressStep => {
  return FEEDBACK_PROGRESS_STEPS.some((step) => step === value);
};

export const isFeedbackSortOption = (value: string): value is FeedbackSortOption => {
  return FEEDBACK_SORT_OPTIONS.some((option) => option === value);
};

export const isFeedbackTimeFilter = (value: string): value is FeedbackTimeFilter => {
  return FEEDBACK_TIME_FILTERS.some((filter) => filter === value);
};

export const isFeedbackRatingFilter = (value: string): value is FeedbackRatingFilter => {
  return FEEDBACK_RATING_FILTERS.some((filter) => filter === value);
};

export interface TimelineEvent {
  step: FeedbackProgressStep;
  timestamp: string;
  actor: string;
}

export interface StaffOption {
  id: string;
  name: string;
}

export interface FeedbackListItem {
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
  current_status: FeedbackProgressStep;
  ownerReply?: string | null;
  relativeTime?: string;
  suggestionWorkflow?: SuggestionWorkflowSummary;
}

export interface AdminFeedback extends FeedbackListItem {
  // Detail page fields
  ai_insights?: string[];
  detailedRatings?: FeedbackRatings;
  questions?: string[];
  answers?: string[];
  transcript?: string;
  audio_url?: string; // e.g. URL to the raw audio recording
  walkId?: string; // e.g. "Walk #4928"
  timeline: TimelineEvent[];
  suggestionWorkflow?: SuggestionWorkflow;
}
