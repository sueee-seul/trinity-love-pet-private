import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { InquiryConversation } from '../../../../types/inquiry';
import { ConversationInfoCard } from '../ConversationInfoCard';

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
    aiSummary: 'Summary',
    aiDetectedTopic: 'Feeding',
    aiEscalationReason: null,
    aiRelevantInfo: 'Info',
    messages: [],
    ...overrides,
  };
}

describe('ConversationInfoCard', () => {
  it('is expanded by default and shows the info rows', () => {
    render(<ConversationInfoCard inquiry={makeInquiry()} />);
    expect(screen.getByText('Sarah Nguyen')).toBeInTheDocument();
    expect(screen.getByText('Bella')).toBeInTheDocument();
  });

  it('collapses and re-expands when the header is clicked', async () => {
    const user = userEvent.setup();
    render(<ConversationInfoCard inquiry={makeInquiry()} />);
    const toggle = screen.getByRole('button', { name: 'Conversation Information' });

    await user.click(toggle);
    expect(screen.queryByText('Sarah Nguyen')).not.toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);
    expect(screen.getByText('Sarah Nguyen')).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('renders the Support Requested row only when supportRequestedAt is set', () => {
    const { rerender } = render(
      <ConversationInfoCard inquiry={makeInquiry({ supportRequestedAt: null })} />,
    );
    expect(screen.queryByText('Support Requested')).not.toBeInTheDocument();

    rerender(
      <ConversationInfoCard
        inquiry={makeInquiry({ supportRequestedAt: '2026-06-15T10:05:00.000Z' })}
      />,
    );
    expect(screen.getByText('Support Requested')).toBeInTheDocument();
  });

  it('shows "None" for a null petName', () => {
    render(<ConversationInfoCard inquiry={makeInquiry({ petName: null })} />);
    expect(screen.getByText('None')).toBeInTheDocument();
  });

  it('shows "Unassigned" when there is no assignee', () => {
    render(<ConversationInfoCard inquiry={makeInquiry({ assignee: null })} />);
    expect(screen.getByText('Unassigned')).toBeInTheDocument();
  });
});
