import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useConciergeStore } from '../../../../concierge/store/conciergeStore';
import { createMockConversations } from '../../__tests__/testFixtures';
import * as conversationApi from '../../conversationApi';
import { useAiChatStore } from '../../store';
import { AiChatPage } from '../AiChatPage';
import { englishWordsIn } from '../../../../../shared/i18n/testing/englishWordsIn';

vi.mock('../../conversationApi', () => ({
  fetchConversations: vi.fn(),
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
    parentName: 'Taylor Parent',
    isPanelOpen: false,
    isPanelMinimized: false,
    inactivityPromptVisible: false,
    lastActivityAt: Date.now(),
  });
}

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

describe('AiChatPage', () => {
  it('defaults the selection to the active conversation', () => {
    render(<AiChatPage />);
    expect(screen.getByRole('heading', { name: "Bella's Care Updates" })).toBeInTheDocument();
  });

  it('falls back to the most recent past conversation once none is active', () => {
    useAiChatStore.getState().closeConversation('conv-bella-care');
    render(<AiChatPage />);

    const past = useAiChatStore.getState().pastConversations();
    expect(screen.getByRole('heading', { name: past[0].topic })).toBeInTheDocument();
  });

  it('updates the conversation shown when a sidebar row is clicked', async () => {
    const user = userEvent.setup();
    render(<AiChatPage />);

    await user.click(screen.getByText('Booking enquiry'));

    expect(screen.getByRole('heading', { name: 'Booking enquiry' })).toBeInTheDocument();
    expect(screen.getByText('This conversation is closed and read-only.')).toBeInTheDocument();
  });

  it('auto-selects a newly created conversation', async () => {
    useAiChatStore.getState().closeConversation('conv-bella-care');
    const user = userEvent.setup();
    render(<AiChatPage />);

    await user.click(screen.getByRole('button', { name: 'New conversation' }));

    expect(screen.getByRole('heading', { name: 'New conversation' })).toBeInTheDocument();
  });

  it('greets the parent and sends the suggested pet-status question when selected', async () => {
    useAiChatStore.getState().closeConversation('conv-bella-care');
    const user = userEvent.setup();
    render(<AiChatPage />);

    await user.click(screen.getByRole('button', { name: 'New conversation' }));

    expect(screen.getByText('Hi Taylor Parent, how can I help you today?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Check my pet status.' }));

    expect(screen.getByText('Check my pet status.')).toBeInTheDocument();
    await waitFor(() => {
      expect(conversationApi.postMessageOnServer).toHaveBeenCalledWith(
        'mock-persisted-id',
        'Check my pet status.',
      );
    });
  });

  it('clears the selection when the selected conversation is closed', async () => {
    const user = userEvent.setup();
    render(<AiChatPage />);

    await user.click(screen.getByRole('button', { name: 'Close conversation' }));

    // Falls back to the (now-closed) conversation, or another past one. Either way it must
    // no longer show the active conversation's live composer.
    expect(
      screen.queryByPlaceholderText('Ask about your pets, bookings or care updates…'),
    ).not.toBeInTheDocument();
    expect(useAiChatStore.getState().conversationsById['conv-bella-care'].status).toBe('Closed');
  });

  it('has one page title, the conversation list heading', () => {
    render(<AiChatPage />);
    const titles = screen.getAllByRole('heading', { level: 1 });
    expect(titles).toHaveLength(1);
    expect(titles[0]).toHaveTextContent('Conversations');
    expect(titles[0]).toHaveClass('type-card-title', 'font-normal');
  });

  it('on a phone shows the list first, then one conversation with a way back', async () => {
    const user = userEvent.setup();
    render(<AiChatPage />);
    const list = screen.getByRole('region', { name: 'Conversation list' });
    const conversation = screen.getByRole('region', { name: 'Open conversation' });

    // `hidden` applies below `md` only; from `md` both panes show side by side.
    expect(list).not.toHaveClass('hidden');
    expect(conversation).toHaveClass('hidden', 'md:flex');

    await user.click(screen.getByText('Booking enquiry'));

    expect(list).toHaveClass('hidden', 'md:flex');
    expect(conversation).not.toHaveClass('hidden');
    expect(screen.getByRole('heading', { name: 'Booking enquiry' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back to conversations' }));

    expect(list).not.toHaveClass('hidden');
    expect(conversation).toHaveClass('hidden');
  });

  it('opens a new conversation straight away on a phone', async () => {
    useAiChatStore.getState().closeConversation('conv-bella-care');
    const user = userEvent.setup();
    render(<AiChatPage />);

    await user.click(screen.getByRole('button', { name: 'New conversation' }));

    expect(screen.getByRole('region', { name: 'Open conversation' })).not.toHaveClass('hidden');
  });

  it('requesting support from the inactivity prompt both escalates and dismisses the prompt', async () => {
    useAiChatStore.setState({ inactivityPromptVisible: true });
    const user = userEvent.setup();
    render(<AiChatPage />);

    // Both the conversation header and the inactivity modal have a same-named button here.
    // The modal's is the one appended last in the tree.
    const contactButtons = screen.getAllByRole('button', { name: 'Contact Customer Support' });
    await user.click(contactButtons[contactButtons.length - 1]);

    expect(useAiChatStore.getState().conversationsById['conv-bella-care'].supportStatus).toBe(
      'Support Requested',
    );
    expect(useAiChatStore.getState().inactivityPromptVisible).toBe(false);
  });
});

describe('AiChatPage in Chinese', () => {
  afterEach(() => {
    useConciergeStore.getState().setLocale('en');
  });

  it('words the page chrome in Chinese, keeps what the parent wrote, and switches back', async () => {
    useConciergeStore.getState().setLocale('zh');
    const user = userEvent.setup();
    render(<AiChatPage />);

    expect(screen.getByRole('heading', { level: 1, name: '对话' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '对话列表' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '新对话' })).toBeDisabled();
    expect(screen.getByText('请先结束当前对话，再开始新的对话。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '联系客服' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('问问宠物、预约或照护动态…')).toBeInTheDocument();
    expect(screen.getByText('Has Bella been fed today?')).toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: '消息' }), '她今天吃饭了吗？');
    await user.click(screen.getByRole('button', { name: '发送消息' }));
    // What the parent typed is sent as typed; only the chrome around it changes language.
    const sent = useAiChatStore.getState().conversationsById['conv-bella-care'].messages;
    expect(sent[sent.length - 1]?.body).toBe('她今天吃饭了吗？');

    await user.click(screen.getByRole('button', { name: '结束对话' }));
    await user.click(screen.getByRole('button', { name: '新对话' }));
    expect(screen.getByRole('heading', { level: 2, name: '新对话' })).toBeInTheDocument();
    expect(useAiChatStore.getState().activeConversation()?.topic).toBe('New conversation');

    // Names, and the fixture's topics: the app builds every topic itself (topicFor), which these
    // fixtures skip, so they reach the page as written.
    expect(
      englishWordsIn(document.body, [
        'Bella',
        "Bella's",
        'Luna',
        'Taylor',
        'Parent',
        'Care',
        'Updates',
        'Booking',
        'enquiry',
        'Medication',
        'question',
      ]),
    ).toEqual([]);
    act(() => useConciergeStore.getState().setLocale('en'));
    expect(screen.getByRole('heading', { level: 1, name: 'Conversations' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'New conversation' })).toBeInTheDocument();
  });

  it('asks about inactivity in Chinese', () => {
    useConciergeStore.getState().setLocale('zh');
    useAiChatStore.setState({ inactivityPromptVisible: true });
    render(<AiChatPage />);

    expect(screen.getByRole('dialog', { name: '还需要帮助吗？' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '继续和 AI 聊' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '结束对话：我不再需要帮助' })).toBeInTheDocument();
  });

  it('shows the support request line in Chinese while the state keeps it in English', async () => {
    useConciergeStore.getState().setLocale('zh');
    const user = userEvent.setup();
    render(<AiChatPage />);

    await user.click(screen.getByRole('button', { name: '联系客服' }));

    expect(screen.getByText(/已请求客服 ·/)).toBeInTheDocument();
    const messages = useAiChatStore.getState().conversationsById['conv-bella-care'].messages;
    expect(messages[messages.length - 1]?.body).toBe('Customer Support requested');
  });
});
