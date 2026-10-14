import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockConversations } from './testFixtures';
import * as conversationApi from '../conversationApi';
import { AiChatFloatingPanel } from '../components/AiChatFloatingPanel';
import { AiChatIconButton } from '../components/AiChatIconButton';
import { useAiChatStore } from '../store';

vi.mock('../conversationApi', () => ({
  fetchConversations: vi.fn(),
  createConversationOnServer: vi.fn(),
  postMessageOnServer: vi.fn(),
  closeConversationOnServer: vi.fn(),
  requestSupportOnServer: vi.fn(),
}));

vi.mock('../../profile/parentProfileApi', () => ({
  fetchParentProfile: vi.fn().mockResolvedValue({
    owner: {
      id: 'owner-1',
      fullName: 'Test Owner',
      email: 't@example.test',
      phone: '',
      address: '',
      emergencyContactNumber: '',
    },
    pets: [],
  }),
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
  });
}

/** Mirrors PetParentNavbar + PetParentPortal: the icon button and the floating panel it drives. */
function Harness(): ReactElement {
  return (
    <MemoryRouter initialEntries={['/parent']}>
      <Routes>
        <Route
          path="/parent"
          element={
            <div>
              <AiChatIconButton />
              <AiChatFloatingPanel />
            </div>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  resetStore();
});

describe('re-entering the AI Chat via the icon button', () => {
  it('shows the existing active conversation automatically after exiting and reopening', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Open AI Chat' }));
    expect(screen.getByRole('heading', { name: "Bella's Care Updates" })).toBeInTheDocument();

    // Exit: close the panel without closing the conversation itself.
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(useAiChatStore.getState().isPanelOpen).toBe(false);
    expect(useAiChatStore.getState().activeConversation()?.status).toBe('Active');

    // Re-enter through the same icon button.
    await user.click(screen.getByRole('button', { name: 'Open AI Chat' }));

    expect(screen.getByRole('heading', { name: "Bella's Care Updates" })).toBeInTheDocument();
    expect(
      screen.queryByText('Ask about your pets, bookings or care updates.'),
    ).not.toBeInTheDocument();
  });

  it('shows "Start a conversation" after exiting a conversation that was closed, not just the panel', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Open AI Chat' }));
    expect(screen.getByRole('heading', { name: "Bella's Care Updates" })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close conversation' }));
    expect(useAiChatStore.getState().activeConversation()).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: 'Open AI Chat' }));

    expect(screen.getByText('Ask about your pets, bookings or care updates.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start a conversation' })).toBeInTheDocument();
  });

  it('shows "Start a conversation" on first entry when no conversation is active at all', async () => {
    useAiChatStore.getState().closeConversation('conv-bella-care');
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Open AI Chat' }));

    expect(screen.getByText('Ask about your pets, bookings or care updates.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start a conversation' })).toBeInTheDocument();
  });

  it('shows an active conversation fetched fresh from the backend, not just one already in memory', async () => {
    // Simulates a real reload: the store starts empty, and the only source of
    // the active conversation is the backend fetch that `loadConversations`
    // triggers, not a conversation already sitting in local state.
    useAiChatStore.setState({
      conversationsById: {},
      conversationIds: [],
      hasLoadedConversations: false,
      isLoadingConversations: false,
      isPanelOpen: false,
    });
    vi.mocked(conversationApi.fetchConversations).mockResolvedValueOnce([
      {
        id: 'active-from-backend',
        topic: 'Feeding enquiry',
        topicCategory: 'Feeding',
        petName: 'Biscuit',
        status: 'Active',
        supportStatus: 'AI Handling',
        startedAt: new Date().toISOString(),
        messages: [],
      },
    ]);

    const user = userEvent.setup();
    render(<Harness />);
    await useAiChatStore.getState().loadConversations();
    await waitFor(() => expect(useAiChatStore.getState().hasLoadedConversations).toBe(true));

    await user.click(screen.getByRole('button', { name: 'Open AI Chat' }));

    expect(screen.getByRole('heading', { name: 'Feeding enquiry' })).toBeInTheDocument();
    expect(
      screen.queryByText('Ask about your pets, bookings or care updates.'),
    ).not.toBeInTheDocument();
  });
});
