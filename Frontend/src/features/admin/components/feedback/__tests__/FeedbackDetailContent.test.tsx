// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { FeedbackDetailContent } from '../FeedbackDetailContent';
import type { AdminFeedback } from '../../../types/feedback';

vi.mock('../detail/FeedbackDetailHeader', () => ({
  FeedbackDetailHeader: (): ReactElement => <div data-testid="feedback-detail-header" />,
}));

vi.mock('../detail/AIInsightsSummary', () => ({
  AIInsightsSummary: (): null => null,
}));

vi.mock('../detail/OriginalDetailsGrid', () => ({
  OriginalDetailsGrid: (): null => null,
}));

vi.mock('../detail/AudioTranscript', () => ({
  AudioTranscript: (): null => null,
}));

vi.mock('../detail/DraftResponseEditor', () => ({
  DraftResponseEditor: (): ReactElement => <div data-testid="draft-response-editor" />,
}));

vi.mock('../detail/InteractionProgress', () => ({
  InteractionProgress: (): ReactElement => <div>Interaction Progress</div>,
}));

vi.mock('../detail/SuggestionReview', () => ({
  SuggestionReview: (): ReactElement => <div>Suggestion Review</div>,
}));

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

describe('FeedbackDetailContent workflow isolation', () => {
  it('keeps the complaint Progress tab and timeline for Issue feedback', async () => {
    const user = userEvent.setup();

    render(<FeedbackDetailContent feedback={baseFeedback} />);

    await user.click(screen.getByRole('button', { name: 'Progress' }));

    expect(screen.getByText('Interaction Progress')).toBeInTheDocument();
  });

  it.each(['Suggestion', 'Praise'] as const)(
    'does not expose complaint progress for %s feedback',
    (category) => {
      render(<FeedbackDetailContent feedback={{ ...baseFeedback, category }} />);

      expect(screen.getByRole('button', { name: 'Detail' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Progress' })).not.toBeInTheDocument();
      expect(screen.queryByText('Interaction Progress')).not.toBeInTheDocument();
    },
  );

  it('exposes Review for Suggestion without exposing complaint Progress', () => {
    render(<FeedbackDetailContent feedback={{ ...baseFeedback, category: 'Suggestion' }} />);

    expect(screen.getByRole('button', { name: 'Review' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Progress' })).not.toBeInTheDocument();
  });

  it('calls the back action for the Internal Feedback card list', async () => {
    const user = userEvent.setup();
    const onBackToCards = vi.fn();

    render(<FeedbackDetailContent feedback={baseFeedback} onBackToCards={onBackToCards} />);
    await user.click(screen.getByRole('button', { name: 'Back to Feedback Cards' }));

    expect(onBackToCards).toHaveBeenCalledTimes(1);
  });
});
