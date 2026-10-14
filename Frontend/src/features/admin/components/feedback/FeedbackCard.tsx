import { FeedbackTypeTag } from './FeedbackTypeTag';

import React from 'react';
import type { FeedbackListItem } from '../../types/feedback';
import { StarRating } from '../../../../shared/components/ui/StarRating';
import { formatFeedbackSubmissionTime } from '../../utils/feedbackTime';

interface FeedbackCardProps {
  feedback: FeedbackListItem;
  onViewDetails?: () => void;
  onDelete: () => Promise<void>;
  selectionMode: boolean;
  isSelected: boolean;
  isBusy: boolean;
  isDeleting: boolean;
  onToggleSelected: () => void;
}

export const FeedbackCard: React.FC<FeedbackCardProps> = ({
  feedback,
  onViewDetails,
  onDelete,
  selectionMode,
  isSelected,
  isBusy,
  isDeleting,
  onToggleSelected,
}) => {
  const handleDelete = (): void => {
    const confirmed = window.confirm(
      `Delete feedback from ${feedback.parentName} & ${feedback.petName}? This action cannot be undone.`,
    );
    if (confirmed) {
      void onDelete();
    }
  };

  return (
    <div
      className={`relative mb-6 overflow-hidden rounded-xl border shadow-sm transition-all hover:shadow-md ${
        !feedback.is_read
          ? 'bg-surface-bubbles border-control-border'
          : 'bg-surface-card border-border-soft'
      } ${isSelected ? 'ring-2 ring-focus ring-offset-2' : ''}`}
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-start mb-5">
          <div className={`flex items-center ${selectionMode ? 'gap-3' : 'gap-4'}`}>
            {selectionMode && (
              <label className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-surface-cream focus-within:ring-2 focus-within:ring-focus">
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={isBusy}
                  aria-label={`Select feedback from ${feedback.parentName} and ${feedback.petName}`}
                  onChange={onToggleSelected}
                  className="h-5 w-5 cursor-pointer rounded border-control-border accent-accent-foreground focus:outline-none focus:ring-2 focus:ring-focus disabled:cursor-not-allowed disabled:opacity-50"
                />
              </label>
            )}
            <div className="w-12 h-12 rounded-full bg-surface-deep text-accent-foreground type-numeral type-card-title flex items-center justify-center">
              {feedback.initials}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h3 className="type-card-title">
                  {feedback.parentName} & {feedback.petName}
                </h3>
                <FeedbackTypeTag category={feedback.category} />
              </div>
              <p className="type-meta text-notice-secondary mt-1">
                <time dateTime={new Date(feedback.timestamp).toISOString()}>
                  {feedback.date} &bull; {formatFeedbackSubmissionTime(feedback.timestamp)}
                </time>
                {feedback.serviceType && <> &bull; {feedback.serviceType}</>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <StarRating rating={feedback.rating} sizeClassName="w-5 h-5" />
            <span className="type-numeral text-notice-secondary ml-1">
              {feedback.rating.toFixed(1)}
            </span>
          </div>
        </div>

        {/* AI Insight Box */}
        <div
          className={`border rounded-lg p-4 ml-16 mb-5 relative group ${
            !feedback.is_read
              ? 'bg-surface-card/60 border-control-border'
              : 'bg-surface-cream border-border-soft'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-accent-foreground flex-shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                />
              </svg>
            </div>
            <p className="type-body text-notice-secondary leading-relaxed">{feedback.aiSummary}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="ml-16 mt-4 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={handleDelete}
            disabled={isBusy || isDeleting}
            aria-label={`Delete feedback from ${feedback.parentName} and ${feedback.petName}`}
            className="flex items-center gap-1.5 type-button text-status-danger border border-status-danger/30 hover:bg-status-danger/10 px-3 py-1.5 rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
          <button
            type="button"
            onClick={onViewDetails}
            className="flex items-center gap-1.5 type-button text-notice-secondary bg-surface-cream border border-control-border hover:bg-surface-bubbles px-3 py-1.5 rounded-md transition-colors"
          >
            View Details
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};
