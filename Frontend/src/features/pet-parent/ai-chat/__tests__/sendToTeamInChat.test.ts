import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as conversationApi from '../conversationApi';
import { sendToTeamInChat } from '../sendToTeamInChat';
import { useAiChatStore } from '../store';

vi.mock('../conversationApi', () => ({
  fetchConversations: vi.fn(),
  fetchConversation: vi.fn(),
  createConversationOnServer: vi.fn(),
  postMessageOnServer: vi.fn(),
  closeConversationOnServer: vi.fn(),
  requestSupportOnServer: vi.fn(),
}));

const flushAsync = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('sendToTeamInChat', () => {
  beforeEach(() => {
    vi.mocked(conversationApi.createConversationOnServer).mockReset().mockResolvedValue({
      id: '0123456789abcdef01234567',
      topic: 'New conversation',
      topicCategory: 'General',
      petName: null,
      status: 'Active',
      supportStatus: 'AI Handling',
      startedAt: new Date().toISOString(),
      messages: [],
    });
    vi.mocked(conversationApi.requestSupportOnServer)
      .mockReset()
      .mockResolvedValue(undefined as never);
    vi.mocked(conversationApi.postMessageOnServer).mockReset().mockResolvedValue({
      id: 'message-1',
      senderRole: 'pet_owner',
      body: '',
      timestamp: new Date().toISOString(),
    });
    // The list has loaded and holds no open conversation.
    useAiChatStore.setState({
      conversationsById: {},
      conversationIds: [],
      hasLoadedConversations: true,
      awaitingAiReply: {},
    });
  });

  // The plan is meant for a person, so the assistant must not answer it first.
  it('asks for our team, then posts the plan, in a new conversation', async () => {
    await sendToTeamInChat('My plan\nDates: 12 to 15 Oct');
    await flushAsync();

    const conversation = useAiChatStore.getState().activeConversation();
    expect(conversation?.supportStatus).toBe('Support Requested');
    expect(conversation?.messages.map((message) => message.body)).toContain(
      'My plan\nDates: 12 to 15 Oct',
    );
    expect(conversationApi.requestSupportOnServer).toHaveBeenCalledTimes(1);
    expect(conversationApi.postMessageOnServer).toHaveBeenCalledWith(
      '0123456789abcdef01234567',
      'My plan\nDates: 12 to 15 Oct',
    );
    const requested = vi.mocked(conversationApi.requestSupportOnServer).mock.invocationCallOrder[0];
    const posted = vi.mocked(conversationApi.postMessageOnServer).mock.invocationCallOrder[0];
    expect(requested).toBeLessThan(posted ?? 0);
    expect(useAiChatStore.getState().awaitingAiReply).toEqual({});
  });
});
