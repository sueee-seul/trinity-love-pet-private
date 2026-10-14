import React, { useState } from 'react';
import type { UpdateSuggestionWorkflowInput } from '../../../api/feedbackApi';
import { LoadingSpinner } from '../../../../../shared/components/ui/LoadingSpinner';
import { DateField } from '../../../../../shared/components/ui/date';
import {
  SUGGESTION_DECISIONS,
  type AdminFeedback,
  type SuggestionDecision,
  type SuggestionWorkflowStatus,
} from '../../../types/feedback';

interface SuggestionReviewProps {
  feedback: AdminFeedback;
  onUpdate?: (input: UpdateSuggestionWorkflowInput) => Promise<void>;
}

const STATUS_LABELS: Record<SuggestionWorkflowStatus, string> = {
  captured: 'Captured',
  under_review: 'Under Review',
  decision_recorded: 'Decision Recorded',
  closed: 'Closed',
};

const DECISION_LABELS: Record<SuggestionDecision, string> = {
  quick_improvement: 'Quick Improvement',
  pilot: 'Pilot',
  future_scope: 'Future Scope',
  not_planned: 'Not Planned',
};

export const SuggestionReview: React.FC<SuggestionReviewProps> = ({ feedback, onUpdate }) => {
  const workflow = feedback.suggestionWorkflow;
  const [decision, setDecision] = useState<SuggestionDecision | ''>(workflow?.decision ?? '');
  const [evidenceSummary, setEvidenceSummary] = useState(workflow?.evidenceSummary ?? '');
  const [decisionReason, setDecisionReason] = useState(workflow?.decisionReason ?? '');
  const [nextReviewAt, setNextReviewAt] = useState(workflow?.nextReviewAt ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpdate = async (
    status: SuggestionWorkflowStatus,
    input: Omit<UpdateSuggestionWorkflowInput, 'status'> = {},
  ): Promise<void> => {
    if (!onUpdate) {
      setError('Suggestion workflow actions are unavailable.');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await onUpdate({ status, ...input });
    } catch (requestError) {
      console.error('Failed to update suggestion workflow', requestError);
      setError('Unable to update this suggestion. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!workflow) {
    return (
      <div
        role="status"
        className="border border-border-soft rounded-xl p-8 shadow-sm bg-surface-card"
      >
        <h3 className="type-card-title">Suggestion progress</h3>
        <p className="type-body mt-3 text-notice-secondary">
          This feedback is loaded from the database, but no persisted Suggestion decision record is
          available yet.
        </p>
      </div>
    );
  }

  const canRecordDecision = Boolean(decision && decisionReason.trim());

  return (
    <div className="border border-border-soft rounded-xl p-8 shadow-sm bg-surface-card">
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h3 className="type-card-title">Suggestion Review</h3>
          <p className="type-body text-notice-secondary mt-2">
            Staff and manager decision workflow. This is not a complaint investigation.
          </p>
        </div>
        <span className="type-meta rounded-full bg-surface-bubbles px-3 py-1 text-accent-foreground">
          {STATUS_LABELS[workflow.status]}
        </span>
      </div>

      <div className="mb-8 space-y-3">
        {workflow.events.map((event) => (
          <div key={`${event.status}-${event.timestamp}`} className="flex items-center gap-3">
            <span className="h-2.5 w-2.5 rounded-full bg-accent-foreground" aria-hidden="true" />
            <span className="type-body text-notice-primary">{STATUS_LABELS[event.status]}</span>
            <span className="type-meta text-notice-secondary">
              {event.timestamp} • {event.actor}
            </span>
          </div>
        ))}
      </div>

      {workflow.status === 'captured' && (
        <button
          type="button"
          onClick={() => handleUpdate('under_review')}
          disabled={isSaving}
          aria-busy={isSaving}
          className="rounded-lg bg-action-dark theme-gradient-action px-4 py-2 type-button text-on-action-dark disabled:opacity-50"
        >
          {isSaving && <LoadingSpinner size="sm" tone="inverse" className="mr-2 align-middle" />}
          {isSaving ? 'Saving...' : 'Start Review'}
        </button>
      )}

      {workflow.status === 'under_review' && (
        <div className="space-y-5">
          <div>
            <label htmlFor="suggestion-decision" className="block type-meta font-bold mb-2">
              Decision
            </label>
            <select
              id="suggestion-decision"
              value={decision}
              onChange={(event) => setDecision(event.target.value as SuggestionDecision | '')}
              className="w-full rounded-lg border border-field-border bg-surface-card px-4 py-2 type-body"
            >
              <option value="">Select a decision</option>
              {SUGGESTION_DECISIONS.map((option) => (
                <option key={option} value={option}>
                  {DECISION_LABELS[option]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="suggestion-evidence" className="block type-meta font-bold mb-2">
              Evidence summary
            </label>
            <textarea
              id="suggestion-evidence"
              value={evidenceSummary}
              onChange={(event) => setEvidenceSummary(event.target.value)}
              rows={3}
              className="w-full resize-none rounded-lg border border-field-border bg-surface-card px-4 py-3 type-body"
              placeholder="What evidence did staff review?"
            />
          </div>

          <div>
            <label htmlFor="suggestion-reason" className="block type-meta font-bold mb-2">
              Decision reason
            </label>
            <textarea
              id="suggestion-reason"
              value={decisionReason}
              onChange={(event) => setDecisionReason(event.target.value)}
              rows={3}
              className="w-full resize-none rounded-lg border border-field-border bg-surface-card px-4 py-3 type-body"
              placeholder="Why was this decision selected?"
            />
          </div>

          {(decision === 'pilot' || decision === 'future_scope') && (
            <div>
              <label htmlFor="suggestion-next-review" className="block type-meta font-bold mb-2">
                Next review date (optional)
              </label>
              <DateField
                id="suggestion-next-review"
                locale="en"
                value={nextReviewAt}
                onChange={setNextReviewAt}
                className="rounded-lg border border-field-border bg-surface-card px-4 py-2 type-body"
              />
            </div>
          )}

          <button
            type="button"
            onClick={() =>
              handleUpdate('decision_recorded', {
                decision: decision || undefined,
                evidenceSummary,
                decisionReason,
                nextReviewAt: nextReviewAt || undefined,
              })
            }
            disabled={!canRecordDecision || isSaving}
            aria-busy={isSaving}
            className="rounded-lg bg-action-dark theme-gradient-action px-4 py-2 type-button text-on-action-dark disabled:opacity-50"
          >
            {isSaving && <LoadingSpinner size="sm" tone="inverse" className="mr-2 align-middle" />}
            {isSaving ? 'Saving...' : 'Record Decision'}
          </button>
        </div>
      )}

      {workflow.status === 'decision_recorded' && (
        <div className="space-y-4">
          <p className="type-body text-notice-primary">
            Decision: {workflow.decision ? DECISION_LABELS[workflow.decision] : 'Not recorded'}
          </p>
          {workflow.decisionReason && (
            <p className="type-body text-notice-secondary">{workflow.decisionReason}</p>
          )}
          <button
            type="button"
            onClick={() => handleUpdate('closed')}
            disabled={isSaving}
            aria-busy={isSaving}
            className="rounded-lg bg-action-dark theme-gradient-action px-4 py-2 type-button text-on-action-dark disabled:opacity-50"
          >
            {isSaving && <LoadingSpinner size="sm" tone="inverse" className="mr-2 align-middle" />}
            {isSaving ? 'Saving...' : 'Close Suggestion'}
          </button>
        </div>
      )}

      {workflow.status === 'closed' && (
        <p className="type-body text-notice-secondary">
          This suggestion has been closed with the decision{' '}
          {workflow.decision ? DECISION_LABELS[workflow.decision] : 'recorded'}.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-4 type-meta font-bold text-status-danger">
          {error}
        </p>
      )}
    </div>
  );
};
