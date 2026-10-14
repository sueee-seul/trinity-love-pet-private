import { useEffect } from 'react';
import {
  buildPetParentConversationEventsUrl,
  subscribeToConversationServerEvents,
} from '../../../shared/events/conversationServerEvents';
import { isPersistedConversationId, useAiChatStore } from './store';

/**
 * Keeps the active conversation live: subscribes to its SSE stream so a
 * staff reply (or the pet owner's own message, echoed back) shows up without
 * a reload. Mounted once at the portal level so it's active whenever a
 * persisted conversation is open, not just while the chat panel is visible.
 */
export const useAiChatLiveUpdates = (): void => {
  const activeConversation = useAiChatStore((state) => state.activeConversation());
  const refreshConversation = useAiChatStore((state) => state.refreshConversation);
  const activeId = activeConversation?.id ?? null;

  useEffect(() => {
    if (!activeId || !isPersistedConversationId(activeId)) {
      return;
    }
    return subscribeToConversationServerEvents(
      buildPetParentConversationEventsUrl(activeId),
      activeId,
      () => {
        void refreshConversation(activeId);
      },
    );
  }, [activeId, refreshConversation]);
};
