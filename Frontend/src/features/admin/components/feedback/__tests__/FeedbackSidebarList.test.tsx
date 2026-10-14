// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedbackSidebarList } from '../FeedbackSidebarList';
import { useFeedbackStore } from '../../../store/feedbackStore';
import type { AdminFeedback } from '../../../types/feedback';

const feedback: AdminFeedback = {
  uuid: 'feedback-1',
  initials: 'AM',
  parentName: 'Ava Mitchell',
  petName: 'Biscuit',
  date: 'Aug 24, 2026',
  timestamp: Date.now(),
  serviceType: '',
  rating: 3.4,
  aiSummary: 'The parent suggested showing individual pet images.',
  category: 'Suggestion',
  is_read: false,
  assigneeId: null,
  current_status: 'submitted',
  answers: ['The parent suggested the gallery update.'],
  timeline: [{ step: 'submitted', timestamp: 'Aug 24, 2026', actor: 'System' }],
};

describe('FeedbackSidebarList', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    useFeedbackStore.getState().resetFeedbackSnapshot();
    useFeedbackStore.getState().hydrateFeedbackSnapshot([feedback]);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    fetchMock.mockReset();
    useFeedbackStore.getState().resetFeedbackSnapshot();
  });

  const renderSidebar = (): void => {
    render(
      <MemoryRouter initialEntries={['/admin/feedback/feedback-1']}>
        <Routes>
          <Route path="/admin/feedback/:id" element={<FeedbackSidebarList />} />
        </Routes>
      </MemoryRouter>,
    );
  };

  it('renders hydrated data and applies sidebar filters locally', async () => {
    // The "30 days" filter counts back from now, so the clock is pinned a week after the
    // fixture date. Only Date is faked: the user events and findBy still need real timers.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-08-31T00:00:00.000Z'));
    const user = userEvent.setup();
    renderSidebar();

    expect(await screen.findByText('Ava Mitchell')).toBeInTheDocument();
    expect(screen.getByText('Biscuit')).toBeInTheDocument();
    expect(screen.queryByText('Biscuit ()')).not.toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: 'Search sidebar feedback' }), 'gallery');
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Sidebar feedback time range' }),
      'last_30_days',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Sidebar feedback rating filter' }),
      'medium',
    );

    expect(await screen.findByText('Ava Mitchell')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps the sidebar loading area structural while the snapshot is pending', async () => {
    let resolveSnapshot: (response: {
      ok: boolean;
      json: () => Promise<AdminFeedback[]>;
    }) => void = () => undefined;
    const snapshotResponse = new Promise<{
      ok: boolean;
      json: () => Promise<AdminFeedback[]>;
    }>((resolve) => {
      resolveSnapshot = resolve;
    });
    useFeedbackStore.getState().setSnapshotLoading();
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      if (String(input).endsWith('/snapshot')) {
        return snapshotResponse;
      }
      return Promise.resolve({ ok: true, json: async () => [] });
    });

    renderSidebar();

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Loading sidebar feedback…');
    expect(status.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    expect(screen.queryByText('No results found.')).not.toBeInTheDocument();

    resolveSnapshot({ ok: true, json: async () => [feedback] });
    await waitFor(() => {
      expect(screen.getByText('Ava Mitchell')).toBeInTheDocument();
    });
  });
});
