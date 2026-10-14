export type FeedbackType = 'Issue' | 'Suggestion' | 'Praise';

export const FEEDBACK_TYPES = ['Issue', 'Suggestion', 'Praise'] as const;

export const FEEDBACK_TYPE_OPTIONS = [
  { value: 'Praise', label: 'Praise' },
  { value: 'Issue', label: 'Issue' },
  { value: 'Suggestion', label: 'Suggestion' },
] as const satisfies ReadonlyArray<{ value: FeedbackType; label: string }>;

export const FEEDBACK_TYPE_PROMPTS: Record<FeedbackType, string> = {
  Praise: "What did you appreciate most about your pet's stay?",
  Issue: "What concerned you about your pet's care?",
  Suggestion: 'How could we improve your experience?',
};

export const RATING_CATEGORIES = [
  'Professional',
  'Service',
  'Communication',
  'Safety',
  'Cost',
] as const;

export type RatingCategory = (typeof RATING_CATEGORIES)[number];

export type FeedbackRatings = Record<RatingCategory, number>;
