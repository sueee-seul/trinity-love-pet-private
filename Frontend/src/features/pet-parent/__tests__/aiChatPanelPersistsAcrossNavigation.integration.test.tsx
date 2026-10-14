import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AiChatFloatingPanel } from '../ai-chat/components/AiChatFloatingPanel';
import { createMockConversations } from '../ai-chat/__tests__/testFixtures';
import { useAiChatStore } from '../ai-chat/store';

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

/** Mirrors the shape of PetParentPortal: a fixed layout with a routed page plus the floating panel. */
function PetParentPortalHarness(): ReactElement {
  return (
    <>
      <Routes>
        <Route
          path="/parent"
          element={
            <div>
              <h1>Dashboard page</h1>
              <Link to="/parent/stays">Go to My stays</Link>
              <Link to="/parent/booking">Go to Booking</Link>
            </div>
          }
        />
        <Route
          path="/parent/stays"
          element={
            <div>
              <h1>My stays page</h1>
              <Link to="/parent">Go to Home</Link>
            </div>
          }
        />
        <Route
          path="/parent/booking"
          element={
            <div>
              <h1>Booking page</h1>
              <Link to="/parent">Go to Home</Link>
            </div>
          }
        />
      </Routes>
      <AiChatFloatingPanel />
    </>
  );
}

const renderPortal = (): void => {
  render(
    <MemoryRouter initialEntries={['/parent']}>
      <PetParentPortalHarness />
    </MemoryRouter>,
  );
};

beforeEach(() => {
  resetStore();
});

describe('AI Chat floating panel persists across pet-parent navigation (integration)', () => {
  it('stays open with the same conversation after navigating to a different parent page', async () => {
    const user = userEvent.setup();
    renderPortal();

    expect(screen.getByRole('heading', { name: 'Dashboard page' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: "Bella's Care Updates" })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Go to My stays' }));

    expect(screen.getByRole('heading', { name: 'My stays page' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: "Bella's Care Updates" })).toBeInTheDocument();
    expect(useAiChatStore.getState().isPanelOpen).toBe(true);
  });

  it('steps aside on booking and comes back as it was on the next page', async () => {
    const user = userEvent.setup();
    renderPortal();

    await user.click(screen.getByRole('link', { name: 'Go to Booking' }));

    expect(screen.getByRole('heading', { name: 'Booking page' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: "Bella's Care Updates" })).not.toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Go to Home' }));

    expect(screen.getByRole('heading', { name: "Bella's Care Updates" })).toBeInTheDocument();
  });

  it('stays minimized across navigation rather than resetting to expanded', async () => {
    useAiChatStore.setState({ isPanelMinimized: true });
    const user = userEvent.setup();
    renderPortal();

    expect(screen.getByRole('button', { name: 'Expand AI Chat' })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Go to My stays' }));

    expect(screen.getByRole('button', { name: 'Expand AI Chat' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Minimise' })).not.toBeInTheDocument();
  });
});
