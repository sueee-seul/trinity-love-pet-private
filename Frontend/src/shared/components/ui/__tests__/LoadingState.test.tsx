// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LoadingSpinner } from '../LoadingSpinner';
import { LoadingState } from '../LoadingState';

describe('loading UI', () => {
  it('announces a contextual loading state and keeps its spinner decorative', () => {
    render(<LoadingState label="Loading feedback" variant="page" />);

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Loading feedback');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(status.querySelector('svg')).toHaveClass('h-8', 'w-8', 'text-notice-muted');
  });

  it('supports button-sized inverse spinners without an accessible name', () => {
    render(<LoadingSpinner size="sm" tone="inverse" />);

    const spinner = document.querySelector('svg');
    expect(spinner).toHaveAttribute('aria-hidden', 'true');
    expect(spinner).toHaveClass('h-4', 'w-4', 'text-on-action-dark', 'animate-spin');
  });
});
