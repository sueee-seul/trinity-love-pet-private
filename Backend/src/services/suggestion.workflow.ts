import {
  SUGGESTION_DECISIONS,
  SUGGESTION_WORKFLOW_STATUSES,
  type SuggestionDecision,
  type SuggestionWorkflow,
  type SuggestionWorkflowStatus,
} from '../contracts/feedback.contract.js';

export {
  SUGGESTION_DECISIONS,
  SUGGESTION_WORKFLOW_STATUSES,
  type SuggestionDecision,
  type SuggestionWorkflow,
  type SuggestionWorkflowEvent,
  type SuggestionWorkflowStatus,
  type SuggestionWorkflowSummary,
} from '../contracts/feedback.contract.js';

const SUGGESTION_WORKFLOW_TRANSITIONS: Record<
  SuggestionWorkflowStatus,
  readonly SuggestionWorkflowStatus[]
> = {
  captured: ['under_review'],
  under_review: ['decision_recorded'],
  decision_recorded: ['closed'],
  closed: [],
};

export const isSuggestionWorkflowStatus = (value: string): value is SuggestionWorkflowStatus => {
  return SUGGESTION_WORKFLOW_STATUSES.some((status) => status === value);
};

export const isSuggestionDecision = (value: string): value is SuggestionDecision => {
  return SUGGESTION_DECISIONS.some((decision) => decision === value);
};

export const canTransitionSuggestionWorkflow = (
  currentStatus: SuggestionWorkflowStatus,
  nextStatus: SuggestionWorkflowStatus,
): boolean => {
  return SUGGESTION_WORKFLOW_TRANSITIONS[currentStatus].some((status) => status === nextStatus);
};

export const createSuggestionWorkflow = (
  ownerId: string,
  timestamp: string,
): SuggestionWorkflow => ({
  status: 'captured',
  decision: null,
  ownerId,
  evidenceSummary: null,
  decisionReason: null,
  nextReviewAt: null,
  events: [{ status: 'captured', timestamp, actor: 'System' }],
});
