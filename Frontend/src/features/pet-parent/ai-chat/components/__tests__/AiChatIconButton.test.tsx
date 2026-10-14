import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { createMockConversations } from '../../__tests__/testFixtures';
import { useAiChatStore } from '../../store';
import { AiChatIconButton } from '../AiChatIconButton';

function resetStore(): void {
  const conversations = createMockConversations();
  useAiChatStore.setState({
    conversationsById: Object.fromEntries(
      conversations.map((conversation) => [conversation.id, conversation]),
    ),
    conversationIds: conversations.map((conversation) => conversation.id),
    isPanelOpen: false,
    isPanelMinimized: false,
  });
}

const renderAt = (path = '/parent'): void => {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/parent/ai-chat" element={<h1>Chat page</h1>} />
        <Route path="*" element={<AiChatIconButton />} />
      </Routes>
    </MemoryRouter>,
  );
};

beforeEach(() => {
  resetStore();
});

describe('AiChatIconButton', () => {
  it('shows the active-conversation dot when an active conversation exists', () => {
    renderAt();
    const button = screen.getByRole('button', { name: 'Open AI Chat' });
    expect(button.querySelector('span.bg-accent-foreground')).not.toBeNull();
  });

  it('hides the active-conversation dot once no conversation is active', () => {
    useAiChatStore.getState().closeConversation('conv-bella-care');
    renderAt();
    const button = screen.getByRole('button', { name: 'Open AI Chat' });
    expect(button.querySelector('span.bg-accent-foreground')).toBeNull();
  });

  it('opens the panel on click when closed', async () => {
    const user = userEvent.setup();
    renderAt();

    await user.click(screen.getByRole('button', { name: 'Open AI Chat' }));

    expect(useAiChatStore.getState().isPanelOpen).toBe(true);
  });

  it('closes the panel on click when already open', async () => {
    useAiChatStore.setState({ isPanelOpen: true });
    const user = userEvent.setup();
    renderAt();

    await user.click(screen.getByRole('button', { name: 'Open AI Chat' }));

    expect(useAiChatStore.getState().isPanelOpen).toBe(false);
  });

  it('leads to the chat page on booking, where the floating panel stays hidden', async () => {
    const user = userEvent.setup();
    renderAt('/parent/booking');

    expect(screen.queryByRole('button', { name: 'Open AI Chat' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Open AI Chat' }));

    expect(screen.getByRole('heading', { name: 'Chat page' })).toBeInTheDocument();
    expect(useAiChatStore.getState().isPanelOpen).toBe(false);
  });
});
