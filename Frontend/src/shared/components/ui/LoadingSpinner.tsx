import React from 'react';

export type LoadingSpinnerSize = 'sm' | 'md' | 'lg';
export type LoadingSpinnerTone = 'accent' | 'muted' | 'inverse';

interface LoadingSpinnerProps {
  size?: LoadingSpinnerSize;
  tone?: LoadingSpinnerTone;
  className?: string;
}

const SIZE_CLASSES: Record<LoadingSpinnerSize, string> = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
};

const TONE_CLASSES: Record<LoadingSpinnerTone, string> = {
  accent: 'text-accent-foreground',
  muted: 'text-notice-muted',
  // Every inverse spinner sits on an action-dark button, so it takes the text colour made for it.
  inverse: 'text-on-action-dark',
};

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  tone = 'accent',
  className = '',
}) => {
  return (
    <svg
      className={`animate-spin ${SIZE_CLASSES[size]} ${TONE_CLASSES[tone]} ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
};
