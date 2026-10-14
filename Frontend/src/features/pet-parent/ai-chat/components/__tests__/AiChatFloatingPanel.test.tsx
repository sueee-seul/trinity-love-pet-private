import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useConciergeStore } from '../../../../concierge/store/conciergeStore';
import { createMockConversations } from '../../__tests__/testFixtures';
import { useAiChatStore } from '../../store';
import { AiChatFloatingPanel } from '../AiChatFloatingPanel';

function resetStore(): void {
  const conversations = createMockConversations();
  useAiChatStore.setState({
    conversationsById: Object.fromEntries(
      conversations.map((conversation) => [conversation.id, conversation]),
    ),
    conversationIds: conversations.map((conversation) => conversation.id),
    isPanelOpen: true,
    isPanelMinimized: false,
  });
}

const renderPanel = (initialPath = '/parent'): ReturnType<typeof render> =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="*" element={<AiChatFloatingPanel />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  resetStore();
});

describe('AiChatFloatingPanel', () => {
  it('renders nothing when the panel is closed', () => {
    useAiChatStore.setState({ isPanelOpen: false });
    const { container } = renderPanel();
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing on the expanded /parent/ai-chat route', () => {
    const { container } = renderPanel('/parent/ai-chat');
    expect(container).toBeEmptyDOMElement();
  });

  // The trailing slash is the same page to the router, so it must hide the panel too.
  it.each(['/parent/booking', '/parent/booking/'])(
    'stays hidden on %s, which has its own booking assistant, without closing',
    (path) => {
      const { container } = renderPanel(path);
      expect(container).toBeEmptyDOMElement();
      expect(useAiChatStore.getState().isPanelOpen).toBe(true);
    },
  );

  it('still shows on a page whose path only starts with the same letters', () => {
    renderPanel('/parent/bookings-history');
    expect(screen.getByRole('region', { name: 'AI chat' })).toBeInTheDocument();
  });

  it('renders the MinimizedBar instead of the full panel when minimized', () => {
    useAiChatStore.setState({ isPanelMinimized: true });
    renderPanel();

    expect(screen.getByRole('button', { name: 'Expand AI Chat' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Minimise' })).not.toBeInTheDocument();
  });

  it('shows the empty state and starts a new conversation when none is active', () => {
    useAiChatStore.getState().closeConversation('conv-bella-care');
    renderPanel();

    expect(screen.getByText('Ask about your pets, bookings or care updates.')).toBeInTheDocument();
  });

  it('expanding to the full page navigates to /parent/ai-chat and closes the floating panel', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/parent']}>
        <Routes>
          <Route path="/parent" element={<AiChatFloatingPanel />} />
          <Route path="/parent/ai-chat" element={<h1>Expanded AI Chat</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Expand to full page' }));

    expect(screen.getByRole('heading', { name: 'Expanded AI Chat' })).toBeInTheDocument();
    expect(useAiChatStore.getState().isPanelOpen).toBe(false);
  });

  it('minimising sets isPanelMinimized without closing the panel', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: 'Minimise' }));

    expect(useAiChatStore.getState().isPanelOpen).toBe(true);
    expect(useAiChatStore.getState().isPanelMinimized).toBe(true);
  });

  it('closing the panel from the minimized bar clears both open and minimized state', async () => {
    useAiChatStore.setState({ isPanelMinimized: true });
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(useAiChatStore.getState().isPanelOpen).toBe(false);
    expect(useAiChatStore.getState().isPanelMinimized).toBe(false);
  });
});

describe('AiChatFloatingPanel in Chinese', () => {
  afterEach(() => {
    useConciergeStore.getState().setLocale('en');
  });

  it('labels the panel and its controls in Chinese, and switches back to English', () => {
    useConciergeStore.getState().setLocale('zh');
    renderPanel();

    expect(screen.getByRole('region', { name: 'AI 聊天' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '最小化' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '全屏打开' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('输入消息…')).toBeInTheDocument();

    act(() => useConciergeStore.getState().setLocale('en'));
    expect(screen.getByRole('region', { name: 'AI chat' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Minimise' })).toBeInTheDocument();
  });

  it('shows the minimised bar and the empty state in Chinese', () => {
    useConciergeStore.getState().setLocale('zh');
    useAiChatStore.setState({ isPanelMinimized: true });
    const { unmount } = renderPanel();

    expect(screen.getByRole('button', { name: '展开 AI 聊天' })).toBeInTheDocument();
    expect(screen.getByText('进行中 · Bella的照护')).toBeInTheDocument();
    unmount();

    useAiChatStore.setState({ isPanelMinimized: false });
    useAiChatStore.getState().closeConversation('conv-bella-care');
    renderPanel();
    expect(screen.getByText('可以问问宠物、预约或照护动态。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '开始对话' })).toBeInTheDocument();
  });
});
