import React, { useEffect, useRef } from 'react';
import { LoadingSpinner } from '../../../../shared/components/ui/LoadingSpinner';

interface FeedbackBulkActionBarProps {
  visibleFeedbackUuids: string[];
  selectedUuids: Set<string>;
  selectionMode: boolean;
  isMarkingAsRead: boolean;
  isDeletingFeedback: boolean;
  selectedUnreadCount: number;
  onEnterSelectionMode: () => void;
  onExitSelectionMode: () => void;
  onToggleVisibleSelection: () => void;
  onClearSelection: () => void;
  onMarkReviewed: () => void;
}

export const FeedbackBulkActionBar: React.FC<FeedbackBulkActionBarProps> = ({
  visibleFeedbackUuids,
  selectedUuids,
  selectionMode,
  isMarkingAsRead,
  isDeletingFeedback,
  selectedUnreadCount,
  onEnterSelectionMode,
  onExitSelectionMode,
  onToggleVisibleSelection,
  onClearSelection,
  onMarkReviewed,
}) => {
  const selectAllRef = useRef<HTMLInputElement>(null);
  const selectedCount = selectedUuids.size;
  const allVisibleSelected =
    visibleFeedbackUuids.length > 0 &&
    visibleFeedbackUuids.every((feedbackUuid) => selectedUuids.has(feedbackUuid));
  const someVisibleSelected = visibleFeedbackUuids.some((feedbackUuid) =>
    selectedUuids.has(feedbackUuid),
  );
  const isIndeterminate = someVisibleSelected && !allVisibleSelected;
  const isBusy = isMarkingAsRead || isDeletingFeedback;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = isIndeterminate;
    }
  }, [isIndeterminate]);

  if (!selectionMode) {
    return (
      <div className="mb-6 flex justify-end">
        <button
          type="button"
          onClick={onEnterSelectionMode}
          disabled={isBusy}
          className="flex min-h-11 items-center gap-2 rounded-lg border border-control-border bg-surface-card px-4 py-2 type-button text-notice-secondary shadow-sm transition-colors hover:bg-surface-cream hover:text-notice-primary focus:outline-none focus:ring-2 focus:ring-focus"
        >
          <svg
            aria-hidden="true"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.8}
          >
            <rect x="4" y="4" width="16" height="16" rx="2" />
            <path strokeLinecap="round" d="M8 12h8" />
          </svg>
          Select
        </button>
      </div>
    );
  }

  return (
    <div className="sticky top-20 z-20 mb-6 flex min-h-12 flex-wrap items-center justify-between gap-4 rounded-lg border border-border-soft bg-surface-card/95 px-4 py-2 shadow-sm backdrop-blur">
      <div className="flex items-center gap-3">
        <label className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-surface-cream focus-within:ring-2 focus-within:ring-focus">
          <input
            ref={selectAllRef}
            type="checkbox"
            checked={allVisibleSelected}
            disabled={visibleFeedbackUuids.length === 0 || isBusy}
            aria-label="Select all visible feedback"
            aria-checked={isIndeterminate ? 'mixed' : allVisibleSelected}
            onChange={onToggleVisibleSelection}
            className="h-5 w-5 cursor-pointer rounded border-control-border accent-accent-foreground focus:outline-none focus:ring-2 focus:ring-focus disabled:cursor-not-allowed disabled:opacity-50"
          />
        </label>
        <span role="status" aria-live="polite" className="type-button text-notice-primary">
          {selectedCount > 0 ? `${selectedCount} selected` : 'Select all'}
        </span>
      </div>

      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onMarkReviewed}
            disabled={isBusy || selectedUnreadCount === 0}
            aria-busy={isMarkingAsRead}
            className="flex min-h-11 items-center gap-2 rounded-lg bg-action-dark theme-gradient-action px-4 py-2 type-button text-on-action-dark transition-colors hover:bg-action-dark-hover focus:outline-none focus:ring-2 focus:ring-focus disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isMarkingAsRead ? (
              <LoadingSpinner size="sm" tone="inverse" />
            ) : (
              <svg
                aria-hidden="true"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 7.5A2.5 2.5 0 015.5 5h13A2.5 2.5 0 0121 7.5v9a2.5 2.5 0 01-2.5 2.5h-13A2.5 2.5 0 013 16.5v-9z"
                />
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 7l8.5 6 8.5-6" />
              </svg>
            )}
            {isMarkingAsRead ? 'Marking reviewed...' : 'Mark reviewed'}
          </button>
          <button
            type="button"
            onClick={onClearSelection}
            disabled={isBusy}
            className="min-h-11 rounded-lg px-3 py-2 type-button text-notice-secondary transition-colors hover:bg-surface-cream hover:text-notice-primary focus:outline-none focus:ring-2 focus:ring-focus disabled:cursor-not-allowed disabled:opacity-60"
          >
            Clear selection
          </button>
          <button
            type="button"
            onClick={onExitSelectionMode}
            disabled={isBusy}
            className="min-h-11 rounded-lg px-3 py-2 type-button text-notice-secondary transition-colors hover:bg-surface-cream hover:text-notice-primary focus:outline-none focus:ring-2 focus:ring-focus disabled:cursor-not-allowed disabled:opacity-60"
          >
            Done
          </button>
        </div>
      )}

      {selectedCount === 0 && (
        <button
          type="button"
          onClick={onExitSelectionMode}
          disabled={isBusy}
          className="min-h-11 rounded-lg px-3 py-2 type-button text-notice-secondary transition-colors hover:bg-surface-cream hover:text-notice-primary focus:outline-none focus:ring-2 focus:ring-focus"
        >
          Done
        </button>
      )}
    </div>
  );
};
