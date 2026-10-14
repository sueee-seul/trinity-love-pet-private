import React from 'react';
import type { FeedbackType } from '../../../../shared/types/feedback';

interface FeedbackTypeTagProps {
  category: FeedbackType;
  className?: string;
}

export const FeedbackTypeTag: React.FC<FeedbackTypeTagProps> = ({ category, className = '' }) => {
  const getColors = (): string => {
    switch (category) {
      case 'Praise':
        return 'bg-status-success/10 text-status-success border-status-success';
      case 'Suggestion':
        return 'bg-status-warning/10 text-accent-foreground border-accent-foreground';
      case 'Issue':
        return 'bg-status-danger/10 text-status-danger border-status-danger';
      default:
        return 'bg-surface-cream text-notice-primary border-border-soft';
    }
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded type-meta font-bold border ${getColors()} ${className}`}
    >
      {category}
    </span>
  );
};
