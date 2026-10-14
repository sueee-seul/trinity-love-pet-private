import { FeedbackTypeTag } from '../FeedbackTypeTag';

import React from 'react';
import type { AdminFeedback, FeedbackProgressStep } from '../../../types/feedback';

interface FeedbackDetailHeaderProps {
  feedback: AdminFeedback;
  onUpdateStatus?: (id: string, step: FeedbackProgressStep) => void;
}

export const FeedbackDetailHeader: React.FC<FeedbackDetailHeaderProps> = ({
  feedback,
  onUpdateStatus,
}) => {
  let nextStep: FeedbackProgressStep | null = null;
  let nextActionText = '';

  if (feedback.category === 'Issue') {
    switch (feedback.current_status) {
      case 'submitted':
        nextStep = 'review_started';
        nextActionText = 'Start Review';
        break;
      case 'review_started':
        nextStep = 'fact_checked';
        nextActionText = 'Complete Fact Check';
        break;
      case 'fact_checked':
        nextStep = 'sent';
        nextActionText = 'Send Response';
        break;
      default:
        break;
    }
  }

  return (
    <div className="flex justify-between items-start mb-6">
      <div>
        <div className="flex items-center gap-4 mb-2">
          <h1 className="type-display type-card-title">
            {feedback.parentName} & {feedback.petName}
          </h1>
          <FeedbackTypeTag category={feedback.category} />
        </div>
        <p className="type-meta text-notice-secondary">
          Submitted on {feedback.date}
          {feedback.walkId && <> &bull; {feedback.walkId}</>}
        </p>
      </div>
      <div className="flex items-center gap-3">
        {nextStep && (
          <button
            type="button"
            onClick={() => {
              if (onUpdateStatus && nextStep) {
                onUpdateStatus(feedback.uuid, nextStep);
              }
            }}
            className="flex items-center gap-2 px-4 py-2 bg-action-dark theme-gradient-action hover:bg-action-dark-hover text-on-action-dark type-button rounded-lg transition-colors shadow-sm"
          >
            {nextActionText}
          </button>
        )}
        {feedback.walkId && (
          <button
            type="button"
            className="flex items-center gap-2 px-4 py-2 bg-surface-card border border-control-border rounded-lg type-button text-notice-secondary hover:bg-surface-cream transition-colors shadow-sm"
          >
            <svg
              className="w-4 h-4 text-notice-muted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
            View Walk Record
          </button>
        )}
      </div>
    </div>
  );
};
