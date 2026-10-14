// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { chooseDate } from '../../../../../../shared/components/ui/date/testing';
import { SuggestionReview } from '../SuggestionReview';
import type { AdminFeedback, SuggestionWorkflow } from '../../../../types/feedback';

const capturedWorkflow: SuggestionWorkflow = {
  status: 'captured',
  decision: null,
  ownerId: 'u1',
  evidenceSummary: null,
  decisionReason: null,
  nextReviewAt: null,
  events: [{ status: 'captured', timestamp: 'Aug 23, 9:00 AM', actor: 'System' }],
};

const baseFeedback: AdminFeedback = {
  uuid: 'suggestion-1',
  initials: 'SP',
  parentName: 'Suggestion Parent',
  petName: 'Suggestion Pet',
  date: 'Aug 23, 2026',
  timestamp: 1787486400000,
  serviceType: 'Daycare',
  rating: 4,
  aiSummary: 'Parent suggested a quieter arrival window.',
  category: 'Suggestion',
  is_read: true,
  assigneeId: null,
  current_status: 'submitted',
  timeline: [{ step: 'submitted', timestamp: 'Aug 23, 9:00 AM', actor: 'System' }],
  suggestionWorkflow: capturedWorkflow,
};

describe('SuggestionReview', () => {
  it('explains when the database has no persisted decision record', () => {
    const feedbackWithoutWorkflow: AdminFeedback = { ...baseFeedback };
    delete feedbackWithoutWorkflow.suggestionWorkflow;

    render(<SuggestionReview feedback={feedbackWithoutWorkflow} />);

    expect(screen.getByRole('status')).toHaveTextContent(
      'no persisted Suggestion decision record is available yet',
    );
  });

  it('starts review from the captured state', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn().mockResolvedValue(undefined);

    render(<SuggestionReview feedback={baseFeedback} onUpdate={onUpdate} />);

    await user.click(screen.getByRole('button', { name: 'Start Review' }));

    expect(onUpdate).toHaveBeenCalledWith({ status: 'under_review' });
  });

  it('shows the shared spinner and saving label while a workflow action is pending', async () => {
    const user = userEvent.setup();
    let resolveUpdate: () => void = () => undefined;
    const onUpdate = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveUpdate = resolve;
        }),
    );

    render(<SuggestionReview feedback={baseFeedback} onUpdate={onUpdate} />);

    await user.click(screen.getByRole('button', { name: 'Start Review' }));

    const saveButton = screen.getByRole('button', { name: 'Saving...' });
    expect(saveButton).toHaveAttribute('aria-busy', 'true');
    expect(saveButton).toBeDisabled();
    expect(saveButton.querySelector('svg')).toHaveClass('animate-spin');

    resolveUpdate();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Start Review' })).toBeEnabled();
    });
  });

  it('records a decision with evidence and reason', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const underReviewWorkflow: SuggestionWorkflow = {
      ...capturedWorkflow,
      status: 'under_review',
      events: [
        ...capturedWorkflow.events,
        { status: 'under_review', timestamp: 'Aug 23, 9:10 AM', actor: 'u1' },
      ],
    };
    const feedback: AdminFeedback = {
      ...baseFeedback,
      suggestionWorkflow: underReviewWorkflow,
    };

    render(<SuggestionReview feedback={feedback} onUpdate={onUpdate} />);

    await user.selectOptions(screen.getByLabelText('Decision'), 'pilot');
    await user.type(
      screen.getByLabelText('Evidence summary'),
      'Three similar requests this month.',
    );
    await user.type(screen.getByLabelText('Decision reason'), 'Run a bounded trial first.');
    await user.click(screen.getByRole('button', { name: 'Record Decision' }));

    expect(onUpdate).toHaveBeenCalledWith({
      status: 'decision_recorded',
      decision: 'pilot',
      evidenceSummary: 'Three similar requests this month.',
      decisionReason: 'Run a bounded trial first.',
      nextReviewAt: undefined,
    });
  });
  it('sends the picked next review date with a pilot decision', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const feedback: AdminFeedback = {
      ...baseFeedback,
      suggestionWorkflow: { ...capturedWorkflow, status: 'under_review' },
    };

    render(<SuggestionReview feedback={feedback} onUpdate={onUpdate} />);

    await user.selectOptions(screen.getByLabelText('Decision'), 'pilot');
    await user.type(screen.getByLabelText('Evidence summary'), 'Two requests.');
    await user.type(screen.getByLabelText('Decision reason'), 'Try it first.');
    await chooseDate(
      user,
      screen.getByRole('button', { name: 'Next review date (optional)' }),
      '2026-10-15',
    );
    await user.click(screen.getByRole('button', { name: 'Record Decision' }));

    expect(onUpdate).toHaveBeenCalledWith({
      status: 'decision_recorded',
      decision: 'pilot',
      evidenceSummary: 'Two requests.',
      decisionReason: 'Try it first.',
      nextReviewAt: '2026-10-15',
    });
  });
});
