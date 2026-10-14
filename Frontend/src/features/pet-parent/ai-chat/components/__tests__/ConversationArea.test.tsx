import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMockConversations } from '../../__tests__/testFixtures';
import { useAiChatStore } from '../../store';
import type { Conversation } from '../../types';
import { ConversationArea } from '../ConversationArea';

const conversations = createMockConversations();
const activeConversation = conversations.find(
  (conversation) => conversation.status === 'Active',
) as Conversation;
const closedConversation = conversations.find(
  (conversation) => conversation.status === 'Closed',
) as Conversation;

describe('ConversationArea', () => {
  afterEach(() => {
    useAiChatStore.setState({ awaitingAiReply: {} });
  });

  it('shows the "AI is thinking" indicator while awaiting a reply for this conversation', () => {
    useAiChatStore.setState({ awaitingAiReply: { [activeConversation.id]: true } });

    render(
      <ConversationArea
        conversation={activeConversation}
        variant="panel"
        onSendMessage={vi.fn()}
        onRequestSupport={vi.fn()}
        onCloseConversation={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('AI is thinking')).toBeInTheDocument();
  });

  it('does not show the "AI is thinking" indicator when nothing is pending', () => {
    render(
      <ConversationArea
        conversation={activeConversation}
        variant="panel"
        onSendMessage={vi.fn()}
        onRequestSupport={vi.fn()}
        onCloseConversation={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText('AI is thinking')).not.toBeInTheDocument();
  });

  it('does not show the "AI is thinking" indicator for a different conversation', () => {
    useAiChatStore.setState({ awaitingAiReply: { 'some-other-conversation-id': true } });

    render(
      <ConversationArea
        conversation={activeConversation}
        variant="panel"
        onSendMessage={vi.fn()}
        onRequestSupport={vi.fn()}
        onCloseConversation={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText('AI is thinking')).not.toBeInTheDocument();
  });

  it('renders the empty state when there is no conversation', () => {
    render(
      <ConversationArea
        conversation={null}
        variant="panel"
        onSendMessage={vi.fn()}
        onRequestSupport={vi.fn()}
        onCloseConversation={vi.fn()}
      />,
    );

    expect(
      screen.getByText(
        'Start a new conversation to ask about your pets, bookings or care updates.',
      ),
    ).toBeInTheDocument();
  });

  it('hides the composer and actions, and shows the read-only note, for a closed conversation', () => {
    render(
      <ConversationArea
        conversation={closedConversation}
        variant="page"
        onSendMessage={vi.fn()}
        onRequestSupport={vi.fn()}
        onCloseConversation={vi.fn()}
      />,
    );

    expect(screen.getByText('This conversation is closed and read-only.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send message' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close conversation' })).not.toBeInTheDocument();
  });

  it('shows Contact Customer Support only while AI is handling the conversation', () => {
    render(
      <ConversationArea
        conversation={activeConversation}
        variant="panel"
        onSendMessage={vi.fn()}
        onRequestSupport={vi.fn()}
        onCloseConversation={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Contact Customer Support' })).toBeInTheDocument();
  });

  it('hides Contact Customer Support once support has been requested', () => {
    render(
      <ConversationArea
        conversation={{ ...activeConversation, supportStatus: 'Support Requested' }}
        variant="panel"
        onSendMessage={vi.fn()}
        onRequestSupport={vi.fn()}
        onCloseConversation={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole('button', { name: 'Contact Customer Support' }),
    ).not.toBeInTheDocument();
  });

  it('sends a trimmed message and clears the composer on Enter', async () => {
    const user = userEvent.setup();
    const onSendMessage = vi.fn();
    render(
      <ConversationArea
        conversation={activeConversation}
        variant="panel"
        onSendMessage={onSendMessage}
        onRequestSupport={vi.fn()}
        onCloseConversation={vi.fn()}
      />,
    );

    const input = screen.getByPlaceholderText('Type your message…');
    await user.type(input, 'Hello{Enter}');

    expect(onSendMessage).toHaveBeenCalledWith('Hello');
    expect(input).toHaveValue('');
  });

  it('does not send a whitespace-only message', async () => {
    const user = userEvent.setup();
    const onSendMessage = vi.fn();
    render(
      <ConversationArea
        conversation={activeConversation}
        variant="panel"
        onSendMessage={onSendMessage}
        onRequestSupport={vi.fn()}
        onCloseConversation={vi.fn()}
      />,
    );

    const input = screen.getByPlaceholderText('Type your message…');
    await user.type(input, '   {Enter}');

    expect(onSendMessage).not.toHaveBeenCalled();
  });

  it('calls onRequestSupport when Contact Customer Support is clicked', async () => {
    const user = userEvent.setup();
    const onRequestSupport = vi.fn();
    render(
      <ConversationArea
        conversation={activeConversation}
        variant="panel"
        onSendMessage={vi.fn()}
        onRequestSupport={onRequestSupport}
        onCloseConversation={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Contact Customer Support' }));

    expect(onRequestSupport).toHaveBeenCalledTimes(1);
  });

  it('sends the selected pet from the latest AI clarification', async () => {
    const user = userEvent.setup();
    const onSendMessage = vi.fn();
    const conversation = {
      ...activeConversation,
      messages: [
        {
          id: 'pet-clarification',
          senderRole: 'ai' as const,
          body: 'Which pet are you asking about?',
          timestamp: new Date().toISOString(),
          quickReplies: ['Biscuit', 'Sato'],
        },
      ],
    };
    render(
      <ConversationArea
        conversation={conversation}
        variant="panel"
        onSendMessage={onSendMessage}
        onRequestSupport={vi.fn()}
        onCloseConversation={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Biscuit' }));

    expect(onSendMessage).toHaveBeenCalledWith('Biscuit');
  });

  it('sends the selected all-pets overview option', async () => {
    const user = userEvent.setup();
    const onSendMessage = vi.fn();
    const conversation = {
      ...activeConversation,
      messages: [
        {
          id: 'pet-clarification',
          senderRole: 'ai' as const,
          body: 'Would you like information about a specific pet or all your pets?',
          timestamp: new Date().toISOString(),
          quickReplies: ['Pepper', 'All my pets'],
        },
      ],
    };
    render(
      <ConversationArea
        conversation={conversation}
        variant="panel"
        onSendMessage={onSendMessage}
        onRequestSupport={vi.fn()}
        onCloseConversation={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'All my pets' }));

    expect(onSendMessage).toHaveBeenCalledWith('All my pets');
  });

  it('does not show stale pet choices after a newer owner message', () => {
    const conversation = {
      ...activeConversation,
      messages: [
        {
          id: 'pet-clarification',
          senderRole: 'ai' as const,
          body: 'Which pet are you asking about?',
          timestamp: new Date().toISOString(),
          quickReplies: ['Biscuit', 'Sato'],
        },
        {
          id: 'owner-message',
          senderRole: 'pet_owner' as const,
          body: 'Biscuit',
          timestamp: new Date().toISOString(),
        },
      ],
    };
    render(
      <ConversationArea
        conversation={conversation}
        variant="panel"
        onSendMessage={vi.fn()}
        onRequestSupport={vi.fn()}
        onCloseConversation={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Biscuit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sato' })).not.toBeInTheDocument();
  });

  it('uses the page-variant placeholder and disclaimer only for variant="page"', () => {
    render(
      <ConversationArea
        conversation={activeConversation}
        variant="page"
        onSendMessage={vi.fn()}
        onRequestSupport={vi.fn()}
        onCloseConversation={vi.fn()}
      />,
    );

    expect(
      screen.getByPlaceholderText('Ask about your pets, bookings or care updates…'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Answers use your pet's records at Wagstay/)).toBeInTheDocument();
    expect(screen.queryByText(/PawCare/)).not.toBeInTheDocument();
  });

  it('shows a back control to the list only when the page asks for one', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const { rerender } = render(
      <ConversationArea
        conversation={activeConversation}
        variant="page"
        onSendMessage={vi.fn()}
        onRequestSupport={vi.fn()}
        onCloseConversation={vi.fn()}
        onBack={onBack}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Back to conversations' }));
    expect(onBack).toHaveBeenCalledTimes(1);

    rerender(
      <ConversationArea
        conversation={activeConversation}
        variant="panel"
        onSendMessage={vi.fn()}
        onRequestSupport={vi.fn()}
        onCloseConversation={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Back to conversations' })).not.toBeInTheDocument();
  });

  it('sends with the submit button and labels the composer', async () => {
    const user = userEvent.setup();
    const onSendMessage = vi.fn();
    render(
      <ConversationArea
        conversation={activeConversation}
        variant="panel"
        onSendMessage={onSendMessage}
        onRequestSupport={vi.fn()}
        onCloseConversation={vi.fn()}
      />,
    );

    await user.type(screen.getByRole('textbox', { name: 'Message' }), 'Is Bella eating?');
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    expect(onSendMessage).toHaveBeenCalledWith('Is Bella eating?');
  });
});
