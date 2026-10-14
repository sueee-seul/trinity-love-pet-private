// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FeedbackTable } from '../FeedbackTable';
import type { FeedbackListItem } from '../../../types/feedback';

const feedbacks: FeedbackListItem[] = [
  {
    uuid: 'issue-1',
    initials: 'IS',
    parentName: 'Issue Parent',
    petName: 'Issue Pet',
    date: 'Aug 23, 2026',
    timestamp: Date.parse('2026-08-23T11:05:07+12:00'),
    serviceType: 'Daycare',
    rating: 1,
    aiSummary: 'Issue summary',
    category: 'Issue',
    is_read: false,
    assigneeId: null,
    current_status: 'submitted',
  },
  {
    uuid: 'suggestion-1',
    initials: 'SU',
    parentName: 'Suggestion Parent',
    petName: 'Suggestion Pet',
    date: 'Aug 22, 2026',
    timestamp: 1787400000000,
    serviceType: 'Boarding',
    rating: 4,
    aiSummary: 'Suggestion summary',
    category: 'Suggestion',
    is_read: true,
    assigneeId: null,
    current_status: 'submitted',
    suggestionWorkflow: { status: 'under_review', decision: null },
  },
  {
    uuid: 'praise-1',
    initials: 'PR',
    parentName: 'Praise Parent',
    petName: 'Praise Pet',
    date: 'Aug 21, 2026',
    timestamp: 1787313600000,
    serviceType: 'Grooming',
    rating: 5,
    aiSummary: 'Praise summary',
    category: 'Praise',
    is_read: true,
    assigneeId: null,
    current_status: 'submitted',
  },
];

describe('FeedbackTable workflow labels', () => {
  it('shows complaint progress only for Issue feedback', () => {
    render(<FeedbackTable feedbacks={feedbacks} onViewDetails={vi.fn()} />);

    expect(screen.getByText('Submitted', { selector: 'td' })).toBeInTheDocument();
    expect(screen.getByText('Under review')).toBeInTheDocument();
    expect(screen.getByText('Not applicable')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Assignee' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('renders a precise submitted time without repeating the summary in the table', () => {
    render(<FeedbackTable feedbacks={feedbacks} onViewDetails={vi.fn()} />);

    expect(screen.getByRole('columnheader', { name: 'Submitted' })).toBeInTheDocument();
    expect(screen.getByText('11:05:07')).toBeInTheDocument();
    expect(screen.queryByText('Issue summary')).not.toBeInTheDocument();
  });

  it('uses Google-specific reviewer metadata instead of the default service label', () => {
    render(
      <FeedbackTable
        feedbacks={feedbacks}
        onViewDetails={vi.fn()}
        source="google-reviews"
        renderReviewerMeta={(feedback) => (
          <button type="button">View image for {feedback.parentName}</button>
        )}
      />,
    );

    expect(screen.getByRole('button', { name: 'View image for Issue Parent' })).toBeInTheDocument();
    expect(screen.queryByText('Daycare')).not.toBeInTheDocument();
  });
});
