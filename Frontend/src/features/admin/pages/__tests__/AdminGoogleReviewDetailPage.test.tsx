// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { googleReviewsApi } from '../../api/googleReviewsApi';
import { FakeEventSource } from '../../../../shared/events/__tests__/fakeEventSource';
import { useGoogleReviewStore, resetGoogleReviewStore } from '../../store/googleReviewStore';
import type { AdminGoogleReviewPage } from '../../types/googleReview';
import { AdminGoogleReviewDetailPage } from '../AdminGoogleReviewDetailPage';

const reviewPage: AdminGoogleReviewPage = {
  reviews: [
    {
      id: 'google-review-1',
      reviewerName: 'Andrew',
      reviewerEmail: 'andrew@example.test',
      reviewerAvatarUrl: null,
      reviewerIsAnonymous: false,
      rating: 5,
      reviewText: 'The stay was thoughtful and comfortable.',
      photoUrls: ['/uploads/google-reviews/pikkle.jpg'],
      createdAt: '2026-08-10T00:00:00.000Z',
      updatedAt: '2026-08-10T00:00:00.000Z',
      ownerReply: null,
      ownerReplyUpdatedAt: null,
      triageType: null,
      isRead: false,
      currentStatus: 'received',
      assignedEmployeeUuid: null,
    },
  ],
};

const renderPage = (): void => {
  render(
    <MemoryRouter initialEntries={['/admin/google-reviews/google-review-1']}>
      <Routes>
        <Route path="/admin/google-reviews/:id" element={<AdminGoogleReviewDetailPage />} />
        <Route path="/admin/feedback" element={<div data-testid="google-card-list" />} />
      </Routes>
    </MemoryRouter>,
  );
};

describe('AdminGoogleReviewDetailPage', () => {
  beforeEach(() => {
    FakeEventSource.reset();
    vi.stubGlobal('EventSource', FakeEventSource as unknown as typeof EventSource);
    resetGoogleReviewStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    resetGoogleReviewStore();
  });

  it('renders review content and photos without loading analysis endpoints', async () => {
    useGoogleReviewStore.getState().hydrateReviewPage(reviewPage);
    const getReviews = vi.spyOn(googleReviewsApi, 'getReviews');

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Andrew' })).toBeInTheDocument();
    expect(screen.getByText('The stay was thoughtful and comfortable.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: "Andrew's review photo 1" })).toHaveAttribute(
      'loading',
      'lazy',
    );
    expect(screen.queryByText(/Evidence Check|Confidence:/)).not.toBeInTheDocument();
    expect(getReviews).not.toHaveBeenCalled();
  });

  it('composes and sends a manual reply', async () => {
    const user = userEvent.setup();
    const sendReply = vi.spyOn(googleReviewsApi, 'replyToGoogleReview').mockResolvedValue({
      ...reviewPage.reviews[0],
      ownerReply: 'Thank you for sharing this.',
      ownerReplyUpdatedAt: '2026-09-02T01:00:00.000Z',
    });
    useGoogleReviewStore.getState().hydrateReviewPage(reviewPage);

    renderPage();
    await screen.findByRole('heading', { name: 'Andrew' });
    const editor = screen.getByPlaceholderText('Type your reply here...');
    expect(editor).toHaveValue('');
    await user.type(editor, 'Thank you for sharing this.');
    await user.click(screen.getByRole('button', { name: 'Reply' }));

    await waitFor(() =>
      expect(sendReply).toHaveBeenCalledWith('google-review-1', 'Thank you for sharing this.'),
    );
  });
});
