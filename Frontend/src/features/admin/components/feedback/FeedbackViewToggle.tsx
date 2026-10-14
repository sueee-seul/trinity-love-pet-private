import React from 'react';
import type { FeedbackViewMode } from '../../types/feedback';

interface FeedbackViewToggleProps {
  viewMode: FeedbackViewMode;
  onChange: (viewMode: FeedbackViewMode) => void;
}

const getKeyboardViewMode = (
  event: React.KeyboardEvent<HTMLButtonElement>,
  currentViewMode: FeedbackViewMode,
): FeedbackViewMode | null => {
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    return currentViewMode === 'table' ? 'card' : 'table';
  }

  if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    return currentViewMode === 'card' ? 'table' : 'card';
  }

  return null;
};

export const FeedbackViewToggle: React.FC<FeedbackViewToggleProps> = ({ viewMode, onChange }) => {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>): void => {
    const nextViewMode = getKeyboardViewMode(event, viewMode);
    if (!nextViewMode) {
      return;
    }

    event.preventDefault();
    onChange(nextViewMode);
  };

  return (
    <div
      role="tablist"
      aria-label="Feedback view"
      className="inline-flex items-center rounded-lg border border-control-border bg-surface-card p-1 shadow-sm"
    >
      <button
        type="button"
        role="tab"
        aria-selected={viewMode === 'table'}
        aria-label="Table view"
        title="Table view"
        tabIndex={viewMode === 'table' ? 0 : -1}
        onClick={() => onChange('table')}
        onKeyDown={handleKeyDown}
        className={`flex h-9 w-9 items-center justify-center rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-focus ${
          viewMode === 'table'
            ? 'bg-action-dark text-on-action-dark'
            : 'text-notice-secondary hover:bg-surface-cream hover:text-notice-primary'
        }`}
      >
        <svg
          aria-hidden="true"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
            d="M4 5h16M4 12h16M4 19h16"
          />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5v14" />
        </svg>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={viewMode === 'card'}
        aria-label="Card view"
        title="Card view"
        tabIndex={viewMode === 'card' ? 0 : -1}
        onClick={() => onChange('card')}
        onKeyDown={handleKeyDown}
        className={`flex h-9 w-9 items-center justify-center rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-focus ${
          viewMode === 'card'
            ? 'bg-action-dark text-on-action-dark'
            : 'text-notice-secondary hover:bg-surface-cream hover:text-notice-primary'
        }`}
      >
        <svg
          aria-hidden="true"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <rect x="4" y="4" width="6" height="6" rx="1" strokeWidth={1.8} />
          <rect x="14" y="4" width="6" height="6" rx="1" strokeWidth={1.8} />
          <rect x="4" y="14" width="6" height="6" rx="1" strokeWidth={1.8} />
          <rect x="14" y="14" width="6" height="6" rx="1" strokeWidth={1.8} />
        </svg>
      </button>
    </div>
  );
};
