// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FeedbackCard } from '../FeedbackCard';
import type { FeedbackListItem } from '../../../types/feedback';

const feedback: FeedbackListItem = {
  uuid: 'feedback-1',
  initials: 'IS',
  parentName: 'Issue Parent',
  petName: 'Issue Pet',
  date: 'Aug 23, 2026',
  timestamp: Date.parse('2026-08-23T11:05:07+12:00'),
  serviceType: 'Daycare',
  rating: 1,
  aiSummary: 'The parent reported a problem with the service.',
  category: 'Issue',
  is_read: false,
  assigneeId: 'staff-1',
  current_status: 'submitted',
};

describe('FeedbackCard submission metadata', () => {
  it('shows the precise submitted time and keeps the reading summary', () => {
    render(
      <FeedbackCard
        feedback={feedback}
        onViewDetails={vi.fn()}
        onDelete={vi.fn().mockResolvedValue(undefined)}
        selectionMode={false}
        isSelected={false}
        isBusy={false}
        isDeleting={false}
        onToggleSelected={vi.fn()}
      />,
    );

    expect(screen.getByText(/Aug 23, 2026/)).toBeInTheDocument();
    expect(document.querySelector('time')).toHaveTextContent('11:05:07');
    expect(screen.getByText(feedback.aiSummary)).toBeInTheDocument();
    expect(screen.queryByText('Assigned to staff-1')).not.toBeInTheDocument();
  });

  it('confirms deletion and invokes the card delete action', () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <FeedbackCard
        feedback={feedback}
        onViewDetails={vi.fn()}
        onDelete={onDelete}
        selectionMode={false}
        isSelected={false}
        isBusy={false}
        isDeleting={false}
        onToggleSelected={vi.fn()}
      />,
    );

    screen.getByRole('button', { name: 'Delete feedback from Issue Parent and Issue Pet' }).click();

    expect(confirmSpy).toHaveBeenCalledWith(
      'Delete feedback from Issue Parent & Issue Pet? This action cannot be undone.',
    );
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('does not invoke deletion when confirmation is cancelled', () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(
      <FeedbackCard
        feedback={feedback}
        onViewDetails={vi.fn()}
        onDelete={onDelete}
        selectionMode={false}
        isSelected={false}
        isBusy={false}
        isDeleting={false}
        onToggleSelected={vi.fn()}
      />,
    );

    screen.getByRole('button', { name: 'Delete feedback from Issue Parent and Issue Pet' }).click();

    expect(onDelete).not.toHaveBeenCalled();
  });
});
