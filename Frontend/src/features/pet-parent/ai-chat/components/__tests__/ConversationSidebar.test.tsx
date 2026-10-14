import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createMockConversations } from '../../__tests__/testFixtures';
import type { Conversation } from '../../types';
import { ConversationSidebar } from '../ConversationSidebar';

const conversations = createMockConversations();
const current = conversations.find(
  (conversation) => conversation.status === 'Active',
) as Conversation;
const past = conversations.filter((conversation) => conversation.status === 'Closed');

describe('ConversationSidebar', () => {
  it('disables New Conversation and shows the note while a conversation is active', () => {
    render(
      <ConversationSidebar
        current={current}
        past={past}
        selectedId={null}
        onSelect={vi.fn()}
        onStartNew={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'New conversation' })).toBeDisabled();
    expect(
      screen.getByText('Please close your current conversation before starting a new one.'),
    ).toBeInTheDocument();
  });

  it('enables New Conversation and hides the note once nothing is active', () => {
    render(
      <ConversationSidebar
        current={null}
        past={past}
        selectedId={null}
        onSelect={vi.fn()}
        onStartNew={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'New conversation' })).toBeEnabled();
    expect(
      screen.queryByText('Please close your current conversation before starting a new one.'),
    ).not.toBeInTheDocument();
  });

  it('shows the empty state when there are no past conversations', () => {
    render(
      <ConversationSidebar
        current={current}
        past={[]}
        selectedId={null}
        onSelect={vi.fn()}
        onStartNew={vi.fn()}
      />,
    );

    expect(screen.getByText('No past conversations yet.')).toBeInTheDocument();
  });

  it('calls onSelect with a past conversation id when its row is clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <ConversationSidebar
        current={current}
        past={past}
        selectedId={null}
        onSelect={onSelect}
        onStartNew={vi.fn()}
      />,
    );

    await user.click(screen.getByText(past[0].topic));

    expect(onSelect).toHaveBeenCalledWith(past[0].id);
  });

  it('calls onSelect with the current conversation id when its card is clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <ConversationSidebar
        current={current}
        past={past}
        selectedId={null}
        onSelect={onSelect}
        onStartNew={vi.fn()}
      />,
    );

    await user.click(screen.getByText(current.topic));

    expect(onSelect).toHaveBeenCalledWith(current.id);
  });

  it('writes the meta lines on a selected, tinted card in the secondary ink for 4.5:1', () => {
    render(
      <ConversationSidebar
        current={current}
        past={past}
        selectedId={past[0].id}
        onSelect={vi.fn()}
        onStartNew={vi.fn()}
      />,
    );

    const metaOf = (topic: string): Element | null | undefined =>
      screen.getByText(topic).closest('button')?.querySelector('.type-meta');
    expect(metaOf(current.topic)).toHaveClass('text-notice-secondary');
    expect(metaOf(past[0].topic)).toHaveClass('text-notice-secondary');
    // An unselected row sits on white, where the muted ink already passes.
    expect(metaOf(past[1].topic)).not.toHaveClass('text-notice-secondary');
  });

  it('calls onStartNew when New Conversation is clicked while enabled', async () => {
    const user = userEvent.setup();
    const onStartNew = vi.fn();
    render(
      <ConversationSidebar
        current={null}
        past={past}
        selectedId={null}
        onSelect={vi.fn()}
        onStartNew={onStartNew}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'New conversation' }));

    expect(onStartNew).toHaveBeenCalledTimes(1);
  });
});
