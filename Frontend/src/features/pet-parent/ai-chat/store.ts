import { create } from 'zustand';
import { fetchParentProfile } from '../profile/parentProfileApi';
import {
  closeConversationOnServer,
  createConversationOnServer,
  fetchConversation,
  fetchConversations,
  postMessageOnServer,
  requestSupportOnServer,
} from './conversationApi';
import { NEW_CONVERSATION_TOPIC, SUPPORT_REQUESTED_NOTICE } from './conversationText';
import type { Conversation, Message, MessageSenderRole } from './types';

/** Real product default is 10 minutes; kept as one constant so it's easy to shorten for manual testing. */
export const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000;
/**
 * Safety net for the "AI is thinking" indicator: the real reply comes from a
 * server-side LLM round trip (sometimes two, sequentially) with no progress
 * events, so there's no reliable "it failed" signal to react to, only
 * "it hasn't arrived yet". Clears the indicator on its own after this long so
 * a slow/failed reply doesn't leave it spinning forever; a reply that arrives
 * later still lands normally via refreshConversation.
 */
export const AWAITING_AI_REPLY_TIMEOUT_MS = 3 * 60 * 1000;

/** A conversation not yet round-tripped to the backend uses this prefix; a real one is a Mongo ObjectId. */
const LOCAL_CONVERSATION_PREFIX = 'conv-';
const MONGO_OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/i;
export const isPersistedConversationId = (id: string): boolean => MONGO_OBJECT_ID_PATTERN.test(id);

/**
 * Merges a fresh server read back into local state without discarding
 * client-only messages that are never persisted server-side. Currently that is just
 * the "Customer Support requested" system message appended optimistically in
 * `requestSupport` below. That message never matches anything from the
 * server, so it's kept as-is. The pet owner's own optimistic echo, though,
 * has the same shape (a local id) but *does* now exist on the server, so it's
 * dropped in favour of the real copy to avoid a duplicate.
 */
function mergeMessages(serverMessages: Message[], previousMessages: Message[]): Message[] {
  const localOnly = previousMessages.filter(
    (message) => !isPersistedConversationId(message.id) && message.senderRole !== 'pet_owner',
  );
  return [...serverMessages, ...localOnly].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
}

/**
 * Local ids created by `startNewConversation` that have never had a message
 * sent. Nothing exists in the database for these yet, by design (a
 * conversation is only created once the user actually sends something).
 */
const unpersistedConversationIds = new Set<string>();

/**
 * Local conversation id -> the in-flight request to create it, resolving to
 * the real Mongo id. Populated the moment the first message is sent. A
 * second message (or a close) sent before that request settles chains onto
 * this instead of triggering a duplicate create or being dropped. It is not store
 * state, since promises aren't serialisable/reactive data.
 */
const pendingConversationPersistence = new Map<string, Promise<string>>();

let messageCounter = 0;
function nextMessageId(): string {
  messageCounter += 1;
  return `msg-${Date.now()}-${messageCounter}`;
}

function appendMessage(
  conversation: Conversation,
  senderRole: MessageSenderRole,
  body: string,
  authorName?: string,
): Conversation {
  const message: Message = {
    id: nextMessageId(),
    senderRole,
    body,
    timestamp: new Date().toISOString(),
    ...(authorName ? { authorName } : {}),
  };
  return { ...conversation, messages: [...conversation.messages, message] };
}

interface AiChatStoreState {
  conversationsById: Record<string, Conversation>;
  conversationIds: string[];
  petNamesByUuid: Map<string, string>;
  parentName: string;
  hasLoadedConversations: boolean;
  isLoadingConversations: boolean;
  isPanelOpen: boolean;
  isPanelMinimized: boolean;
  inactivityPromptVisible: boolean;
  lastActivityAt: number;
  /** Conversation ids with a pet_owner message sent to the AI that hasn't been answered yet. */
  awaitingAiReply: Record<string, true>;

  activeConversation: () => Conversation | null;
  pastConversations: () => Conversation[];

  loadConversations: () => Promise<void>;
  refreshConversation: (conversationId: string) => Promise<void>;
  openPanel: () => void;
  closePanel: () => void;
  minimizePanel: () => void;
  expandPanel: () => void;
  startNewConversation: () => void;
  sendMessage: (conversationId: string, body: string) => void;
  requestSupport: (conversationId: string) => void;
  closeConversation: (conversationId: string) => void;
  continueWithAi: () => void;
  dismissInactivityPrompt: () => void;
  checkInactivity: () => void;
}

export const useAiChatStore = create<AiChatStoreState>((set, get) => {
  /**
   * Creates the conversation on the backend the first time it's needed
   * (first message sent, or a close arriving before that message lands),
   * reusing an already-in-flight request instead of creating a duplicate.
   * Swaps the local id for the real one once it resolves, carrying over any
   * messages appended to it in the meantime.
   */
  const ensureConversationPersisted = (localId: string): Promise<string> => {
    const existing = pendingConversationPersistence.get(localId);
    if (existing) {
      return existing;
    }

    const persistence = createConversationOnServer(get().petNamesByUuid)
      .then((persisted) => {
        set((current) => {
          const local = current.conversationsById[localId];
          if (!local) {
            return current;
          }
          const remainingById = { ...current.conversationsById };
          delete remainingById[localId];
          const remainingAwaiting = { ...current.awaitingAiReply };
          const wasAwaiting = remainingAwaiting[localId];
          delete remainingAwaiting[localId];
          if (wasAwaiting) {
            remainingAwaiting[persisted.id] = true;
          }
          return {
            conversationsById: { ...remainingById, [persisted.id]: { ...local, id: persisted.id } },
            conversationIds: current.conversationIds.map((id) =>
              id === localId ? persisted.id : id,
            ),
            awaitingAiReply: remainingAwaiting,
          };
        });
        return persisted.id;
      })
      .catch((error: unknown) => {
        console.error('Failed to persist new conversation', error);
        throw error;
      })
      .finally(() => {
        pendingConversationPersistence.delete(localId);
      });
    pendingConversationPersistence.set(localId, persistence);
    return persistence;
  };

  return {
    conversationsById: {},
    conversationIds: [],
    petNamesByUuid: new Map(),
    parentName: '',
    hasLoadedConversations: false,
    isLoadingConversations: false,
    isPanelOpen: false,
    isPanelMinimized: false,
    inactivityPromptVisible: false,
    lastActivityAt: Date.now(),
    awaitingAiReply: {},

    activeConversation: (): Conversation | null => {
      const state = get();
      const activeId = state.conversationIds.find(
        (id) => state.conversationsById[id]?.status === 'Active',
      );
      return activeId ? state.conversationsById[activeId] : null;
    },

    pastConversations: (): Conversation[] => {
      const state = get();
      return state.conversationIds
        .map((id) => state.conversationsById[id])
        .filter((conversation): conversation is Conversation => conversation.status === 'Closed');
    },

    loadConversations: async (): Promise<void> => {
      if (get().hasLoadedConversations || get().isLoadingConversations) {
        return;
      }
      set({ isLoadingConversations: true });
      try {
        const profile = await fetchParentProfile();
        const petNamesByUuid = new Map(profile.pets.map((pet) => [pet.id, pet.name]));
        const conversations = await fetchConversations(petNamesByUuid);
        set({
          conversationsById: Object.fromEntries(
            conversations.map((conversation) => [conversation.id, conversation]),
          ),
          conversationIds: conversations.map((conversation) => conversation.id),
          petNamesByUuid,
          parentName: profile.owner.fullName.trim(),
          hasLoadedConversations: true,
          isLoadingConversations: false,
        });
      } catch (error) {
        console.error('Failed to load conversations', error);
        set({ isLoadingConversations: false });
      }
    },

    refreshConversation: async (conversationId): Promise<void> => {
      if (!isPersistedConversationId(conversationId)) {
        return;
      }
      try {
        const fresh = await fetchConversation(conversationId, get().petNamesByUuid);
        set((state) => {
          const previous = state.conversationsById[conversationId];
          if (!previous) {
            return state;
          }
          // Sending a message triggers an SSE refresh almost immediately (an
          // echo of the pet owner's own message, published before the AI
          // pipeline even starts), then again once the reply lands. Only the
          // second one, with a genuinely new `ai` message, should clear the
          // "thinking" indicator.
          const previousIds = new Set(previous.messages.map((message) => message.id));
          const hasNewAiReply = fresh.messages.some(
            (message) => message.senderRole === 'ai' && !previousIds.has(message.id),
          );
          let awaitingAiReply = state.awaitingAiReply;
          if (hasNewAiReply && awaitingAiReply[conversationId]) {
            awaitingAiReply = { ...awaitingAiReply };
            delete awaitingAiReply[conversationId];
          }
          return {
            conversationsById: {
              ...state.conversationsById,
              [conversationId]: {
                ...fresh,
                messages: mergeMessages(fresh.messages, previous.messages),
              },
            },
            awaitingAiReply,
          };
        });
      } catch (error) {
        console.error('Failed to refresh conversation', error);
      }
    },

    openPanel: (): void => set({ isPanelOpen: true, isPanelMinimized: false }),
    closePanel: (): void => set({ isPanelOpen: false, isPanelMinimized: false }),
    minimizePanel: (): void => set({ isPanelMinimized: true }),
    expandPanel: (): void => set({ isPanelMinimized: false }),

    startNewConversation: (): void => {
      const state = get();
      if (state.activeConversation()) {
        return;
      }
      // Local-only: nothing is written to the database until the user actually
      // sends a message (see `sendMessage`), so opening an empty chat and
      // walking away never creates a row for it.
      const localId = `${LOCAL_CONVERSATION_PREFIX}${Date.now()}`;
      const conversation: Conversation = {
        id: localId,
        topic: NEW_CONVERSATION_TOPIC,
        topicCategory: 'General',
        petName: null,
        status: 'Active',
        supportStatus: 'AI Handling',
        startedAt: new Date().toISOString(),
        messages: [],
      };
      unpersistedConversationIds.add(localId);
      set((current) => ({
        conversationsById: { ...current.conversationsById, [localId]: conversation },
        conversationIds: [localId, ...current.conversationIds],
        inactivityPromptVisible: false,
        lastActivityAt: Date.now(),
      }));
    },

    sendMessage: (conversationId, body): void => {
      const trimmed = body.trim();
      if (!trimmed) {
        return;
      }

      let expectsAiReply = false;
      set((state) => {
        const conversation = state.conversationsById[conversationId];
        if (!conversation) {
          return state;
        }
        expectsAiReply =
          conversation.status === 'Active' && conversation.supportStatus === 'AI Handling';
        const updated = appendMessage(conversation, 'pet_owner', trimmed);
        return {
          conversationsById: { ...state.conversationsById, [conversationId]: updated },
          inactivityPromptVisible: false,
          lastActivityAt: Date.now(),
          awaitingAiReply: expectsAiReply
            ? { ...state.awaitingAiReply, [conversationId]: true }
            : state.awaitingAiReply,
        };
      });

      if (expectsAiReply) {
        setTimeout(() => {
          set((state) => {
            if (!state.awaitingAiReply[conversationId]) {
              return state;
            }
            const awaitingAiReply = { ...state.awaitingAiReply };
            delete awaitingAiReply[conversationId];
            return { awaitingAiReply };
          });
        }, AWAITING_AI_REPLY_TIMEOUT_MS);
      }

      if (isPersistedConversationId(conversationId)) {
        postMessageOnServer(conversationId, trimmed).catch((error: unknown) =>
          console.error('Failed to persist message', error),
        );
      } else if (
        unpersistedConversationIds.has(conversationId) ||
        pendingConversationPersistence.has(conversationId)
      ) {
        // Either this is the first message (create the conversation now, on
        // send, and post the message once it exists) or an earlier message
        // already kicked that off and this one queues behind it.
        unpersistedConversationIds.delete(conversationId);
        ensureConversationPersisted(conversationId)
          .then((realId) => postMessageOnServer(realId, trimmed))
          .catch((error: unknown) => console.error('Failed to persist message', error));
      }

      // The AI's reply is generated and persisted server-side (see
      // Backend/src/services/conversation.ai.service.ts) and arrives through
      // the SSE-driven refreshConversation() in useAiChatLiveUpdates.ts, not
      // synthesized here.
    },

    requestSupport: (conversationId): void => {
      set((state) => {
        const conversation = state.conversationsById[conversationId];
        if (!conversation) {
          return state;
        }
        const withStatus: Conversation = {
          ...conversation,
          supportStatus: 'Support Requested',
          supportRequestedAt: new Date().toISOString(),
        };
        const withMessage = appendMessage(withStatus, 'system', SUPPORT_REQUESTED_NOTICE);
        const awaitingAiReply = { ...state.awaitingAiReply };
        delete awaitingAiReply[conversationId];
        return {
          conversationsById: { ...state.conversationsById, [conversationId]: withMessage },
          lastActivityAt: Date.now(),
          // A human is taking over, so the AI backend won't reply either.
          // There is no point still showing "AI is thinking".
          awaitingAiReply,
        };
      });

      if (isPersistedConversationId(conversationId)) {
        requestSupportOnServer(conversationId, get().petNamesByUuid).catch((error: unknown) =>
          console.error('Failed to persist the support request', error),
        );
      } else if (
        unpersistedConversationIds.has(conversationId) ||
        pendingConversationPersistence.has(conversationId)
      ) {
        // Asking for support is itself worth a database row, even if no
        // message has been sent yet.
        unpersistedConversationIds.delete(conversationId);
        ensureConversationPersisted(conversationId)
          .then((realId) => requestSupportOnServer(realId, get().petNamesByUuid))
          .catch((error: unknown) => console.error('Failed to persist the support request', error));
      }

      // Assignment ('Support Assigned') and a staff member's first reply
      // (auto-transitioning to 'Support Handling') happen for real on the
      // admin side (see admin.inquiry.service.ts) and arrive here through
      // the same SSE-driven refreshConversation() as an AI reply, not
      // synthesized here.
    },

    closeConversation: (conversationId): void => {
      set((state) => {
        const conversation = state.conversationsById[conversationId];
        if (!conversation) {
          return state;
        }
        const awaitingAiReply = { ...state.awaitingAiReply };
        delete awaitingAiReply[conversationId];
        return {
          conversationsById: {
            ...state.conversationsById,
            [conversationId]: { ...conversation, status: 'Closed' },
          },
          inactivityPromptVisible: false,
          awaitingAiReply,
        };
      });

      if (isPersistedConversationId(conversationId)) {
        closeConversationOnServer(conversationId, get().petNamesByUuid).catch((error: unknown) =>
          console.error('Failed to persist conversation closure', error),
        );
      } else {
        const pending = pendingConversationPersistence.get(conversationId);
        if (pending) {
          // A message was already sent and the create request is still
          // in-flight. Close it on the backend once it exists.
          pending
            .then((realId) => closeConversationOnServer(realId, get().petNamesByUuid))
            .catch((error: unknown) =>
              console.error('Failed to persist conversation closure', error),
            );
        } else {
          // No message was ever sent, so nothing was ever created in the
          // database for this conversation, so there is nothing to close there.
          unpersistedConversationIds.delete(conversationId);
        }
      }
    },

    continueWithAi: (): void => {
      set({ inactivityPromptVisible: false, lastActivityAt: Date.now() });
    },

    dismissInactivityPrompt: (): void => {
      set({ inactivityPromptVisible: false });
    },

    checkInactivity: (): void => {
      const state = get();
      const active = state.activeConversation();
      if (!active || active.supportStatus !== 'AI Handling') {
        return;
      }
      if (Date.now() - state.lastActivityAt >= INACTIVITY_TIMEOUT_MS) {
        set({ inactivityPromptVisible: true });
      }
    },
  };
});
