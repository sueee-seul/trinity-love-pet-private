import React from 'react';
import { LoadingSpinner, type LoadingSpinnerSize } from './LoadingSpinner';

export type LoadingStateVariant = 'page' | 'section';

interface LoadingStateProps {
  label: string;
  variant?: LoadingStateVariant;
  spinnerSize?: LoadingSpinnerSize;
  className?: string;
  children?: React.ReactNode;
}

const VARIANT_CLASSES: Record<LoadingStateVariant, string> = {
  page: 'flex min-h-[16rem] items-center justify-center',
  section: 'flex flex-col items-center justify-center gap-3 py-12',
};

export const LoadingState: React.FC<LoadingStateProps> = ({
  label,
  variant = 'section',
  spinnerSize = variant === 'page' ? 'lg' : 'md',
  className = '',
  children,
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={`${VARIANT_CLASSES[variant]} ${className}`}
    >
      <div className="flex items-center justify-center gap-3">
        <LoadingSpinner size={spinnerSize} tone="muted" />
        <span className="type-body text-notice-muted">{label}</span>
      </div>
      {children}
    </div>
  );
};
