import { useEffect } from 'react';
import { useAiChatStore } from './store';
import type { Conversation } from './types';

const INACTIVITY_POLL_MS = 15_000;

interface AiChatState {
  current: Conversation | null;
  past: Conversation[];
  inactivityPromptVisible: boolean;
}

/** Only used on the expanded AI Chat page. Runs the idle-timer poll that surfaces the inactivity modal. */
export function useAiChatState(): AiChatState {
  const conversationsById = useAiChatStore((state) => state.conversationsById);
  const conversationIds = useAiChatStore((state) => state.conversationIds);
  const inactivityPromptVisible = useAiChatStore((state) => state.inactivityPromptVisible);
  const checkInactivity = useAiChatStore((state) => state.checkInactivity);

  useEffect(() => {
    const interval = setInterval(checkInactivity, INACTIVITY_POLL_MS);
    return (): void => clearInterval(interval);
  }, [checkInactivity]);

  const conversations = conversationIds
    .map((id) => conversationsById[id])
    .filter((conversation): conversation is Conversation => Boolean(conversation));

  return {
    current: conversations.find((conversation) => conversation.status === 'Active') ?? null,
    past: conversations.filter((conversation) => conversation.status === 'Closed'),
    inactivityPromptVisible,
  };
}
