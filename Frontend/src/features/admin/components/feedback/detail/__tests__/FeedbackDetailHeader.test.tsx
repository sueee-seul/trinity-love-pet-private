// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FeedbackDetailHeader } from '../FeedbackDetailHeader';
import type { AdminFeedback } from '../../../../types/feedback';

const baseFeedback: AdminFeedback = {
  uuid: 'feedback-1',
  initials: 'JD',
  parentName: 'John Doe',
  petName: 'Buddy',
  date: 'Aug 23, 2026',
  timestamp: 1787486400000,
  serviceType: 'Daycare',
  rating: 5,
  aiSummary: 'Feedback summary',
  category: 'Issue',
  is_read: true,
  assigneeId: null,
  current_status: 'submitted',
  timeline: [{ step: 'submitted', timestamp: 'Aug 23, 9:00 AM', actor: 'System' }],
};

describe('FeedbackDetailHeader workflow actions', () => {
  it('keeps Start Review for Issue feedback', async () => {
    const user = userEvent.setup();
    const onUpdateStatus = vi.fn();

    render(<FeedbackDetailHeader feedback={baseFeedback} onUpdateStatus={onUpdateStatus} />);

    await user.click(screen.getByRole('button', { name: 'Start Review' }));

    expect(onUpdateStatus).toHaveBeenCalledWith('feedback-1', 'review_started');
  });

  it.each(['Suggestion', 'Praise'] as const)(
    'hides complaint actions for %s feedback',
    (category) => {
      render(<FeedbackDetailHeader feedback={{ ...baseFeedback, category }} />);

      expect(screen.queryByRole('button', { name: 'Start Review' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Complete Fact Check' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Send Response' })).not.toBeInTheDocument();
    },
  );
});
