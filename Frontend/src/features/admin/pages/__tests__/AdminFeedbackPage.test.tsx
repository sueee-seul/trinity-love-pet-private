// @vitest-environment jsdom
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
  type RenderResult,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminFeedbackPage } from '../AdminFeedbackPage';
import { useAuthStore } from '../../../../shared/auth/store/authStore';
import { useFeedbackStore } from '../../store/feedbackStore';
import { resetGoogleReviewStore } from '../../store/googleReviewStore';
import type { AdminFeedback, FeedbackListItem } from '../../types/feedback';
import type { AdminGoogleReviewPage } from '../../types/googleReview';

const STAFF_JACKSON_UUID = '00000000-0000-4000-8000-000000000202';

const mockFeedbacks: FeedbackListItem[] = [
  {
    uuid: '1',
    initials: 'JA',
    parentName: 'Jennifer Andrews',
    petName: 'Sherlock',
    date: 'Aug 15, 2026',
    timestamp: 1786881600000,
    serviceType: 'Daycare',
    rating: 5,
    aiSummary: 'Parent praised the facility and daily photo updates.',
    category: 'Praise',
    is_read: false,
    assigneeId: null,
    current_status: 'submitted',
  },
  {
    uuid: '2',
    initials: 'JL',
    parentName: 'Jason Lo',
    petName: 'Arctic Dog',
    date: 'Aug 10, 2026',
    timestamp: 1786449600000,
    serviceType: 'Grooming',
    rating: 1,
    aiSummary: 'Parent reported the dog was returned wet after grooming.',
    category: 'Issue',
    is_read: false,
    assigneeId: STAFF_JACKSON_UUID,
    current_status: 'submitted',
  },
];

const mockGoogleReviewPage: AdminGoogleReviewPage = {
  reviews: [
    {
      id: 'google-review-1',
      reviewerName: 'Andrew',
      reviewerEmail: 'andrew@example.test',
      reviewerAvatarUrl: null,
      reviewerIsAnonymous: false,
      rating: 5,
      reviewText:
        'We booked Pikkle into the Deluxe suite from 26 July to 7 August, and the whole stay felt thoughtfully organised. The private space and webcam access gave us peace of mind, while the extra playtime suited his energy perfectly. The team kept his house-food routine consistent, and Pikkle came home happy, relaxed, and wonderfully tired.',
      photoUrls: ['/uploads/google-reviews/pikkle.jpg'],
      createdAt: '2026-08-10T00:00:00.000Z',
      updatedAt: '2026-08-10T00:00:00.000Z',
      ownerReply: null,
      ownerReplyUpdatedAt: null,
      triageType: 'praise',
      isRead: false,
      currentStatus: 'received',
      assignedEmployeeUuid: null,
    },
  ],
};

const ageFilteredGoogleReviewPage: AdminGoogleReviewPage = {
  reviews: [
    {
      ...mockGoogleReviewPage.reviews[0],
      id: 'issue-overdue',
      reviewerName: 'Issue overdue',
      triageType: 'issue',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    },
    {
      ...mockGoogleReviewPage.reviews[0],
      id: 'issue-approaching',
      reviewerName: 'Issue approaching',
      triageType: 'issue',
      createdAt: '2026-09-03T00:00:00.000Z',
      updatedAt: '2026-09-03T00:00:00.000Z',
    },
    {
      ...mockGoogleReviewPage.reviews[0],
      id: 'issue-replied',
      reviewerName: 'Issue replied',
      triageType: 'issue',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-02T00:00:00.000Z',
      ownerReply: 'Already replied.',
      ownerReplyUpdatedAt: '2026-08-02T00:00:00.000Z',
    },
    {
      ...mockGoogleReviewPage.reviews[0],
      id: 'praise-overdue',
      reviewerName: 'Praise overdue',
      triageType: 'praise',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    },
  ],
};

const mockReadFeedback: FeedbackListItem = {
  ...mockFeedbacks[0],
  uuid: '3',
  initials: 'RP',
  parentName: 'Read Parent',
  petName: 'Read Pet',
  is_read: true,
  assigneeId: null,
};

const toMockDetail = (feedback: FeedbackListItem): AdminFeedback => {
  const { suggestionWorkflow, ...feedbackFields } = feedback;
  return {
    ...feedbackFields,
    answers: [feedback.aiSummary],
    timeline: [{ step: feedback.current_status, timestamp: feedback.date, actor: 'System' }],
    ...(suggestionWorkflow
      ? {
          suggestionWorkflow: {
            ...suggestionWorkflow,
            ownerId: 'staff-1',
            evidenceSummary: null,
            decisionReason: null,
            nextReviewAt: null,
            events: [],
          },
        }
      : {}),
  };
};

const LocationProbe = (): React.ReactElement => {
  const location = useLocation();
  return (
    <output data-testid="feedback-location">
      {location.pathname}
      {location.search}
    </output>
  );
};

const renderPage = (
  initialEntry = '/admin/feedback?source=internal',
  includeLocation = false,
): RenderResult => {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AdminFeedbackPage />
      {includeLocation && <LocationProbe />}
    </MemoryRouter>,
  );
};

describe('AdminFeedbackPage bulk selection', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    useAuthStore.getState().login({
      email: 'manager@example.test',
      is_employee: true,
      is_pet_owner: false,
      employee_role: 'manager',
    });
    useFeedbackStore.getState().resetFeedbackSnapshot();
    resetGoogleReviewStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    fetchMock.mockReset();
    useAuthStore.getState().logout();
    useFeedbackStore.getState().resetFeedbackSnapshot();
    resetGoogleReviewStore();
  });

  const configureFetchMock = (
    mutationPath?: string,
    mutationResponse: unknown = {},
    feedbackResponse: FeedbackListItem[] = mockFeedbacks,
    googleReviewPage: AdminGoogleReviewPage = mockGoogleReviewPage,
  ): void => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/admin/google-reviews?placeSlug=PetHouse')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ code: 200, msg: 'Google reviews loaded', data: googleReviewPage }),
        });
      }
      if (mutationPath && url.endsWith(mutationPath)) {
        return Promise.resolve({ ok: true, json: async () => mutationResponse });
      }
      if (url.endsWith('/snapshot')) {
        return Promise.resolve({
          ok: true,
          json: async () => feedbackResponse.map(toMockDetail),
        });
      }
      return Promise.resolve({ ok: true, json: async () => feedbackResponse });
    });
  };

  it('places source tabs above the shared toolbar and keeps the toolbar on Google Reviews', async () => {
    const user = userEvent.setup();
    configureFetchMock();

    renderPage('/admin/feedback');

    const sourceTabs = await screen.findByRole('tablist', { name: 'Feedback source' });
    const toolbar = screen.getByTestId('feedback-toolbar-top-row');
    expect(
      sourceTabs.compareDocumentPosition(toolbar) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Google Reviews' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Internal Feedback' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
    expect(screen.getByRole('tabpanel', { name: 'Google Reviews' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Reviewer' })).toBeInTheDocument();
    expect(screen.getByText('Andrew')).toBeInTheDocument();
    expect(await screen.findByRole('table')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Google Reviews' }));

    expect(screen.getByRole('tab', { name: 'Google Reviews' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tabpanel', { name: 'Google Reviews' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search feedback...')).toBeInTheDocument();
    expect(screen.getByText('Time & Rating')).toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: 'Feedback view' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Feedback Dashboard' })).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: 'Google review urgency filter' }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Reviewer' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Content' })).toBeInTheDocument();
    expect(screen.getByText('Andrew')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('Unreplied')).toBeInTheDocument();
    expect(screen.getByText(mockGoogleReviewPage.reviews[0]?.reviewText ?? '')).toBeInTheDocument();
    expect(screen.queryByText('Summary')).not.toBeInTheDocument();
    expect(screen.queryByText('Google review')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Card view' }));

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(await screen.findByTestId('google-review-card-google-review-1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Feedback Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View image for Andrew' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reply' })).toBeInTheDocument();
    expect(screen.getByText('View Details')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Internal Feedback' }));
    expect(screen.queryByRole('button', { name: 'Feedback Dashboard' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('combobox', { name: 'Google review urgency filter' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Table view' }));

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Assignee' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Select' })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith('/assignees'))).toBe(
      false,
    );
  });

  it('navigates from the Google Reviews toolbar to the Feedback Dashboard', async () => {
    const user = userEvent.setup();
    configureFetchMock();

    renderPage('/admin/feedback?source=google-reviews', true);

    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: 'Feedback Dashboard' }));

    expect(screen.getByTestId('feedback-location')).toHaveTextContent('/admin/operation');
  });

  it('hydrates status, type, and age filters from a Manager Attention link', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-03T12:00:00.000Z'));
    configureFetchMock(undefined, {}, mockFeedbacks, ageFilteredGoogleReviewPage);

    renderPage('/admin/feedback?source=google-reviews&status=unreplied&type=issue&age=overdue');

    await screen.findByRole('table');

    expect(screen.getByText('Issue overdue')).toBeInTheDocument();
    expect(screen.queryByText('Issue approaching')).not.toBeInTheDocument();
    expect(screen.queryByText('Issue replied')).not.toBeInTheDocument();
    expect(screen.queryByText('Praise overdue')).not.toBeInTheDocument();
  });

  it('does not show Google assignment controls to managers', async () => {
    configureFetchMock();

    renderPage('/admin/feedback?source=google-reviews');

    await screen.findByRole('table');
    expect(screen.queryByRole('button', { name: 'Select' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Assignee' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('combobox', { name: 'Assign selected feedback to staff' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: 'Review type for google-review-1' }),
    ).toBeInTheDocument();
  });

  it('shows server-scoped Google rows to staff without selection or assignment controls', async () => {
    useAuthStore.getState().login({
      email: 'staff@example.test',
      is_employee: true,
      is_pet_owner: false,
      employee_role: 'staff',
    });
    configureFetchMock();

    renderPage('/admin/feedback?source=google-reviews');

    await screen.findByRole('table');
    expect(screen.getByText('Andrew')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Select' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Assignee' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('combobox', { name: 'Assign selected feedback to staff' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View details' })).toBeInTheDocument();
  });

  it('restores the Google card context from the feedback return query', async () => {
    configureFetchMock();

    renderPage('/admin/feedback?source=google-reviews&view=card');

    expect(screen.getByRole('tab', { name: 'Google Reviews' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Card view' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByTestId('google-review-card-google-review-1')).toBeInTheDocument();
  });

  it('renders the table view by default and switches to card view with icon tabs', async () => {
    const user = userEvent.setup();
    configureFetchMock();

    renderPage();

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Table view' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    screen.getByRole('tab', { name: 'Table view' }).focus();
    await user.keyboard('{ArrowRight}');

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'View Details' })).toHaveLength(2);
    expect(screen.getByRole('tab', { name: 'Card view' })).toHaveAttribute('aria-selected', 'true');

    await user.click(screen.getByRole('tab', { name: 'Table view' }));
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('removes a feedback Card only after confirmed API deletion succeeds', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    configureFetchMock('/admin/feedback/1');

    renderPage();

    await user.click(await screen.findByRole('tab', { name: 'Card view' }));
    await user.click(
      await screen.findByRole('button', {
        name: 'Delete feedback from Jennifer Andrews and Sherlock',
      }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/api/admin/feedback/1',
        expect.objectContaining({
          method: 'DELETE',
          credentials: 'include',
        }),
      );
      expect(screen.queryByText('Jennifer Andrews & Sherlock')).not.toBeInTheDocument();
    });
    expect(confirmSpy).toHaveBeenCalledWith(
      'Delete feedback from Jennifer Andrews & Sherlock? This action cannot be undone.',
    );
    expect(screen.getByRole('status')).toHaveTextContent('Feedback deleted.');
  });

  it('locks feedback actions while Card deletion is pending', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    let resolveDelete: (() => void) | undefined;
    const deleteRequest = new Promise<void>((resolve) => {
      resolveDelete = resolve;
    });
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/snapshot')) {
        return Promise.resolve({ ok: true, json: async () => mockFeedbacks.map(toMockDetail) });
      }
      if (url.endsWith('/api/admin/feedback/1')) {
        return deleteRequest.then(() => ({ ok: true }));
      }
      return Promise.resolve({ ok: true, json: async () => mockFeedbacks });
    });

    renderPage();

    await user.click(await screen.findByRole('tab', { name: 'Card view' }));
    const deleteButton = await screen.findByRole('button', {
      name: 'Delete feedback from Jennifer Andrews and Sherlock',
    });
    await user.click(deleteButton);

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(deleteButton).toHaveTextContent('Deleting...');
    expect(deleteButton).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Select' })).toBeDisabled();

    resolveDelete?.();
    await waitFor(() => {
      expect(screen.queryByText('Jennifer Andrews & Sherlock')).not.toBeInTheDocument();
    });
  });

  it('keeps the feedback Card and sends no request when deletion is cancelled', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    configureFetchMock();

    renderPage();

    await user.click(await screen.findByRole('tab', { name: 'Card view' }));
    await user.click(
      await screen.findByRole('button', {
        name: 'Delete feedback from Jennifer Andrews and Sherlock',
      }),
    );

    expect(screen.getByText('Jennifer Andrews & Sherlock')).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([input]) => String(input).endsWith('/api/admin/feedback/1')),
    ).toBe(false);
  });

  it('keeps the feedback Card and shows an error when deletion fails', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/snapshot')) {
        return Promise.resolve({ ok: true, json: async () => mockFeedbacks.map(toMockDetail) });
      }
      if (url.endsWith('/api/admin/feedback/1')) {
        return Promise.resolve({ ok: false, status: 503, json: async () => ({}) });
      }
      return Promise.resolve({ ok: true, json: async () => mockFeedbacks });
    });

    renderPage();

    await user.click(await screen.findByRole('tab', { name: 'Card view' }));
    await user.click(
      await screen.findByRole('button', {
        name: 'Delete feedback from Jennifer Andrews and Sherlock',
      }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not delete this feedback. Nothing was removed. Please try again.',
    );
    expect(screen.getByText('Jennifer Andrews & Sherlock')).toBeInTheDocument();
  });

  it('applies time and rating filters immediately without another feedback request', async () => {
    const user = userEvent.setup();
    configureFetchMock();

    renderPage();
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Open time and rating filters' }));
    expect(screen.getByTestId('feedback-range-popover')).toHaveClass('sm:flex-row');

    const requestCountBeforeFilter = fetchMock.mock.calls.length;

    fireEvent.change(screen.getByRole('slider', { name: 'Feedback time range end' }), {
      target: { value: String(Date.parse('2026-08-12T00:00:00Z')) },
    });
    fireEvent.change(screen.getByRole('slider', { name: 'Maximum feedback rating' }), {
      target: { value: '4' },
    });

    await waitFor(() => {
      expect(screen.getByText('Jason Lo & Arctic Dog')).toBeInTheDocument();
      expect(screen.queryByText('Jennifer Andrews & Sherlock')).not.toBeInTheDocument();
    });
    expect(fetchMock.mock.calls).toHaveLength(requestCountBeforeFilter);

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByTestId('feedback-range-popover')).not.toBeInTheDocument();
  });

  it('selects visible feedbacks and marks them as reviewed from the contextual toolbar', async () => {
    const user = userEvent.setup();
    configureFetchMock('/read', { updatedUuids: ['1', '2'] });

    renderPage();

    expect(
      screen.queryByRole('checkbox', { name: 'Select all visible feedback' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Card view' }));
    expect(
      screen.queryByRole('combobox', { name: 'Assign selected feedback to staff' }),
    ).not.toBeInTheDocument();
    const selectButton = await screen.findByRole('button', { name: 'Select' });
    expect(selectButton).toHaveClass(
      'min-h-11',
      'rounded-lg',
      'border',
      'border-control-border',
      'bg-surface-card',
      'px-4',
    );
    await user.click(selectButton);

    const selectAll = await screen.findByRole('checkbox', {
      name: 'Select all visible feedback',
    });
    await user.click(selectAll);

    expect(screen.getByText('2 selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark reviewed' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Mark reviewed' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/api/admin/feedback/read',
        expect.objectContaining({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feedbackUuids: ['1', '2'] }),
        }),
      );
    });
    expect(screen.queryByText('2 selected')).not.toBeInTheDocument();
  });

  it('sends only unread records when marking a mixed selection as reviewed', async () => {
    const user = userEvent.setup();
    const feedbackResponse = [mockFeedbacks[0], mockReadFeedback];
    configureFetchMock('/read', { updatedUuids: ['1'] }, feedbackResponse);

    renderPage();

    await user.click(screen.getByRole('tab', { name: 'Card view' }));
    await user.click(await screen.findByRole('button', { name: 'Select' }));
    await user.click(
      await screen.findByRole('checkbox', {
        name: 'Select feedback from Read Parent and Read Pet',
      }),
    );
    await user.click(
      screen.getByRole('checkbox', {
        name: 'Select feedback from Jennifer Andrews and Sherlock',
      }),
    );

    await user.click(screen.getByRole('button', { name: 'Mark reviewed' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/api/admin/feedback/read',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ feedbackUuids: ['1'] }),
        }),
      );
    });
  });

  it('locks selection controls while a reviewed request is pending', async () => {
    const user = userEvent.setup();
    let resolveMutation: ((value: unknown) => void) | undefined;
    const mutationPromise = new Promise<unknown>((resolve) => {
      resolveMutation = resolve;
    });

    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/read')) {
        return mutationPromise.then((response): unknown => ({
          ok: true,
          json: async () => response,
        }));
      }
      if (url.endsWith('/snapshot')) {
        return Promise.resolve({ ok: true, json: async () => mockFeedbacks.map(toMockDetail) });
      }
      return Promise.resolve({ ok: true, json: async () => mockFeedbacks });
    });

    renderPage();

    await user.click(screen.getByRole('tab', { name: 'Card view' }));
    await user.click(await screen.findByRole('button', { name: 'Select' }));
    await user.click(
      await screen.findByRole('checkbox', {
        name: 'Select all visible feedback',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Mark reviewed' }));

    expect(await screen.findByRole('button', { name: 'Marking reviewed...' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Select all visible feedback' })).toBeDisabled();
    expect(
      screen.getByRole('checkbox', {
        name: 'Select feedback from Jennifer Andrews and Sherlock',
      }),
    ).toBeDisabled();

    resolveMutation?.({ updatedUuids: ['1', '2'] });
    await waitFor(() => {
      expect(screen.queryByText('2 selected')).not.toBeInTheDocument();
    });
  });

  it('supports selecting individual feedbacks and clearing the selection', async () => {
    const user = userEvent.setup();
    configureFetchMock();

    renderPage();

    await user.click(screen.getByRole('tab', { name: 'Card view' }));
    await user.click(await screen.findByRole('button', { name: 'Select' }));
    await user.click(
      await screen.findByRole('checkbox', {
        name: 'Select feedback from Jennifer Andrews and Sherlock',
      }),
    );
    await user.click(
      screen.getByRole('checkbox', {
        name: 'Select feedback from Jason Lo and Arctic Dog',
      }),
    );

    expect(screen.getByText('2 selected')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear selection' }));

    expect(screen.getByText('Select all')).toBeInTheDocument();
    expect(screen.queryByText('2 selected')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Done' }));

    expect(screen.getByRole('button', { name: 'Select' })).toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', { name: 'Select all visible feedback' }),
    ).not.toBeInTheDocument();
  });

  it('renders an explicit error when the feedback list cannot be loaded', async () => {
    fetchMock.mockImplementation(() => {
      return Promise.resolve({ ok: false, json: async () => ({}) });
    });

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to load feedback. Please try again.',
    );
    expect(screen.queryByText('No feedback matches your criteria.')).not.toBeInTheDocument();
  });

  it('renders an explicit error when the feedback list contract is malformed', async () => {
    fetchMock.mockImplementation(() => {
      return Promise.resolve({ ok: true, json: async () => [{ uuid: 'malformed' }] });
    });

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to load feedback. Please try again.',
    );
  });
});
