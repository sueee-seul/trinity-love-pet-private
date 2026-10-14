import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { InquiryConversation } from '../../../../types/inquiry';
import { AiSummaryCard } from '../AiSummaryCard';

function makeInquiry(overrides: Partial<InquiryConversation> = {}): InquiryConversation {
  return {
    uuid: 'inq-1',
    parentName: 'Sarah Nguyen',
    parentInitials: 'SN',
    petName: 'Bella',
    topic: "Bella's Care Updates",
    topicCategory: 'Feeding',
    startedAt: '2026-06-15T10:00:00.000Z',
    durationMinutes: 20,
    status: 'Active',
    supportStatus: 'AI Handling',
    supportRequestedAt: null,
    assignee: null,
    notes: '',
    aiSummary: 'Sarah asked about feeding.',
    aiDetectedTopic: 'Feeding / diet plan',
    aiEscalationReason: null,
    aiRelevantInfo: 'Fed at noon.',
    messages: [],
    ...overrides,
  };
}

describe('AiSummaryCard', () => {
  it('is expanded by default', () => {
    render(<AiSummaryCard inquiry={makeInquiry()} />);
    expect(screen.getByText('Sarah asked about feeding.')).toBeInTheDocument();
  });

  it('collapses and re-expands when the header is clicked', async () => {
    const user = userEvent.setup();
    render(<AiSummaryCard inquiry={makeInquiry()} />);
    const toggle = screen.getByRole('button', { name: 'AI Summary' });

    await user.click(toggle);
    expect(screen.queryByText('Sarah asked about feeding.')).not.toBeInTheDocument();

    await user.click(toggle);
    expect(screen.getByText('Sarah asked about feeding.')).toBeInTheDocument();
  });

  it('renders the escalation-reason row only when aiEscalationReason is set', () => {
    const { rerender } = render(
      <AiSummaryCard inquiry={makeInquiry({ aiEscalationReason: null })} />,
    );
    expect(screen.queryByText('Reason for escalation')).not.toBeInTheDocument();

    rerender(<AiSummaryCard inquiry={makeInquiry({ aiEscalationReason: 'Needs a human.' })} />);
    expect(screen.getByText('Reason for escalation')).toBeInTheDocument();
    expect(screen.getByText('Needs a human.')).toBeInTheDocument();
  });
});
