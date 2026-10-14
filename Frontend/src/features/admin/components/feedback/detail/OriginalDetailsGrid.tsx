import React from 'react';
import type { AdminFeedback } from '../../../types/feedback';
import { FeedbackRatingGrid } from '../../../../../shared/components/ui/FeedbackRatingGrid';

interface OriginalDetailsGridProps {
  feedback: AdminFeedback;
}

export const OriginalDetailsGrid: React.FC<OriginalDetailsGridProps> = ({ feedback }) => {
  return (
    <div className="border border-border-soft rounded-xl p-6 mb-8 shadow-sm">
      <h3 className="type-eyebrow text-notice-muted mb-6">Original Details</h3>
      <FeedbackRatingGrid ratings={feedback.detailedRatings || {}} />
    </div>
  );
};
