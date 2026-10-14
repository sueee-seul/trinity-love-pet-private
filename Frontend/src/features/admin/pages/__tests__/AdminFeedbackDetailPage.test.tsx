// @vitest-environment jsdom
import type { ReactElement } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminFeedbackDetailPage } from '../AdminFeedbackDetailPage';
import { useFeedbackStore } from '../../store/feedbackStore';
import type { AdminFeedback, FeedbackProgressStep } from '../../types/feedback';

vi.mock('../../components/feedback/FeedbackDetailContent', () => ({
  FeedbackDetailContent: ({
    feedback,
    onUpdateStatus,
    onBackToCards,
  }: {
    feedback: AdminFeedback;
    onUpdateStatus?: (id: string, step: FeedbackProgressStep) => void;
    onBackToCards?: () => void;
  }): ReactElement => (
    <>
      <div data-testid="feedback-detail-content">{feedback.parentName}</div>
      <button type="button" onClick={onBackToCards}>
        Back to Feedback Cards
      </button>
      {feedback.category === 'Issue' && (
        <button type="button" onClick={() => onUpdateStatus?.(feedback.uuid, 'review_started')}>
          Advance status
        </button>
      )}
    </>
  ),
}));

const firstFeedback: AdminFeedback = {
  uuid: 'feedback-1',
  initials: 'AM',
  parentName: 'Ava Mitchell',
  petName: 'Biscuit',
  date: 'Aug 24, 2026',
  timestamp: 1787529600000,
  serviceType: '',
  rating: 3.4,
  aiSummary: 'The parent suggested showing individual pet images.',
  category: 'Suggestion',
  is_read: false,
  assigneeId: null,
  current_status: 'submitted',
  answers: ['The parent suggested showing individual pet images.'],
  timeline: [{ step: 'submitted', timestamp: 'Aug 24, 2026', actor: 'System' }],
};

const secondFeedback: AdminFeedback = {
  ...firstFeedback,
  uuid: 'feedback-2',
  initials: 'BS',
  parentName: 'Ben Smith',
  petName: 'Milo',
  date: 'Aug 23, 2026',
  timestamp: 1787443200000,
  category: 'Issue',
  is_read: true,
  aiSummary: 'The parent reported a service issue.',
  answers: ['The parent reported a service issue.'],
};

describe('AdminFeedbackDetailPage', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    useFeedbackStore.getState().resetFeedbackSnapshot();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fetchMock.mockReset();
    useFeedbackStore.getState().resetFeedbackSnapshot();
  });

  const renderPage = (initialEntry = '/admin/feedback/feedback-1'): void => {
    render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/admin/feedback/:id" element={<AdminFeedbackDetailPage />} />
          <Route path="/admin/feedback" element={<div data-testid="feedback-list-route" />} />
        </Routes>
      </MemoryRouter>,
    );
  };

  it('switches between hydrated cards without fetching detail or remounting the sidebar', async () => {
    const user = userEvent.setup();
    useFeedbackStore.getState().hydrateFeedbackSnapshot([firstFeedback, secondFeedback]);
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/read')) {
        return Promise.resolve({ ok: true, json: async () => ({ updatedUuids: ['feedback-1'] }) });
      }
      return Promise.resolve({ ok: false, json: async () => ({}) });
    });

    renderPage();

    expect(await screen.findByTestId('feedback-detail-content')).toHaveTextContent('Ava Mitchell');
    expect(screen.getByText('Recent Feedback')).toBeInTheDocument();

    await user.click(screen.getByText('Ben Smith'));

    expect(await screen.findByTestId('feedback-detail-content')).toHaveTextContent('Ben Smith');
    expect(screen.getByText('Recent Feedback')).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).includes('/api/admin/feedback/feedback-2'),
      ),
    ).toBe(false);
    expect(
      fetchMock.mock.calls.some(([input]) => String(input).includes('/api/admin/feedback?')),
    ).toBe(false);
  });

  it('hydrates a direct detail route once when the store is empty', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/snapshot')) {
        return Promise.resolve({
          ok: true,
          json: async () => [firstFeedback, secondFeedback],
        });
      }
      if (url.endsWith('/read')) {
        return Promise.resolve({ ok: true, json: async () => ({ updatedUuids: ['feedback-1'] }) });
      }
      return Promise.resolve({ ok: false, json: async () => ({}) });
    });

    renderPage();

    expect(await screen.findByTestId('feedback-detail-content')).toHaveTextContent('Ava Mitchell');
    expect(
      fetchMock.mock.calls.filter(([input]) => String(input).endsWith('/snapshot')),
    ).toHaveLength(1);
  });

  it('uses the shared contextual loading state while hydrating a direct detail route', async () => {
    let resolveSnapshot: (response: {
      ok: boolean;
      json: () => Promise<AdminFeedback[]>;
    }) => void = () => undefined;
    const snapshotResponse = new Promise<{ ok: boolean; json: () => Promise<AdminFeedback[]> }>(
      (resolve) => {
        resolveSnapshot = resolve;
      },
    );
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      if (String(input).endsWith('/snapshot')) {
        return snapshotResponse;
      }
      return Promise.resolve({ ok: false, json: async () => ({}) });
    });

    renderPage();

    expect(screen.getByRole('status')).toHaveTextContent('Loading feedback…');
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();

    resolveSnapshot({ ok: true, json: async () => [] });
    await waitFor(() => {
      expect(screen.getByTestId('feedback-list-route')).toBeInTheDocument();
    });
  });

  it('replaces the matching cached record after a progress mutation', async () => {
    const updatedFeedback: AdminFeedback = {
      ...secondFeedback,
      current_status: 'review_started',
      timeline: [
        ...secondFeedback.timeline,
        { step: 'review_started', timestamp: 'Aug 25, 2026', actor: 'Admin User' },
      ],
    };
    const user = userEvent.setup();
    useFeedbackStore.getState().hydrateFeedbackSnapshot([firstFeedback, secondFeedback]);
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/status')) {
        return Promise.resolve({ ok: true, json: async () => updatedFeedback });
      }
      return Promise.resolve({ ok: false, json: async () => ({}) });
    });

    renderPage('/admin/feedback/feedback-2');
    await user.click(await screen.findByRole('button', { name: 'Advance status' }));

    expect(useFeedbackStore.getState().feedbackByUuid['feedback-2']).toEqual(updatedFeedback);
    expect(useFeedbackStore.getState().feedbackByUuid['feedback-1']).toEqual(firstFeedback);
  });

  it('returns to the Internal Feedback card context from the detail page', async () => {
    const user = userEvent.setup();
    useFeedbackStore.getState().hydrateFeedbackSnapshot([firstFeedback, secondFeedback]);
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      if (String(input).endsWith('/read')) {
        return Promise.resolve({ ok: true, json: async () => ({ updatedUuids: [] }) });
      }
      return Promise.resolve({ ok: false, json: async () => ({}) });
    });

    renderPage();
    await screen.findByTestId('feedback-detail-content');
    await user.click(screen.getByRole('button', { name: 'Back to Feedback Cards' }));

    expect(screen.getByTestId('feedback-list-route')).toBeInTheDocument();
  });
});
