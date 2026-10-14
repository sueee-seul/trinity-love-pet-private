import type {
  AdminFeedback,
  FeedbackProgressStep,
  SuggestionWorkflowStatus,
} from '../contracts/feedback.contract.js';
import { AppError } from '../common/middlewares/error.middleware.js';
import {
  deleteFeedbackRecord,
  getAdminFeedbackWorkflowRecord,
  replyFeedbackRecord,
  transitionIssueFeedback,
  transitionSuggestionFeedback,
} from '../repositories/admin.feedback.repository.js';
import { getDetail, mapSuggestionWorkflowFromTimeline } from './admin.feedback.read.service.js';
import { canTransitionSuggestionWorkflow, type SuggestionDecision } from './suggestion.workflow.js';

export interface UpdateSuggestionWorkflowInput {
  status: SuggestionWorkflowStatus;
  actorId: string;
  decision?: SuggestionDecision | undefined;
  evidenceSummary?: string | undefined;
  decisionReason?: string | undefined;
  nextReviewAt?: string | undefined;
}

const ISSUE_PREVIOUS_STATUS: Partial<Record<FeedbackProgressStep, FeedbackProgressStep>> = {
  review_started: 'submitted',
  fact_checked: 'review_started',
  sent: 'fact_checked',
};

const throwMutationError = (
  outcome: 'not_found' | 'invalid_category' | 'invalid_transition',
  invalidCategoryMessage: string,
  invalidTransitionMessage: string,
): never => {
  if (outcome === 'not_found') {
    throw new AppError('Feedback not found', 'NOT_FOUND', 404);
  }
  if (outcome === 'invalid_category') {
    throw new AppError(invalidCategoryMessage, 'INVALID_STATUS_FOR_FEEDBACK_TYPE', 400);
  }
  throw new AppError(invalidTransitionMessage, 'INVALID_FEEDBACK_TRANSITION', 400);
};

export const updateStatus = async (
  uuid: string,
  status: FeedbackProgressStep,
  actorId: string,
): Promise<AdminFeedback> => {
  const expectedCurrentStatus = ISSUE_PREVIOUS_STATUS[status];
  if (!expectedCurrentStatus) {
    throw new AppError(
      `Cannot move Issue feedback to ${status}`,
      'INVALID_FEEDBACK_TRANSITION',
      400,
    );
  }

  const result = await transitionIssueFeedback(uuid, status, actorId, expectedCurrentStatus);
  if (result.outcome !== 'updated') {
    throwMutationError(
      result.outcome,
      'Only Issue feedback supports complaint progress updates',
      `Cannot move Issue feedback to ${status}`,
    );
  }

  return getDetail(uuid);
};

export const updateSuggestionWorkflow = async (
  uuid: string,
  input: UpdateSuggestionWorkflowInput,
): Promise<AdminFeedback> => {
  const record = await getAdminFeedbackWorkflowRecord(uuid);
  if (!record) {
    throw new AppError('Feedback not found', 'NOT_FOUND', 404);
  }

  if (record.category !== 'Suggestion') {
    throw new AppError(
      'Only Suggestion feedback supports suggestion workflow updates',
      'INVALID_STATUS_FOR_FEEDBACK_TYPE',
      400,
    );
  }

  const workflow = mapSuggestionWorkflowFromTimeline(record.timeline);
  if (!workflow) {
    throw new AppError(
      'Suggestion workflow is not initialized',
      'SUGGESTION_WORKFLOW_NOT_INITIALIZED',
      400,
    );
  }

  if (!canTransitionSuggestionWorkflow(workflow.status, input.status)) {
    throw new AppError(
      `Cannot move Suggestion workflow from ${workflow.status} to ${input.status}`,
      'INVALID_SUGGESTION_WORKFLOW_TRANSITION',
      400,
    );
  }

  if (input.status === 'decision_recorded' && !input.decision) {
    throw new AppError(
      'A decision is required before recording the Suggestion decision',
      'SUGGESTION_DECISION_REQUIRED',
      400,
    );
  }

  if (input.status === 'decision_recorded' && !input.decisionReason?.trim()) {
    throw new AppError(
      'A decision reason is required before recording the Suggestion decision',
      'SUGGESTION_DECISION_REASON_REQUIRED',
      400,
    );
  }

  const result = await transitionSuggestionFeedback(
    uuid,
    input.status,
    input.actorId,
    workflow.status,
    {
      workflow_type: 'suggestion',
      ownerId: workflow.ownerId,
      decision: input.decision ?? workflow.decision,
      evidenceSummary: input.evidenceSummary ?? workflow.evidenceSummary,
      decisionReason: input.decisionReason ?? workflow.decisionReason,
      nextReviewAt: input.nextReviewAt ?? workflow.nextReviewAt,
    },
  );
  if (result.outcome !== 'updated') {
    throwMutationError(
      result.outcome,
      'Only Suggestion feedback supports suggestion workflow updates',
      `Cannot move Suggestion workflow from ${workflow.status} to ${input.status}`,
    );
  }

  return getDetail(uuid);
};

export const deleteFeedback = async (uuid: string): Promise<void> => {
  try {
    const result = await deleteFeedbackRecord(uuid);
    if (!result.deletedUuid) {
      throw new AppError('Feedback not found', 'NOT_FOUND', 404);
    }
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }

    console.error(
      'Failed to delete feedback',
      error instanceof Error ? error.message : 'Unknown database error',
    );
    throw new AppError('Feedback could not be deleted', 'FEEDBACK_DELETE_UNAVAILABLE', 503);
  }
};

export const replyToFeedback = async (
  uuid: string,
  actorId: string,
  emailBody: string,
): Promise<AdminFeedback> => {
  try {
    const result = await replyFeedbackRecord(uuid, actorId, emailBody);
    if (!result.repliedUuid) {
      throw new AppError('Feedback not found', 'NOT_FOUND', 404);
    }

    return getDetail(uuid);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }

    console.error(
      'Failed to persist feedback reply status',
      error instanceof Error ? error.message : 'Unknown database error',
    );
    throw new AppError(
      'Feedback reply status could not be updated',
      'FEEDBACK_REPLY_UNAVAILABLE',
      503,
    );
  }
};
