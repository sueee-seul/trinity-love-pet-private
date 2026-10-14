import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AiChatPage } from '../pages/AiChatPage';
import { createMockConversations } from './testFixtures';
import { INACTIVITY_TIMEOUT_MS, useAiChatStore } from '../store';

function resetStore(): void {
  const conversations = createMockConversations();
  useAiChatStore.setState({
    conversationsById: Object.fromEntries(
      conversations.map((conversation) => [conversation.id, conversation]),
    ),
    conversationIds: conversations.map((conversation) => conversation.id),
    isPanelOpen: false,
    isPanelMinimized: false,
    inactivityPromptVisible: false,
    lastActivityAt: Date.now(),
  });
}

const INACTIVITY_POLL_MS = 15_000;

beforeEach(() => {
  vi.useFakeTimers();
  resetStore();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('10-minute inactivity flow (integration)', () => {
  it('surfaces the inactivity modal on the expanded page once idle past the threshold', () => {
    render(<AiChatPage />);
    expect(screen.queryByText('Do you still need help?')).not.toBeInTheDocument();

    act(() => {
      useAiChatStore.getState().sendMessage('conv-bella-care', 'Has Bella eaten?');
    });

    // Advance past both the idle threshold and at least one poll tick so useAiChatState's
    // interval actually calls checkInactivity.
    act(() => {
      vi.advanceTimersByTime(INACTIVITY_TIMEOUT_MS + INACTIVITY_POLL_MS);
    });

    expect(screen.getByText('Do you still need help?')).toBeInTheDocument();
  });

  it('does not re-trigger immediately after choosing "Continue with AI"', () => {
    useAiChatStore.setState({ inactivityPromptVisible: true });
    render(<AiChatPage />);
    expect(screen.getByText('Do you still need help?')).toBeInTheDocument();

    act(() => {
      useAiChatStore.getState().continueWithAi();
    });
    act(() => {
      vi.advanceTimersByTime(INACTIVITY_POLL_MS);
    });

    expect(screen.queryByText('Do you still need help?')).not.toBeInTheDocument();
  });
});
