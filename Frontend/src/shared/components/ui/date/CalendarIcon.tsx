import React from 'react';

/** Small calendar mark for the date trigger. Decorative: the button text carries the meaning. */
export const CalendarIcon: React.FC = () => (
  <svg
    className="h-4 w-4 shrink-0 text-notice-muted"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M16 3v4M8 3v4M3 10h18" />
  </svg>
);
