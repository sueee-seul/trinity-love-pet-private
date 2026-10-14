import React, { type ReactNode } from 'react';
import { FeedbackTypeTag } from './FeedbackTypeTag';
import { formatFeedbackSubmissionTime } from '../../utils/feedbackTime';
import type {
  FeedbackListItem,
  FeedbackSource,
  SuggestionWorkflowStatus,
} from '../../types/feedback';

interface FeedbackTableProps {
  feedbacks: FeedbackListItem[];
  onViewDetails: (feedbackUuid: string) => void;
  source?: FeedbackSource;
  renderReviewerMeta?: (feedback: FeedbackListItem) => ReactNode;
  renderContent?: (feedback: FeedbackListItem) => ReactNode;
  renderType?: (feedback: FeedbackListItem) => ReactNode;
  renderAction?: (feedback: FeedbackListItem) => ReactNode;
}

const PROGRESS_LABELS: Record<FeedbackListItem['current_status'], string> = {
  submitted: 'Submitted',
  review_started: 'Review started',
  fact_checked: 'Fact checked',
  sent: 'Sent',
};

const SUGGESTION_WORKFLOW_LABELS: Record<SuggestionWorkflowStatus, string> = {
  captured: 'Captured',
  under_review: 'Under review',
  decision_recorded: 'Decision recorded',
  closed: 'Closed',
};

const getProgressLabel = (feedback: FeedbackListItem): string => {
  if (feedback.category === 'Praise') {
    return 'Not applicable';
  }

  if (feedback.category === 'Suggestion') {
    return feedback.suggestionWorkflow
      ? SUGGESTION_WORKFLOW_LABELS[feedback.suggestionWorkflow.status]
      : 'Captured';
  }

  return PROGRESS_LABELS[feedback.current_status];
};

/**
 * Renders the shared feedback table shell with an explicit Google Review projection.
 *
 * @remarks
 * With `source="google-reviews"`, the table labels the first column Reviewer, optionally renders
 * reviewer metadata and the review Content callback, uses Received and owner-reply status, omits
 * Internal Feedback progress, and leaves Google-specific reviewer, type, and action behavior to the
 * supplied render callbacks. The row type is still the shared `FeedbackListItem` display shape;
 * this component does not fetch or mutate either source.
 */
export const FeedbackTable: React.FC<FeedbackTableProps> = ({
  feedbacks,
  onViewDetails,
  source = 'internal',
  renderReviewerMeta,
  renderContent,
  renderType,
  renderAction,
}) => {
  // The shared table keeps one layout while this flag changes only Google-specific labels,
  // columns, status meaning, and callback projection.
  const isGoogleReviews = source === 'google-reviews';

  return (
    <div className="overflow-x-auto rounded-xl border border-border-soft bg-surface-card shadow-sm">
      <table className="min-w-[920px] w-full border-collapse text-left">
        <caption className="sr-only">Feedback triage table</caption>
        <thead className="border-b border-border-soft bg-surface-cream">
          <tr>
            <th scope="col" className="w-[280px] px-4 py-3 type-meta text-notice-secondary">
              {isGoogleReviews ? 'Reviewer' : 'Feedback'}
            </th>
            {renderContent && isGoogleReviews && (
              <th
                scope="col"
                className="w-full min-w-[280px] px-4 py-3 type-meta text-notice-secondary"
              >
                Content
              </th>
            )}
            <th scope="col" className="w-[120px] px-4 py-3 type-meta text-notice-secondary">
              {isGoogleReviews ? 'Received' : 'Submitted'}
            </th>
            <th scope="col" className="w-[140px] px-4 py-3 type-meta text-notice-secondary">
              Type
            </th>
            <th scope="col" className="w-[100px] px-4 py-3 type-meta text-notice-secondary">
              Rating
            </th>
            <th scope="col" className="w-[120px] px-4 py-3 type-meta text-notice-secondary">
              {isGoogleReviews ? 'Reply status' : 'Record state'}
            </th>
            {!isGoogleReviews && (
              <th scope="col" className="w-[140px] px-4 py-3 type-meta text-notice-secondary">
                Progress
              </th>
            )}
            <th scope="col" className="w-[140px] px-4 py-3 type-meta text-notice-secondary">
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {feedbacks.map((feedback) => {
            return (
              <tr
                key={feedback.uuid}
                className="border-b border-border-soft last:border-b-0 bg-surface-card"
              >
                <td className="px-4 py-4 align-top">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-deep text-accent-foreground type-meta font-semibold">
                      {feedback.initials}
                    </div>
                    <div className="min-w-0">
                      <p className="type-button text-notice-primary">
                        {isGoogleReviews
                          ? feedback.parentName
                          : `${feedback.parentName} & ${feedback.petName}`}
                      </p>
                      {renderReviewerMeta ? (
                        renderReviewerMeta(feedback)
                      ) : feedback.serviceType ? (
                        <p className="mt-1 type-meta text-notice-secondary">
                          {feedback.serviceType}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </td>
                {renderContent && isGoogleReviews && (
                  <td className="px-4 py-4 align-top type-body text-notice-secondary">
                    {renderContent(feedback)}
                  </td>
                )}
                <td className="px-4 py-4 align-top">
                  <time
                    dateTime={new Date(feedback.timestamp).toISOString()}
                    className="flex flex-col whitespace-nowrap type-meta text-notice-secondary"
                  >
                    {isGoogleReviews && feedback.relativeTime ? (
                      <span>{feedback.relativeTime}</span>
                    ) : (
                      <>
                        <span>{feedback.date}</span>
                        <span className="tabular-nums">
                          {formatFeedbackSubmissionTime(feedback.timestamp)}
                        </span>
                      </>
                    )}
                  </time>
                </td>
                <td className="px-4 py-4 align-top">
                  {renderType ? (
                    renderType(feedback)
                  ) : (
                    <FeedbackTypeTag category={feedback.category} />
                  )}
                </td>
                <td className="px-4 py-4 align-top type-numeral text-notice-secondary">
                  {feedback.rating.toFixed(1)}
                </td>
                <td className="px-4 py-4 align-top">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 type-meta ${
                      isGoogleReviews
                        ? feedback.ownerReply
                          ? 'bg-status-success/10 text-status-success'
                          : 'bg-surface-cream text-notice-secondary'
                        : feedback.is_read
                          ? 'bg-surface-cream text-notice-secondary'
                          : 'bg-surface-bubbles text-accent-foreground'
                    }`}
                  >
                    {isGoogleReviews
                      ? feedback.ownerReply
                        ? 'Replied'
                        : 'Unreplied'
                      : feedback.is_read
                        ? 'Read'
                        : 'Unread'}
                  </span>
                </td>
                {!isGoogleReviews && (
                  <td className="px-4 py-4 align-top type-body text-notice-secondary">
                    {getProgressLabel(feedback)}
                  </td>
                )}
                <td className="px-4 py-4 align-top">
                  <div className="flex flex-col items-start gap-2">
                    <button
                      type="button"
                      onClick={() => onViewDetails(feedback.uuid)}
                      className="whitespace-nowrap rounded-md border border-control-border bg-surface-cream px-3 py-2 type-button text-notice-secondary transition-colors hover:bg-surface-bubbles focus:outline-none focus:ring-2 focus:ring-focus"
                    >
                      View details
                    </button>
                    {renderAction?.(feedback)}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
