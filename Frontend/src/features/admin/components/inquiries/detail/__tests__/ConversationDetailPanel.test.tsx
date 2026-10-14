import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { InquiryConversation } from '../../../../types/inquiry';
import { ConversationDetailPanel } from '../ConversationDetailPanel';

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

const noopHandlers = {
  onClose: vi.fn(),
  onMinimize: vi.fn(),
  onAssigneeChange: vi.fn(),
  onSaveNotes: vi.fn(),
  onSendReply: vi.fn(),
  onCloseConversation: vi.fn(),
};

describe('ConversationDetailPanel', () => {
  it('shows badges matching the conversation status and support status', () => {
    render(
      <ConversationDetailPanel
        inquiry={makeInquiry({ status: 'Active', supportStatus: 'Support Handling' })}
        isManager
        assigneeOptions={[]}
        {...noopHandlers}
      />,
    );

    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Support Handling')).toBeInTheDocument();
  });

  it('renders the reply field for an open conversation', () => {
    render(
      <ConversationDetailPanel
        inquiry={makeInquiry({ status: 'Active' })}
        isManager
        assigneeOptions={[]}
        {...noopHandlers}
      />,
    );
    expect(screen.getByPlaceholderText(/Reply to Sarah as Customer Support/)).toBeInTheDocument();
  });

  it('omits the reply field once the conversation is closed', () => {
    render(
      <ConversationDetailPanel
        inquiry={makeInquiry({ status: 'Closed' })}
        isManager
        assigneeOptions={[]}
        {...noopHandlers}
      />,
    );
    expect(
      screen.queryByPlaceholderText(/Reply to Sarah as Customer Support/),
    ).not.toBeInTheDocument();
  });

  it('calls onMinimize and onClose from the header buttons', async () => {
    const user = userEvent.setup();
    const onMinimize = vi.fn();
    const onClose = vi.fn();
    render(
      <ConversationDetailPanel
        inquiry={makeInquiry()}
        isManager
        assigneeOptions={[]}
        {...noopHandlers}
        onMinimize={onMinimize}
        onClose={onClose}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Minimise panel' }));
    expect(onMinimize).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Close panel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
