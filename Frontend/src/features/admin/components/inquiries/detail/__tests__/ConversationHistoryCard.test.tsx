import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { InquiryMessage } from '../../../../types/inquiry';
import { ConversationHistoryCard } from '../ConversationHistoryCard';

function makeMessages(count: number): InquiryMessage[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `m${index}`,
    senderRole: 'pet_owner' as const,
    body: `Message ${index}`,
    timestamp: new Date(2026, 5, 15, 10, index).toISOString(),
  }));
}

describe('ConversationHistoryCard', () => {
  it('shows no "View all" toggle when there are 4 or fewer messages', () => {
    render(<ConversationHistoryCard messages={makeMessages(4)} />);
    expect(screen.queryByRole('button', { name: 'View all' })).not.toBeInTheDocument();
    for (let index = 0; index < 4; index += 1) {
      expect(screen.getByText(`Message ${index}`)).toBeInTheDocument();
    }
  });

  it('shows only the last 4 messages by default when there are more than 4', () => {
    render(<ConversationHistoryCard messages={makeMessages(6)} />);
    expect(screen.queryByText('Message 0')).not.toBeInTheDocument();
    expect(screen.queryByText('Message 1')).not.toBeInTheDocument();
    expect(screen.getByText('Message 2')).toBeInTheDocument();
    expect(screen.getByText('Message 5')).toBeInTheDocument();
  });

  it('reveals every message and flips the label after clicking "View all"', async () => {
    const user = userEvent.setup();
    render(<ConversationHistoryCard messages={makeMessages(6)} />);

    await user.click(screen.getByRole('button', { name: 'View all' }));

    expect(screen.getByText('Message 0')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show less' })).toBeInTheDocument();
  });

  it('renders a requested system message with the escalation style, and other system messages neutrally', () => {
    const messages: InquiryMessage[] = [
      {
        id: 's1',
        senderRole: 'system',
        body: 'Customer Support requested',
        timestamp: new Date().toISOString(),
      },
      {
        id: 's2',
        senderRole: 'system',
        body: 'John from Customer Support joined',
        timestamp: new Date().toISOString(),
      },
    ];
    render(<ConversationHistoryCard messages={messages} />);

    const requested = screen.getByText(/Customer Support requested/);
    const joined = screen.getByText(/joined/);
    expect(requested).toHaveClass('bg-status-warning/10');
    expect(joined).toHaveClass('bg-surface-deep');
  });

  it('gives each sender role a distinct message background', () => {
    const messages: InquiryMessage[] = [
      {
        id: 'm1',
        senderRole: 'pet_owner',
        body: 'Pet owner message',
        timestamp: new Date().toISOString(),
      },
      { id: 'm2', senderRole: 'ai', body: 'AI message', timestamp: new Date().toISOString() },
      {
        id: 'm3',
        senderRole: 'staff',
        authorName: 'John',
        body: 'Staff message',
        timestamp: new Date().toISOString(),
      },
    ];
    render(<ConversationHistoryCard messages={messages} />);

    const petOwnerBubble = screen.getByText('Pet owner message');
    const aiBubble = screen.getByText('AI message');
    const staffBubble = screen.getByText('Staff message');

    expect(petOwnerBubble).toHaveClass('bg-apricot-cream-100');
    expect(aiBubble).toHaveClass('bg-surface-deep');
    expect(staffBubble).toHaveClass('bg-status-success/20');

    const backgrounds = [petOwnerBubble, aiBubble, staffBubble].map((bubble) =>
      Array.from(bubble.classList).find((className) => className.startsWith('bg-')),
    );
    expect(new Set(backgrounds).size).toBe(3);
  });

  it("gives a manager's messages a different background than a regular staff member's", () => {
    const messages: InquiryMessage[] = [
      {
        id: 'm1',
        senderRole: 'staff',
        authorName: 'Priya',
        authorRole: 'staff',
        body: 'Regular staff reply',
        timestamp: new Date().toISOString(),
      },
      {
        id: 'm2',
        senderRole: 'staff',
        authorName: 'Alex',
        authorRole: 'manager',
        body: 'Manager reply',
        timestamp: new Date().toISOString(),
      },
    ];
    render(<ConversationHistoryCard messages={messages} />);

    const staffBubble = screen.getByText('Regular staff reply');
    const managerBubble = screen.getByText('Manager reply');

    expect(staffBubble).toHaveClass('bg-status-success/20');
    expect(managerBubble).toHaveClass('bg-status-warning/20');
    expect(managerBubble.className).not.toBe(staffBubble.className);
  });

  it('labels the sender name with "(Staff)" or "(Manager)" depending on authorRole', () => {
    const messages: InquiryMessage[] = [
      {
        id: 'm1',
        senderRole: 'staff',
        authorName: 'Priya',
        authorRole: 'staff',
        body: 'Regular staff reply',
        timestamp: new Date().toISOString(),
      },
      {
        id: 'm2',
        senderRole: 'staff',
        authorName: 'Alex',
        authorRole: 'manager',
        body: 'Manager reply',
        timestamp: new Date().toISOString(),
      },
    ];
    render(<ConversationHistoryCard messages={messages} />);

    expect(screen.getByText(/Priya \(Staff\)/)).toBeInTheDocument();
    expect(screen.getByText(/Alex \(Manager\)/)).toBeInTheDocument();
  });
});
