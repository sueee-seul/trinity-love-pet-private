import React from 'react';
import { type GoogleReviewAgeFilter, isGoogleReviewAgeFilter } from '../../types/feedback';

const GOOGLE_REVIEW_AGE_OPTIONS: readonly {
  value: GoogleReviewAgeFilter;
  label: string;
}[] = [
  { value: 'all', label: 'Urgency: All' },
  { value: 'approaching', label: 'Urgency: Reply soon' },
  { value: 'overdue', label: 'Urgency: Overdue' },
];

interface GoogleReviewFilterControlsProps {
  /** Current Google-only urgency band held by the parent page. */
  ageFilter: GoogleReviewAgeFilter;
  /** Receives only values accepted by the Google Review age union. */
  onAgeFilterChange: (value: GoogleReviewAgeFilter) => void;
}

/**
 * Renders the Google-only urgency selector used beside the shared feedback filters.
 *
 * @remarks
 * The parent owns the filter state and the review panel applies it locally; this control validates
 * the native select value before calling back and does not issue an API request.
 */
export const GoogleReviewFilterControls: React.FC<GoogleReviewFilterControlsProps> = ({
  ageFilter,
  onAgeFilterChange,
}) => (
  <div className="relative">
    <select
      aria-label="Google review urgency filter"
      className="type-button cursor-pointer appearance-none rounded-full border border-field-border bg-surface-card py-2 pl-4 pr-10 text-notice-secondary transition-colors hover:bg-surface-cream focus:outline-none focus:ring-2 focus:ring-focus/20"
      value={ageFilter}
      onChange={(event) => {
        if (isGoogleReviewAgeFilter(event.target.value)) {
          onAgeFilterChange(event.target.value);
        }
      }}
    >
      {GOOGLE_REVIEW_AGE_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-notice-muted">
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  </div>
);

interface GoogleReviewDashboardActionProps {
  /** Parent-owned navigation action for the manager dashboard. */
  onClick: () => void;
}

/**
 * Renders the Google Review entry point for the manager feedback dashboard.
 *
 * @remarks
 * This button only invokes its parent callback; `AdminFeedbackPage` supplies the navigation to the
 * manager-only operation route.
 */
export const GoogleReviewDashboardAction: React.FC<GoogleReviewDashboardActionProps> = ({
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    className="min-h-10 rounded-lg border border-control-border bg-surface-card px-3 type-button text-notice-secondary transition-colors hover:bg-surface-cream hover:text-notice-primary focus:outline-none focus:ring-2 focus:ring-focus"
  >
    Feedback Dashboard
  </button>
);
