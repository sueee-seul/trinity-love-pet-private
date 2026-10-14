import { useAiChatStore } from './store';

/**
 * Hands something to a person through the parent's chat: the open conversation (or a new one) asks
 * for our team, then carries `text`. Support is asked for first, so the assistant does not answer
 * a message meant for staff. A conversation already with our team just gets the message.
 */
export async function sendToTeamInChat(text: string): Promise<void> {
  // The open conversation is only known once the list has loaded; otherwise a second one starts.
  await useAiChatStore.getState().loadConversations();
  useAiChatStore.getState().startNewConversation();
  const chat = useAiChatStore.getState();
  const conversation = chat.activeConversation();
  if (!conversation) return;
  if (conversation.supportStatus === 'AI Handling') chat.requestSupport(conversation.id);
  useAiChatStore.getState().sendMessage(conversation.id, text);
}
