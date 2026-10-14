// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FeedbackMixChart } from '../FeedbackMixChart';
import type { GoogleReviewDashboard } from '../../../../types/googleReviewDashboard';

describe('FeedbackMixChart', () => {
  it('shows percentages with one decimal place', () => {
    const mix: GoogleReviewDashboard['feedbackMix'] = {
      total: 31,
      segments: [
        { type: 'issue', count: 2, percentage: 6.5 },
        { type: 'suggestion', count: 1, percentage: 3.2 },
        { type: 'praise', count: 28, percentage: 90.3 },
      ],
    };

    render(<FeedbackMixChart mix={mix} />);

    expect(screen.getByText('6.5%')).toBeInTheDocument();
    expect(screen.getByText('3.2%')).toBeInTheDocument();
    expect(screen.getByText('90.3%')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Help for Feedback Mix' })).toHaveAttribute(
      'title',
      'Shows each review in one category: Issue, Suggestion, Praise, or Unclassified. Use it to see which feedback type is most common in the selected period; percentages are review shares, not star ratings.',
    );
  });

  it('keeps the selected-period empty state truthful', () => {
    render(<FeedbackMixChart mix={{ total: 0, segments: [] }} />);

    expect(screen.getByText('No reviews in the selected period.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Help for Feedback Mix' })).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('shows a single category as 100.0 percent', () => {
    render(
      <FeedbackMixChart
        mix={{ total: 1, segments: [{ type: 'praise', count: 1, percentage: 100 }] }}
      />,
    );

    expect(screen.getByText('100.0%')).toBeInTheDocument();
  });
});
