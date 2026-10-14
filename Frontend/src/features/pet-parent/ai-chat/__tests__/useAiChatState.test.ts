import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockConversations } from './testFixtures';
import { useAiChatStore } from '../store';
import { useAiChatState } from '../useAiChatState';

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

beforeEach(() => {
  resetStore();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useAiChatState', () => {
  it('derives the active conversation as current and Closed ones as past', () => {
    const { result } = renderHook(() => useAiChatState());

    expect(result.current.current?.id).toBe('conv-bella-care');
    expect(result.current.past.length).toBeGreaterThan(0);
    for (const conversation of result.current.past) {
      expect(conversation.status).toBe('Closed');
    }
  });

  it('returns null for current once no conversation is active', () => {
    useAiChatStore.getState().closeConversation('conv-bella-care');
    const { result } = renderHook(() => useAiChatState());

    expect(result.current.current).toBeNull();
  });

  it('starts and clears the inactivity poll interval across mount/unmount', () => {
    vi.useFakeTimers();
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

    const { unmount } = renderHook(() => useAiChatState());

    expect(setIntervalSpy).toHaveBeenCalledTimes(1);

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
  });
});
