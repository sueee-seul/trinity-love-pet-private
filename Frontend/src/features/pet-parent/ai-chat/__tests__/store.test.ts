import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockConversations } from './testFixtures';
import * as conversationApi from '../conversationApi';
import { AWAITING_AI_REPLY_TIMEOUT_MS, INACTIVITY_TIMEOUT_MS, useAiChatStore } from '../store';
import type { Conversation } from '../types';

vi.mock('../conversationApi', () => ({
  fetchConversations: vi.fn(),
  fetchConversation: vi.fn(),
  createConversationOnServer: vi.fn(),
  postMessageOnServer: vi.fn(),
  closeConversationOnServer: vi.fn(),
  requestSupportOnServer: vi.fn(),
}));

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
    awaitingAiReply: {},
  });
}

const ACTIVE_ID = 'conv-bella-care';

/** Waits for as many microtask ticks as a `.then().catch().finally()` chain can need. */
const flushAsync = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  vi.mocked(conversationApi.createConversationOnServer).mockReset().mockResolvedValue({
    id: 'mock-persisted-id',
    topic: 'New conversation',
    topicCategory: 'General',
    petName: null,
    status: 'Active',
    supportStatus: 'AI Handling',
    startedAt: new Date().toISOString(),
    messages: [],
  });
  vi.mocked(conversationApi.postMessageOnServer).mockReset().mockResolvedValue({
    id: 'mock-message-id',
    senderRole: 'pet_owner',
    body: '',
    timestamp: new Date().toISOString(),
  });
  vi.mocked(conversationApi.fetchConversations).mockReset().mockResolvedValue([]);
  vi.mocked(conversationApi.closeConversationOnServer).mockReset().mockResolvedValue({
    id: 'mock-persisted-id',
    topic: 'New conversation',
    topicCategory: 'General',
    petName: null,
    status: 'Closed',
    supportStatus: 'Resolved',
    startedAt: new Date().toISOString(),
    messages: [],
  });
  vi.mocked(conversationApi.requestSupportOnServer).mockReset().mockResolvedValue({
    id: 'mock-persisted-id',
    topic: 'New conversation',
    topicCategory: 'General',
    petName: null,
    status: 'Active',
    supportStatus: 'Support Requested',
    startedAt: new Date().toISOString(),
    messages: [],
  });
  resetStore();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('activeConversation / pastConversations', () => {
  it('returns the single Active conversation', () => {
    const active = useAiChatStore.getState().activeConversation();
    expect(active?.id).toBe(ACTIVE_ID);
    expect(active?.status).toBe('Active');
  });

  it('returns null once no conversation is active', () => {
    useAiChatStore.getState().closeConversation(ACTIVE_ID);
    expect(useAiChatStore.getState().activeConversation()).toBeNull();
  });

  it('returns only Closed conversations from pastConversations', () => {
    const past = useAiChatStore.getState().pastConversations();
    expect(past.length).toBeGreaterThan(0);
    for (const conversation of past) {
      expect(conversation.status).toBe('Closed');
    }
  });
});

describe('openPanel / closePanel / minimizePanel / expandPanel', () => {
  it('opens the panel expanded', () => {
    useAiChatStore.getState().openPanel();
    expect(useAiChatStore.getState().isPanelOpen).toBe(true);
    expect(useAiChatStore.getState().isPanelMinimized).toBe(false);
  });

  it('closePanel resets isPanelMinimized even if it was minimized', () => {
    useAiChatStore.getState().openPanel();
    useAiChatStore.getState().minimizePanel();
    expect(useAiChatStore.getState().isPanelMinimized).toBe(true);

    useAiChatStore.getState().closePanel();

    expect(useAiChatStore.getState().isPanelOpen).toBe(false);
    expect(useAiChatStore.getState().isPanelMinimized).toBe(false);
  });

  it('minimizePanel and expandPanel toggle independently of isPanelOpen', () => {
    useAiChatStore.getState().openPanel();
    useAiChatStore.getState().minimizePanel();
    expect(useAiChatStore.getState().isPanelOpen).toBe(true);
    expect(useAiChatStore.getState().isPanelMinimized).toBe(true);

    useAiChatStore.getState().expandPanel();
    expect(useAiChatStore.getState().isPanelOpen).toBe(true);
    expect(useAiChatStore.getState().isPanelMinimized).toBe(false);
  });
});

describe('startNewConversation', () => {
  it('is a no-op while a conversation is already Active', () => {
    const idsBefore = useAiChatStore.getState().conversationIds;
    useAiChatStore.getState().startNewConversation();
    expect(useAiChatStore.getState().conversationIds).toEqual(idsBefore);
  });

  it('creates a new Active AI-Handling conversation once none is active', () => {
    useAiChatStore.getState().closeConversation(ACTIVE_ID);

    useAiChatStore.getState().startNewConversation();

    const created = useAiChatStore.getState().activeConversation();
    expect(created).not.toBeNull();
    expect(created?.supportStatus).toBe('AI Handling');
    expect(created?.messages).toEqual([]);
  });

  it('resets inactivityPromptVisible and bumps lastActivityAt', () => {
    useAiChatStore.getState().closeConversation(ACTIVE_ID);
    useAiChatStore.setState({ inactivityPromptVisible: true, lastActivityAt: 0 });

    useAiChatStore.getState().startNewConversation();

    expect(useAiChatStore.getState().inactivityPromptVisible).toBe(false);
    expect(useAiChatStore.getState().lastActivityAt).toBeGreaterThan(0);
  });

  it('queues a message sent before the backend confirms the new conversation, and delivers it once persisted', async () => {
    useAiChatStore.getState().closeConversation(ACTIVE_ID);

    let resolveCreate!: (conversation: Conversation) => void;
    vi.mocked(conversationApi.createConversationOnServer).mockReturnValueOnce(
      new Promise<Conversation>((resolve) => {
        resolveCreate = resolve;
      }),
    );

    useAiChatStore.getState().startNewConversation();
    const localId = useAiChatStore.getState().activeConversation()?.id;
    expect(localId).toBeDefined();
    if (!localId) throw new Error('expected a local conversation id');

    // Sent while the conversation is still only local. It must not be dropped.
    useAiChatStore.getState().sendMessage(localId, 'Hi');
    await flushAsync();
    expect(conversationApi.postMessageOnServer).not.toHaveBeenCalled();

    resolveCreate({
      id: 'real-mongo-id',
      topic: 'New conversation',
      topicCategory: 'General',
      petName: null,
      status: 'Active',
      supportStatus: 'AI Handling',
      startedAt: new Date().toISOString(),
      messages: [],
    });
    await flushAsync();

    expect(conversationApi.postMessageOnServer).toHaveBeenCalledWith('real-mongo-id', 'Hi');
    expect(useAiChatStore.getState().conversationsById['real-mongo-id']).toBeDefined();
    expect(useAiChatStore.getState().conversationsById[localId]).toBeUndefined();
  });

  it('does not create a conversation in the database until a message is sent', async () => {
    useAiChatStore.getState().closeConversation(ACTIVE_ID);

    useAiChatStore.getState().startNewConversation();
    await flushAsync();

    expect(conversationApi.createConversationOnServer).not.toHaveBeenCalled();
  });

  it('creates the conversation exactly once even if the first message is sent twice in a row', async () => {
    useAiChatStore.getState().closeConversation(ACTIVE_ID);
    useAiChatStore.getState().startNewConversation();
    const active = useAiChatStore.getState().activeConversation();
    if (!active) throw new Error('expected an active conversation');
    const localId = active.id;

    useAiChatStore.getState().sendMessage(localId, 'Hi');
    useAiChatStore.getState().sendMessage(localId, 'Anyone there?');
    await flushAsync();

    expect(conversationApi.createConversationOnServer).toHaveBeenCalledTimes(1);
    expect(conversationApi.postMessageOnServer).toHaveBeenCalledWith('mock-persisted-id', 'Hi');
    expect(conversationApi.postMessageOnServer).toHaveBeenCalledWith(
      'mock-persisted-id',
      'Anyone there?',
    );
  });

  it('never creates a conversation in the database if it is closed without any message being sent', async () => {
    useAiChatStore.getState().closeConversation(ACTIVE_ID);
    useAiChatStore.getState().startNewConversation();
    const active = useAiChatStore.getState().activeConversation();
    if (!active) throw new Error('expected an active conversation');
    const localId = active.id;

    useAiChatStore.getState().closeConversation(localId);
    await flushAsync();

    expect(conversationApi.createConversationOnServer).not.toHaveBeenCalled();
    expect(conversationApi.closeConversationOnServer).not.toHaveBeenCalled();
  });
});

describe('sendMessage', () => {
  it('ignores whitespace-only input', () => {
    const before = useAiChatStore.getState().conversationsById[ACTIVE_ID].messages.length;
    useAiChatStore.getState().sendMessage(ACTIVE_ID, '   ');
    expect(useAiChatStore.getState().conversationsById[ACTIVE_ID].messages.length).toBe(before);
  });

  it('appends a pet_owner message and bumps lastActivityAt', () => {
    useAiChatStore.setState({ lastActivityAt: 0 });
    useAiChatStore.getState().sendMessage(ACTIVE_ID, 'Hello there');

    const messages = useAiChatStore.getState().conversationsById[ACTIVE_ID].messages;
    const last = messages[messages.length - 1];
    expect(last.senderRole).toBe('pet_owner');
    expect(last.body).toBe('Hello there');
    expect(useAiChatStore.getState().lastActivityAt).toBeGreaterThan(0);
  });

  it('does not synthesize a local AI reply, because the real reply comes from the backend via refreshConversation', () => {
    vi.useFakeTimers();
    useAiChatStore.getState().sendMessage(ACTIVE_ID, 'Has Bella eaten?');

    // Regression guard: sendMessage must never schedule its own reply, no
    // matter how long we wait. See conversation.ai.service.ts server-side.
    vi.advanceTimersByTime(60_000);

    const messages = useAiChatStore.getState().conversationsById[ACTIVE_ID].messages;
    expect(messages[messages.length - 1].senderRole).toBe('pet_owner');
  });

  it('marks the conversation as awaiting an AI reply while AI Handling', () => {
    useAiChatStore.getState().sendMessage(ACTIVE_ID, 'Has Bella eaten?');
    expect(useAiChatStore.getState().awaitingAiReply[ACTIVE_ID]).toBe(true);
  });

  it('does not mark the conversation as awaiting an AI reply once support is handling it', () => {
    useAiChatStore.setState((state) => ({
      conversationsById: {
        ...state.conversationsById,
        [ACTIVE_ID]: { ...state.conversationsById[ACTIVE_ID], supportStatus: 'Support Handling' },
      },
    }));

    useAiChatStore.getState().sendMessage(ACTIVE_ID, 'Still there?');
    expect(useAiChatStore.getState().awaitingAiReply[ACTIVE_ID]).toBeUndefined();
  });

  it('clears the "awaiting AI reply" flag on its own after the safety timeout', () => {
    vi.useFakeTimers();
    useAiChatStore.getState().sendMessage(ACTIVE_ID, 'Has Bella eaten?');
    expect(useAiChatStore.getState().awaitingAiReply[ACTIVE_ID]).toBe(true);

    vi.advanceTimersByTime(AWAITING_AI_REPLY_TIMEOUT_MS);

    expect(useAiChatStore.getState().awaitingAiReply[ACTIVE_ID]).toBeUndefined();
  });
});

describe('requestSupport', () => {
  it('immediately marks Support Requested and appends a system message', () => {
    useAiChatStore.getState().requestSupport(ACTIVE_ID);

    const conversation = useAiChatStore.getState().conversationsById[ACTIVE_ID];
    expect(conversation.supportStatus).toBe('Support Requested');
    expect(conversation.supportRequestedAt).toBeDefined();
    expect(conversation.messages[conversation.messages.length - 1]).toMatchObject({
      senderRole: 'system',
      body: 'Customer Support requested',
    });
  });

  it('clears a pending "awaiting AI reply" flag when a human takes over, since the AI will not reply', () => {
    useAiChatStore.setState({ awaitingAiReply: { [ACTIVE_ID]: true } });
    useAiChatStore.getState().requestSupport(ACTIVE_ID);
    expect(useAiChatStore.getState().awaitingAiReply[ACTIVE_ID]).toBeUndefined();
  });

  it('does not synthesize Support Assigned/Support Handling locally, because those come from real staff action on the admin side', () => {
    vi.useFakeTimers();
    useAiChatStore.getState().requestSupport(ACTIVE_ID);

    // Regression guard: no matter how long we wait, requestSupport must never
    // simulate a staff member picking this up or replying. See
    // admin.inquiry.service.ts server-side (assignStaff / hasEmployeeMessage).
    vi.advanceTimersByTime(10 * 60 * 1000);

    const conversation = useAiChatStore.getState().conversationsById[ACTIVE_ID];
    expect(conversation.supportStatus).toBe('Support Requested');
    expect(conversation.supportAgentName).toBeUndefined();
    expect(conversation.messages[conversation.messages.length - 1]).toMatchObject({
      senderRole: 'system',
      body: 'Customer Support requested',
    });
  });
});

describe('closeConversation', () => {
  it('sets status to Closed without touching supportStatus', () => {
    useAiChatStore.getState().closeConversation(ACTIVE_ID);

    const conversation = useAiChatStore.getState().conversationsById[ACTIVE_ID];
    expect(conversation.status).toBe('Closed');
    expect(conversation.supportStatus).toBe('AI Handling');
  });

  it('clears inactivityPromptVisible', () => {
    useAiChatStore.setState({ inactivityPromptVisible: true });
    useAiChatStore.getState().closeConversation(ACTIVE_ID);
    expect(useAiChatStore.getState().inactivityPromptVisible).toBe(false);
  });

  it('clears a pending "awaiting AI reply" flag for the closed conversation', () => {
    useAiChatStore.setState({ awaitingAiReply: { [ACTIVE_ID]: true } });
    useAiChatStore.getState().closeConversation(ACTIVE_ID);
    expect(useAiChatStore.getState().awaitingAiReply[ACTIVE_ID]).toBeUndefined();
  });
});

describe('continueWithAi', () => {
  it('clears the inactivity prompt and refreshes lastActivityAt', () => {
    useAiChatStore.setState({ inactivityPromptVisible: true, lastActivityAt: 0 });
    useAiChatStore.getState().continueWithAi();
    expect(useAiChatStore.getState().inactivityPromptVisible).toBe(false);
    expect(useAiChatStore.getState().lastActivityAt).toBeGreaterThan(0);
  });
});

describe('checkInactivity', () => {
  it('shows the inactivity prompt once the timeout has elapsed for an AI-Handling conversation', () => {
    vi.useFakeTimers();
    useAiChatStore.setState({ lastActivityAt: Date.now() });

    vi.advanceTimersByTime(INACTIVITY_TIMEOUT_MS);
    useAiChatStore.getState().checkInactivity();

    expect(useAiChatStore.getState().inactivityPromptVisible).toBe(true);
  });

  it('does nothing before the timeout has elapsed', () => {
    vi.useFakeTimers();
    useAiChatStore.setState({ lastActivityAt: Date.now() });

    vi.advanceTimersByTime(INACTIVITY_TIMEOUT_MS - 1000);
    useAiChatStore.getState().checkInactivity();

    expect(useAiChatStore.getState().inactivityPromptVisible).toBe(false);
  });

  it('does nothing when there is no active conversation', () => {
    vi.useFakeTimers();
    useAiChatStore.getState().closeConversation(ACTIVE_ID);
    useAiChatStore.setState({ lastActivityAt: Date.now() });

    vi.advanceTimersByTime(INACTIVITY_TIMEOUT_MS);
    useAiChatStore.getState().checkInactivity();

    expect(useAiChatStore.getState().inactivityPromptVisible).toBe(false);
  });

  it('does nothing once the conversation has moved past AI Handling', () => {
    vi.useFakeTimers();
    useAiChatStore.setState((state) => ({
      conversationsById: {
        ...state.conversationsById,
        [ACTIVE_ID]: { ...state.conversationsById[ACTIVE_ID], supportStatus: 'Support Requested' },
      },
      lastActivityAt: Date.now(),
    }));

    vi.advanceTimersByTime(INACTIVITY_TIMEOUT_MS);
    useAiChatStore.getState().checkInactivity();

    expect(useAiChatStore.getState().inactivityPromptVisible).toBe(false);
  });
});

describe('refreshConversation', () => {
  const PERSISTED_ID = '507f1f77bcf86cd799439011';

  it('does nothing for a conversation that has not been persisted yet', async () => {
    await useAiChatStore.getState().refreshConversation(ACTIVE_ID);
    expect(conversationApi.fetchConversation).not.toHaveBeenCalled();
  });

  it('does not clear "awaiting AI reply" on the echo refresh of the pet owner\'s own message', async () => {
    const ownMessage = {
      id: '507f1f77bcf86cd799439020',
      senderRole: 'pet_owner' as const,
      body: 'Hi there',
      timestamp: new Date().toISOString(),
    };
    useAiChatStore.setState((state) => ({
      conversationsById: {
        ...state.conversationsById,
        [PERSISTED_ID]: {
          id: PERSISTED_ID,
          topic: 'Test',
          topicCategory: 'General',
          petName: null,
          status: 'Active',
          supportStatus: 'AI Handling',
          startedAt: new Date().toISOString(),
          messages: [],
        },
      },
      conversationIds: [...state.conversationIds, PERSISTED_ID],
      awaitingAiReply: { [PERSISTED_ID]: true },
    }));
    vi.mocked(conversationApi.fetchConversation).mockResolvedValueOnce({
      id: PERSISTED_ID,
      topic: 'Test',
      topicCategory: 'General',
      petName: null,
      status: 'Active',
      supportStatus: 'AI Handling',
      startedAt: new Date().toISOString(),
      messages: [ownMessage],
    });

    await useAiChatStore.getState().refreshConversation(PERSISTED_ID);

    expect(useAiChatStore.getState().awaitingAiReply[PERSISTED_ID]).toBe(true);
  });

  it('clears "awaiting AI reply" once a genuinely new `ai` message arrives from the server', async () => {
    const newAiReply = {
      id: '507f1f77bcf86cd799439021',
      senderRole: 'ai' as const,
      body: 'Here is the answer.',
      timestamp: new Date().toISOString(),
    };
    useAiChatStore.setState((state) => ({
      conversationsById: {
        ...state.conversationsById,
        [PERSISTED_ID]: {
          id: PERSISTED_ID,
          topic: 'Test',
          topicCategory: 'General',
          petName: null,
          status: 'Active',
          supportStatus: 'AI Handling',
          startedAt: new Date().toISOString(),
          messages: [],
        },
      },
      conversationIds: [...state.conversationIds, PERSISTED_ID],
      awaitingAiReply: { [PERSISTED_ID]: true },
    }));
    vi.mocked(conversationApi.fetchConversation).mockResolvedValueOnce({
      id: PERSISTED_ID,
      topic: 'Test',
      topicCategory: 'General',
      petName: null,
      status: 'Active',
      supportStatus: 'AI Handling',
      startedAt: new Date().toISOString(),
      messages: [newAiReply],
    });

    await useAiChatStore.getState().refreshConversation(PERSISTED_ID);

    expect(useAiChatStore.getState().awaitingAiReply[PERSISTED_ID]).toBeUndefined();
  });

  it("merges fresh server messages with local-only simulated ones, dropping the pet owner's own optimistic echo now that the real copy exists", async () => {
    const localOnlyAiReply = {
      id: 'msg-local-ai',
      senderRole: 'ai' as const,
      body: 'Simulated AI reply',
      timestamp: new Date(Date.now() - 1000).toISOString(),
    };
    const ownOptimisticEcho = {
      id: 'msg-local-echo',
      senderRole: 'pet_owner' as const,
      body: 'Hi there',
      timestamp: new Date(Date.now() - 2000).toISOString(),
    };
    const serverEchoOfSameMessage = {
      id: '507f1f77bcf86cd799439012',
      senderRole: 'pet_owner' as const,
      body: 'Hi there',
      timestamp: new Date(Date.now() - 2000).toISOString(),
    };
    const newStaffMessage = {
      id: '507f1f77bcf86cd799439013',
      senderRole: 'support' as const,
      body: 'Hi, how can I help?',
      timestamp: new Date().toISOString(),
    };

    useAiChatStore.setState((state) => ({
      conversationsById: {
        ...state.conversationsById,
        [PERSISTED_ID]: {
          id: PERSISTED_ID,
          topic: 'Test',
          topicCategory: 'General',
          petName: null,
          status: 'Active',
          supportStatus: 'AI Handling',
          startedAt: new Date().toISOString(),
          messages: [ownOptimisticEcho, localOnlyAiReply],
        },
      },
      conversationIds: [...state.conversationIds, PERSISTED_ID],
    }));

    vi.mocked(conversationApi.fetchConversation).mockResolvedValueOnce({
      id: PERSISTED_ID,
      topic: 'Test',
      topicCategory: 'General',
      petName: null,
      status: 'Active',
      supportStatus: 'Support Handling',
      startedAt: new Date().toISOString(),
      messages: [serverEchoOfSameMessage, newStaffMessage],
    });

    await useAiChatStore.getState().refreshConversation(PERSISTED_ID);

    const result = useAiChatStore.getState().conversationsById[PERSISTED_ID];
    expect(result.supportStatus).toBe('Support Handling');
    const ids = result.messages.map((message) => message.id);
    expect(ids).toContain(serverEchoOfSameMessage.id);
    expect(ids).toContain(newStaffMessage.id);
    expect(ids).toContain(localOnlyAiReply.id);
    expect(ids).not.toContain(ownOptimisticEcho.id);
  });
});
