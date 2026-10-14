// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeEventSource } from '../../../../../shared/events/__tests__/fakeEventSource';
import { googleReviewsApi } from '../../../api/googleReviewsApi';
import {
  resetGoogleReviewStore,
  useGoogleReviewStore,
  useGoogleReviewStoreSync,
} from '../../../store/googleReviewStore';
import type { AdminGoogleReviewPage } from '../../../types/googleReview';
import { GoogleReviewsPanel } from '../GoogleReviewsPanel';

const reviewPage: AdminGoogleReviewPage = {
  reviews: [
    {
      id: 'google-review-1',
      reviewerName: 'Andrew',
      reviewerEmail: 'andrew@example.test',
      reviewerAvatarUrl: null,
      reviewerIsAnonymous: false,
      rating: 4 as const,
      reviewText: 'A calm and thoughtful stay for our dog.',
      photoUrls: [],
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

const GoogleReviewsPanelWithSync: React.FC = () => {
  useGoogleReviewStoreSync();
  return <GoogleReviewsPanel onViewDetails={vi.fn()} />;
};

describe('GoogleReviewsPanel', () => {
  beforeEach(() => {
    FakeEventSource.reset();
    vi.stubGlobal('EventSource', FakeEventSource as unknown as typeof EventSource);
    resetGoogleReviewStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    resetGoogleReviewStore();
  });

  it('loads and renders Google review cards from the employee Google review response', async () => {
    const getReviews = vi.spyOn(googleReviewsApi, 'getReviews').mockResolvedValue({
      ok: true,
      data: reviewPage,
    });

    render(<GoogleReviewsPanel onViewDetails={vi.fn()} />);

    expect(await screen.findByTestId('google-review-card-google-review-1')).toBeInTheDocument();
    expect(getReviews).toHaveBeenCalledWith('PetHouse');
  });

  it('refreshes the store and re-renders after a server review update event', async () => {
    const updatedReview = {
      ...reviewPage.reviews[0],
      id: 'google-review-2',
      reviewerName: 'alan',
    };
    const getReviews = vi
      .spyOn(googleReviewsApi, 'getReviews')
      .mockResolvedValueOnce({ ok: true, data: reviewPage })
      .mockResolvedValueOnce({ ok: true, data: { reviews: [updatedReview] } });

    render(<GoogleReviewsPanelWithSync />);
    expect(await screen.findByTestId('google-review-card-google-review-1')).toBeInTheDocument();

    FakeEventSource.instances[0]?.emitUpdate({
      type: 'google-reviews-updated',
      placeSlug: 'PetHouse',
      changeType: 'replied',
    });

    expect(await screen.findByTestId('google-review-card-google-review-2')).toBeInTheDocument();
    expect(screen.queryByTestId('google-review-card-google-review-1')).not.toBeInTheDocument();
    expect(getReviews).toHaveBeenCalledTimes(2);
  });

  it('shows an empty state when the review response contains no reviews', async () => {
    vi.spyOn(googleReviewsApi, 'getReviews').mockResolvedValue({
      ok: true,
      data: { reviews: [] },
    });

    render(<GoogleReviewsPanel onViewDetails={vi.fn()} />);

    expect(await screen.findByText('No Google reviews match your criteria.')).toBeInTheDocument();
  });

  it('filters pending Google reviews by approaching and overdue age bands', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-03T12:00:00.000Z'));
    vi.spyOn(googleReviewsApi, 'getReviews').mockResolvedValue({
      ok: true,
      data: {
        reviews: [
          {
            ...reviewPage.reviews[0],
            id: 'overdue-review',
            reviewerName: 'Overdue review',
            createdAt: '2026-08-01T00:00:00.000Z',
          },
          {
            ...reviewPage.reviews[0],
            id: 'approaching-review',
            reviewerName: 'Approaching review',
            createdAt: '2026-09-03T00:00:00.000Z',
          },
          {
            ...reviewPage.reviews[0],
            id: 'replied-overdue-review',
            reviewerName: 'Replied overdue review',
            createdAt: '2026-08-01T00:00:00.000Z',
            ownerReply: 'Already replied.',
            ownerReplyUpdatedAt: '2026-08-02T00:00:00.000Z',
          },
        ],
      },
    });

    const { rerender } = render(
      <GoogleReviewsPanel onViewDetails={vi.fn()} viewMode="card" ageFilter="overdue" />,
    );

    expect(await screen.findByTestId('google-review-card-overdue-review')).toBeInTheDocument();
    expect(screen.queryByTestId('google-review-card-approaching-review')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('google-review-card-replied-overdue-review'),
    ).not.toBeInTheDocument();

    rerender(
      <GoogleReviewsPanel onViewDetails={vi.fn()} viewMode="card" ageFilter="approaching" />,
    );

    expect(await screen.findByTestId('google-review-card-approaching-review')).toBeInTheDocument();
    expect(screen.queryByTestId('google-review-card-overdue-review')).not.toBeInTheDocument();
  });

  it('shows an error state when the review response fails', async () => {
    vi.spyOn(googleReviewsApi, 'getReviews').mockResolvedValue({
      ok: false,
      data: null,
      message: 'Review service unavailable.',
    });

    render(<GoogleReviewsPanel onViewDetails={vi.fn()} />);

    expect(await screen.findByText('Review service unavailable.')).toBeInTheDocument();
  });

  it('renders the operational table for Google Reviews without assignment metadata', async () => {
    const review = {
      ...reviewPage.reviews[0],
      assignedEmployeeUuid: 'staff-1',
    };
    vi.spyOn(googleReviewsApi, 'getReviews').mockResolvedValue({
      ok: true,
      data: { reviews: [review] },
    });

    render(<GoogleReviewsPanel onViewDetails={vi.fn()} viewMode="table" canEditGoogleReviewType />);

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Reviewer' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Reply status' })).toBeInTheDocument();
    expect(screen.getByText('Andrew')).toBeInTheDocument();
    expect(screen.getByText('Unreplied')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Assignee' })).not.toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'Assigned staff' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Andrew &/)).not.toBeInTheDocument();
  });

  it('orders View details before Reply and positions the panel from the trigger', async () => {
    const user = userEvent.setup();
    vi.spyOn(googleReviewsApi, 'getReviews').mockResolvedValue({
      ok: true,
      data: reviewPage,
    });

    render(<GoogleReviewsPanel onViewDetails={vi.fn()} viewMode="table" />);

    const row = (await screen.findAllByRole('row'))[1];
    const actionCell = row.querySelector('td:last-child');
    expect(actionCell).not.toBeNull();
    expect(
      within(actionCell as HTMLElement)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['View details', 'Reply']);

    const quickReplyButton = within(actionCell as HTMLElement).getByRole('button', {
      name: 'Reply',
    });
    vi.spyOn(quickReplyButton, 'getBoundingClientRect').mockReturnValue({
      bottom: 200,
      left: 100,
      top: 160,
      right: 180,
      width: 80,
      height: 40,
      x: 100,
      y: 160,
      toJSON: () => ({}),
    });
    const tableRow = quickReplyButton.closest('tr');
    expect(tableRow).not.toBeNull();
    vi.spyOn(tableRow as HTMLTableRowElement, 'getBoundingClientRect').mockReturnValue({
      bottom: 900,
      top: 100,
      left: 0,
      right: 1000,
      width: 1000,
      height: 800,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    });

    await user.click(quickReplyButton);

    expect(
      await screen.findByTestId('google-review-quick-reply-panel-google-review-1'),
    ).toHaveStyle({
      top: '208px',
      left: '100px',
    });
  });

  it('keeps the existing card presentation when card mode is selected', async () => {
    vi.spyOn(googleReviewsApi, 'getReviews').mockResolvedValue({
      ok: true,
      data: reviewPage,
    });

    render(<GoogleReviewsPanel onViewDetails={vi.fn()} viewMode="card" />);

    expect(await screen.findByTestId('google-review-card-google-review-1')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('does not show assignment controls for managers in Google table mode', async () => {
    vi.spyOn(googleReviewsApi, 'getReviews').mockResolvedValue({
      ok: true,
      data: reviewPage,
    });

    render(<GoogleReviewsPanel onViewDetails={vi.fn()} viewMode="table" canEditGoogleReviewType />);

    await screen.findByRole('table');
    expect(screen.queryByRole('button', { name: 'Select' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Assignee' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('combobox', { name: 'Assign selected feedback to staff' }),
    ).not.toBeInTheDocument();
  });

  it('renders raw Content without the summary block and keeps manager-only editable type controls', async () => {
    const longText = 'Long review content '.repeat(30);
    vi.spyOn(googleReviewsApi, 'getReviews').mockResolvedValue({
      ok: true,
      data: { reviews: [{ ...reviewPage.reviews[0], reviewText: longText, triageType: 'issue' }] },
    });

    render(<GoogleReviewsPanel onViewDetails={vi.fn()} viewMode="table" canEditGoogleReviewType />);

    await screen.findByRole('table');
    expect(screen.getByRole('columnheader', { name: 'Content' })).toBeInTheDocument();
    const content = screen.getByText((text) => text.includes('Long review content'));
    expect(content).toHaveClass('max-h-24', 'overflow-y-auto');
    expect(screen.queryByText('Summary')).not.toBeInTheDocument();
    expect(screen.queryByText('Confidence: high')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Review type for google-review-1' })).toHaveValue(
      'issue',
    );
    expect(screen.getByRole('option', { name: 'Issue' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Praise' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Suggestion' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'General' })).toBeInTheDocument();
  });

  it('does not duplicate summary or confidence in table mode while preserving raw content', async () => {
    vi.spyOn(googleReviewsApi, 'getReviews').mockResolvedValue({
      ok: true,
      data: {
        reviews: [
          { ...reviewPage.reviews[0], triageType: null },
          {
            ...reviewPage.reviews[0],
            id: 'general-review',
            triageType: 'general',
          },
        ],
      },
    });

    render(<GoogleReviewsPanel onViewDetails={vi.fn()} viewMode="table" />);

    await screen.findByRole('table');
    expect(screen.queryByText('Summary pending.')).not.toBeInTheDocument();
    expect(screen.queryByText('Confidence: low')).not.toBeInTheDocument();
    expect(screen.queryByText('Confidence: medium')).not.toBeInTheDocument();
    expect(screen.getAllByText('A calm and thoughtful stay for our dog.')).toHaveLength(2);
  });

  it('opens the photo viewer from the Table reviewer metadata', async () => {
    const user = userEvent.setup();
    vi.spyOn(googleReviewsApi, 'getReviews').mockResolvedValue({
      ok: true,
      data: {
        reviews: [
          {
            ...reviewPage.reviews[0],
            photoUrls: [
              '/uploads/google-reviews/andrew-1.jpg',
              '/uploads/google-reviews/andrew-2.jpg',
              '/uploads/google-reviews/andrew-3.jpg',
            ],
          },
        ],
      },
    });

    render(<GoogleReviewsPanel onViewDetails={vi.fn()} viewMode="table" />);

    await screen.findByRole('table');
    expect(screen.queryByText('Google review')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'View image for Andrew' }));

    expect(
      await screen.findByRole('dialog', { name: 'Review photos for Andrew' }),
    ).toBeInTheDocument();
    expect(screen.getByAltText("Andrew's review photo 1")).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next photo' }));
    expect(screen.getByAltText("Andrew's review photo 2")).toBeInTheDocument();
    expect(screen.queryByAltText("Andrew's review photo 1")).not.toBeInTheDocument();
  });

  it('keeps Card Reply usable while the photo viewer is open', async () => {
    const user = userEvent.setup();
    const onViewDetails = vi.fn();
    const updatedReview = {
      ...reviewPage.reviews[0],
      photoUrls: [
        '/uploads/google-reviews/andrew-1.jpg',
        '/uploads/google-reviews/andrew-2.jpg',
        '/uploads/google-reviews/andrew-3.jpg',
      ],
      ownerReply: 'Thank you for sharing this.',
      ownerReplyUpdatedAt: '2026-09-03T00:00:00.000Z',
    };
    vi.spyOn(googleReviewsApi, 'getReviews').mockResolvedValue({
      ok: true,
      data: {
        reviews: [
          {
            ...reviewPage.reviews[0],
            photoUrls: [
              '/uploads/google-reviews/andrew-1.jpg',
              '/uploads/google-reviews/andrew-2.jpg',
              '/uploads/google-reviews/andrew-3.jpg',
            ],
          },
        ],
      },
    });
    const replyToGoogleReview = vi
      .spyOn(googleReviewsApi, 'replyToGoogleReview')
      .mockResolvedValue(updatedReview);

    render(<GoogleReviewsPanel onViewDetails={onViewDetails} viewMode="card" />);

    await screen.findByTestId('google-review-card-google-review-1');
    await user.click(screen.getByRole('button', { name: 'Reply' }));
    expect(onViewDetails).not.toHaveBeenCalled();
    const replyBox = screen.getByRole('textbox', { name: 'Reply to Andrew' });
    await user.type(replyBox, 'I am checking the photo');
    expect(onViewDetails).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'View image for Andrew' }));
    expect(onViewDetails).not.toHaveBeenCalled();
    expect(
      await screen.findByRole('dialog', { name: 'Review photos for Andrew' }),
    ).toBeInTheDocument();
    expect(screen.getByAltText("Andrew's review photo 1")).toBeInTheDocument();
    expect(replyBox).toHaveValue('I am checking the photo');

    await user.type(replyBox, ' before replying');
    expect(replyBox).toHaveValue('I am checking the photo before replying');
    expect(onViewDetails).not.toHaveBeenCalled();

    // The trigger and the send button are both named Reply once the panel is open.
    const replyPanel = screen.getByRole('dialog', { name: 'Reply to Andrew' });
    await user.click(within(replyPanel).getByRole('button', { name: 'Reply' }));
    await waitFor(() =>
      expect(replyToGoogleReview).toHaveBeenCalledWith(
        'google-review-1',
        'I am checking the photo before replying',
      ),
    );
    expect(screen.getByRole('dialog', { name: 'Review photos for Andrew' })).toBeInTheDocument();
  });

  it('keeps Staff type read-only and offers no reply navigation', async () => {
    const onViewDetails = vi.fn();
    vi.spyOn(googleReviewsApi, 'getReviews').mockResolvedValue({ ok: true, data: reviewPage });

    render(<GoogleReviewsPanel onViewDetails={onViewDetails} viewMode="table" />);

    await screen.findByRole('table');
    expect(screen.getByText('Praise')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Review type' })).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reply' }));
    expect(onViewDetails).not.toHaveBeenCalled();
  });

  it('updates the store from a successful type edit and preserves it on failure', async () => {
    const user = userEvent.setup();
    const updatedReview = { ...reviewPage.reviews[0], triageType: 'issue' as const };
    vi.spyOn(googleReviewsApi, 'getReviews').mockResolvedValue({ ok: true, data: reviewPage });
    const updateReviewType = vi
      .spyOn(googleReviewsApi, 'updateReviewType')
      .mockResolvedValueOnce(updatedReview)
      .mockRejectedValueOnce(new Error('Request failed'));

    render(<GoogleReviewsPanel onViewDetails={vi.fn()} viewMode="table" canEditGoogleReviewType />);
    await screen.findByRole('table');
    const typeSelect = screen.getByRole('combobox', { name: 'Review type for google-review-1' });
    await user.selectOptions(typeSelect, 'issue');
    await waitFor(() =>
      expect(useGoogleReviewStore.getState().reviewPage?.reviews[0]).toEqual(updatedReview),
    );
    expect(updateReviewType).toHaveBeenCalledWith('google-review-1', 'issue');

    await user.selectOptions(typeSelect, 'suggestion');
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to update review type.');
    expect(useGoogleReviewStore.getState().reviewPage?.reviews[0]).toEqual(updatedReview);
  });

  it('shows Reply for unreplied non-praise reviews and hides it after replying', async () => {
    const user = userEvent.setup();
    const updatedReview = {
      ...reviewPage.reviews[0],
      ownerReply: 'Thanks for the kind words.',
      ownerReplyUpdatedAt: '2026-09-03T00:00:00.000Z',
    };
    const issueReview = { ...reviewPage.reviews[0], triageType: 'issue' as const };
    const unclassifiedReview = {
      ...reviewPage.reviews[0],
      id: 'google-review-unclassified',
      reviewerName: 'Mia',
      triageType: null,
    };
    const repliedReview = {
      ...reviewPage.reviews[0],
      id: 'google-review-replied',
      reviewerName: 'Noah',
      ownerReply: 'Already replied.',
      ownerReplyUpdatedAt: '2026-09-03T00:00:00.000Z',
    };
    vi.spyOn(googleReviewsApi, 'getReviews').mockResolvedValue({
      ok: true,
      data: { reviews: [issueReview, unclassifiedReview, repliedReview] },
    });
    const replyToGoogleReview = vi
      .spyOn(googleReviewsApi, 'replyToGoogleReview')
      .mockRejectedValueOnce(new Error('Request failed'))
      .mockResolvedValueOnce(updatedReview);

    render(<GoogleReviewsPanel onViewDetails={vi.fn()} viewMode="table" />);
    await screen.findByRole('table');
    expect(screen.getAllByRole('button', { name: 'Reply' })).toHaveLength(2);
    expect(screen.getByText('Noah')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'View details' })).toHaveLength(3);

    await user.click(screen.getAllByRole('button', { name: 'Reply' })[0]);
    const quickReplyPanel = screen.getByRole('dialog', { name: 'Reply to Andrew' });
    expect(quickReplyPanel).toHaveClass('fixed');
    expect(quickReplyPanel).not.toHaveClass('backdrop-blur-sm');
    expect(quickReplyPanel).not.toHaveAttribute('aria-modal');
    expect(quickReplyPanel.parentElement).toBe(document.body);
    const replyBox = screen.getByRole('textbox', { name: 'Reply to Andrew' });
    await user.type(replyBox, 'Keep this draft');
    await user.click(within(quickReplyPanel).getByRole('button', { name: 'Reply' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to send reply.');
    expect(replyBox).toHaveValue('Keep this draft');

    await user.click(within(quickReplyPanel).getByRole('button', { name: 'Reply' }));
    await waitFor(() => expect(replyToGoogleReview).toHaveBeenCalledTimes(2));
    expect(useGoogleReviewStore.getState().reviewPage?.reviews[0]).toEqual(updatedReview);
    expect(screen.getAllByText('Replied')).toHaveLength(2);
    expect(screen.queryByRole('textbox', { name: 'Reply to Andrew' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reply' }));
    await user.type(screen.getByRole('textbox', { name: 'Reply to Mia' }), 'Discard me');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('textbox', { name: 'Reply to Mia' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reply' }));
    expect(screen.getByRole('textbox', { name: 'Reply to Mia' })).toHaveValue('');
  });
});
