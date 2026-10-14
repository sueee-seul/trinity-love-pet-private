import { render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authApi } from '../../../../shared/auth/api/authApi';
import { FakeEventSource } from '../../../../shared/events/__tests__/fakeEventSource';
import { reviewerAuthApi } from '../../api/reviewerAuthApi';
import { useReviewerAuthStore } from '../../store/reviewerAuthStore';
import { PetHouseReviewPage } from '../PetHouseReviewPage';

const { googleLoginMock, useGoogleLoginMock } = vi.hoisted(() => ({
  googleLoginMock: vi.fn(),
  useGoogleLoginMock: vi.fn(),
}));
vi.mock('@react-oauth/google', () => ({
  useGoogleLogin: (options: unknown): (() => void) => {
    useGoogleLoginMock(options);
    return googleLoginMock;
  },
  GoogleOAuthProvider: ({ children }: { children: React.ReactNode }): React.ReactElement => (
    <>{children}</>
  ),
  useGoogleOAuth: (): { scriptLoadedSuccessfully: boolean } => ({ scriptLoadedSuccessfully: true }),
}));

const reviewer = {
  id: 'reviewer-1',
  displayName: 'Taylor Morgan',
  avatarUrl: 'https://example.test/taylor.jpg',
};
const reviewPage = {
  location: {
    id: 'location-1',
    displayName: 'PetHouse',
    formattedAddress: 'Auckland, NZ',
    googleMapsUri: null,
    averageRating: 4.5,
    totalReviews: 2,
    ratingBreakdown: [
      { stars: 5 as const, count: 1 },
      { stars: 4 as const, count: 1 },
    ],
  },
  reviews: [
    {
      id: 'review-1',
      reviewerName: 'Maya Chen',
      reviewerAvatarUrl: null,
      reviewerIsAnonymous: false,
      rating: 5 as const,
      reviewText: 'Great care',
      photoUrls: ['/uploads/google-reviews/great-care.jpg'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ownerReply: 'Thank you!',
      ownerReplyUpdatedAt: new Date().toISOString(),
      likeCount: 0,
      viewerHasLiked: false,
    },
  ],
};

const anonymousReviewPage = {
  ...reviewPage,
  reviews: [
    {
      ...reviewPage.reviews[0],
      reviewerName: 'Maya Chen',
      reviewerIsAnonymous: true,
    },
  ],
};

const timestampedReviewPage = {
  ...reviewPage,
  reviews: [
    {
      ...reviewPage.reviews[0],
      createdAt: '2026-09-01T08:25:12.492Z',
      updatedAt: '2026-09-01T08:25:12.492Z',
      ownerReplyUpdatedAt: '2026-09-01T08:45:12.492Z',
    },
  ],
};

const searchAndSortReviewPage = {
  ...reviewPage,
  location: {
    ...reviewPage.location,
    averageRating: 3,
    totalReviews: 3,
  },
  reviews: [
    {
      ...reviewPage.reviews[0],
      id: 'service-review',
      reviewerName: 'PetHouse reviewer',
      rating: 4 as const,
      reviewText: 'PetHouse provided a Deluxe suite with Extra playtime for our dog.',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    },
    {
      ...reviewPage.reviews[0],
      id: 'name-only-review',
      reviewerName: 'PetHouse name only',
      rating: 5 as const,
      reviewText: 'A quiet garden made the stay comfortable.',
      createdAt: '2026-08-03T00:00:00.000Z',
      updatedAt: '2026-08-03T00:00:00.000Z',
    },
    {
      ...reviewPage.reviews[0],
      id: 'food-review',
      reviewerName: 'Food reviewer',
      rating: 2 as const,
      reviewText: 'The House food routine was easy to follow.',
      createdAt: '2026-08-02T00:00:00.000Z',
      updatedAt: '2026-08-02T00:00:00.000Z',
    },
  ],
};

/**
 * jsdom has no layout, so it ships no `scrollIntoView`. Only the shared-link test needs one, so
 * the stand-in lives here rather than in the shared test setup, and is undone after each test.
 */
const stubScrollIntoView = (): ReturnType<typeof vi.fn> => {
  const scrollIntoView = vi.fn();
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    value: scrollIntoView,
    configurable: true,
    writable: true,
  });
  return scrollIntoView;
};

const renderPage = (): void => {
  render(
    <MemoryRouter initialEntries={['/maps/place/PetHouse/']}>
      <PetHouseReviewPage />
    </MemoryRouter>,
  );
};

describe('PetHouseReviewPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    FakeEventSource.reset();
    vi.stubGlobal('EventSource', FakeEventSource as unknown as typeof EventSource);
    useReviewerAuthStore.getState().logout();
    googleLoginMock.mockReset();
    useGoogleLoginMock.mockReset();
    vi.spyOn(authApi, 'getGoogleConfig').mockResolvedValue({
      data: { clientId: 'maps-client-id' },
    });
    vi.spyOn(reviewerAuthApi, 'getReviewPage').mockResolvedValue({ ok: true, data: reviewPage });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    useReviewerAuthStore.getState().logout();
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  });

  it('loads location and reviews from the server', async () => {
    vi.spyOn(reviewerAuthApi, 'getCurrentReviewer').mockResolvedValue({ ok: false, data: null });
    renderPage();
    expect(screen.getByRole('status')).toHaveTextContent('Loading reviews');
    expect(await screen.findByText('Great care')).toBeInTheDocument();
    expect(screen.getByText('4.5')).toBeInTheDocument();
    expect(screen.getByText('2 reviews')).toBeInTheDocument();
    expect(reviewerAuthApi.getReviewPage).toHaveBeenCalledWith('PetHouse');
    expect(screen.getByText('Response from the owner')).toBeInTheDocument();
    const reviewPhoto = screen.getByRole('img', { name: "Maya Chen's review photo 1" });
    expect(reviewPhoto).toHaveAttribute(
      'src',
      'http://localhost:3000/uploads/google-reviews/great-care.jpg',
    );
    expect(reviewPhoto).toHaveAttribute('loading', 'lazy');
    expect(reviewPhoto).toHaveAttribute('decoding', 'async');
  });

  it('completes the initial load under StrictMode with one in-flight request', async () => {
    vi.spyOn(reviewerAuthApi, 'getCurrentReviewer').mockResolvedValue({ ok: false, data: null });
    let resolveReviewPage!: (
      result: Awaited<ReturnType<typeof reviewerAuthApi.getReviewPage>>,
    ) => void;
    const reviewPagePromise = new Promise<
      Awaited<ReturnType<typeof reviewerAuthApi.getReviewPage>>
    >((resolve) => {
      resolveReviewPage = resolve;
    });
    const getReviewPage = vi.mocked(reviewerAuthApi.getReviewPage);
    getReviewPage.mockReset();
    getReviewPage.mockReturnValue(reviewPagePromise);

    render(
      <React.StrictMode>
        <MemoryRouter initialEntries={['/maps/place/PetHouse/']}>
          <PetHouseReviewPage />
        </MemoryRouter>
      </React.StrictMode>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Loading reviews');
    expect(getReviewPage).toHaveBeenCalledTimes(1);

    resolveReviewPage({ ok: true, data: reviewPage });

    expect(await screen.findByText('Great care')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  });

  it('shares a review as a deep link back to that review', async () => {
    vi.spyOn(reviewerAuthApi, 'getCurrentReviewer').mockResolvedValue({ ok: false, data: null });
    const user = userEvent.setup();
    renderPage();

    const card = await screen.findByTestId('review-card-review-1');
    await user.click(within(card).getByRole('button', { name: "Share Maya Chen's review" }));

    const shareDialog = screen.getByRole('dialog', { name: 'Share' });
    expect(within(shareDialog).getByRole('textbox', { name: 'Link to share' })).toHaveValue(
      'http://localhost:3000/?review=review-1',
    );
  });

  it('scrolls to and highlights the review a shared link points at', async () => {
    vi.spyOn(reviewerAuthApi, 'getCurrentReviewer').mockResolvedValue({ ok: false, data: null });
    const scrollIntoView = stubScrollIntoView();
    render(
      <MemoryRouter initialEntries={['/maps/place/PetHouse/?review=review-1']}>
        <PetHouseReviewPage />
      </MemoryRouter>,
    );

    const card = await screen.findByTestId('review-card-review-1');
    expect(card).toHaveAttribute('id', 'review-review-1');
    expect(card).toHaveClass('maps-review-card--highlighted');
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center' }));
  });

  it('leaves every card unhighlighted when no review was shared', async () => {
    vi.spyOn(reviewerAuthApi, 'getCurrentReviewer').mockResolvedValue({ ok: false, data: null });
    renderPage();

    const card = await screen.findByTestId('review-card-review-1');
    expect(card).not.toHaveClass('maps-review-card--highlighted');
  });

  it('shares an anonymous review without naming a reviewer', async () => {
    vi.spyOn(reviewerAuthApi, 'getCurrentReviewer').mockResolvedValue({ ok: false, data: null });
    vi.spyOn(reviewerAuthApi, 'getReviewPage').mockResolvedValue({
      ok: true,
      data: anonymousReviewPage,
    });
    const user = userEvent.setup();
    renderPage();

    const card = await screen.findByTestId('review-card-review-1');
    await user.click(
      within(card).getByRole('button', { name: "Share Anonymous reviewer's review" }),
    );

    const shareDialog = screen.getByRole('dialog', { name: 'Share' });
    expect(within(shareDialog).getByRole('link', { name: 'Share on X' })).toHaveAttribute(
      'href',
      expect.stringContaining(encodeURIComponent('A review of PetHouse')),
    );
  });

  it('renders persisted review and owner response timestamps in Auckland time', async () => {
    vi.spyOn(reviewerAuthApi, 'getCurrentReviewer').mockResolvedValue({ ok: false, data: null });
    vi.spyOn(reviewerAuthApi, 'getReviewPage').mockResolvedValue({
      ok: true,
      data: timestampedReviewPage,
    });
    renderPage();

    const card = await screen.findByTestId('review-card-review-1');
    expect(within(card).getByText('1 Sept 2026, 8:25:12 pm')).toBeInTheDocument();
    expect(within(card).getByText('1 Sept 2026, 8:45:12 pm')).toBeInTheDocument();
    expect(within(card).queryByText('Just now')).not.toBeInTheDocument();
  });

  it('refreshes through Public SSE while preserving current reviews during the request', async () => {
    vi.spyOn(reviewerAuthApi, 'getCurrentReviewer').mockResolvedValue({ ok: false, data: null });
    const initialReviewPage = {
      ...reviewPage,
      reviews: [{ ...reviewPage.reviews[0], ownerReply: null, ownerReplyUpdatedAt: null }],
    };
    const updatedReviewPage = {
      ...initialReviewPage,
      reviews: [
        {
          ...initialReviewPage.reviews[0],
          ownerReply: 'Thank you for sharing this.',
          ownerReplyUpdatedAt: '2026-09-02T01:00:00.000Z',
        },
      ],
    };
    let resolveRefresh!: (
      result: Awaited<ReturnType<typeof reviewerAuthApi.getReviewPage>>,
    ) => void;
    const refreshPromise = new Promise<Awaited<ReturnType<typeof reviewerAuthApi.getReviewPage>>>(
      (resolve) => {
        resolveRefresh = resolve;
      },
    );
    const getReviewPage = vi.mocked(reviewerAuthApi.getReviewPage);
    getReviewPage.mockReset();
    getReviewPage
      .mockResolvedValueOnce({ ok: true, data: initialReviewPage })
      .mockReturnValueOnce(refreshPromise);
    renderPage();

    const card = await screen.findByTestId('review-card-review-1');
    expect(within(card).queryByText('Response from the owner')).not.toBeInTheDocument();
    FakeEventSource.instances[0]?.emitUpdate({
      type: 'google-reviews-updated',
      placeSlug: 'PetHouse',
      changeType: 'replied',
    });

    await waitFor(() => expect(getReviewPage).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId('review-card-review-1')).toBeInTheDocument();
    expect(screen.getByText('Great care')).toBeInTheDocument();

    resolveRefresh({ ok: true, data: updatedReviewPage });
    expect(await screen.findByText('Thank you for sharing this.')).toBeInTheDocument();
    expect(getReviewPage).toHaveBeenCalledTimes(2);
  });

  it('opens search and filters review content without using reviewer names', async () => {
    const user = userEvent.setup();
    vi.spyOn(reviewerAuthApi, 'getCurrentReviewer').mockResolvedValue({ ok: false, data: null });
    vi.spyOn(reviewerAuthApi, 'getReviewPage').mockResolvedValue({
      ok: true,
      data: searchAndSortReviewPage,
    });
    renderPage();

    expect(await screen.findByTestId('review-card-service-review')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Search reviews' }));

    const searchInput = screen.getByRole('textbox', { name: 'Search reviews' });
    expect(searchInput).toHaveFocus();
    await user.type(searchInput, 'PetHouse');

    expect(screen.getByTestId('review-card-service-review')).toBeInTheDocument();
    expect(screen.queryByTestId('review-card-name-only-review')).not.toBeInTheDocument();
    expect(screen.queryByTestId('review-card-food-review')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByTestId('review-card-service-review')).toBeInTheDocument();
    expect(screen.getByTestId('review-card-name-only-review')).toBeInTheDocument();
    expect(screen.getByTestId('review-card-food-review')).toBeInTheDocument();
  });

  it('shows the four sort options and applies each review order', async () => {
    const user = userEvent.setup();
    vi.spyOn(reviewerAuthApi, 'getCurrentReviewer').mockResolvedValue({ ok: false, data: null });
    vi.spyOn(reviewerAuthApi, 'getReviewPage').mockResolvedValue({
      ok: true,
      data: searchAndSortReviewPage,
    });
    renderPage();

    await screen.findByTestId('review-card-service-review');
    const getReviewOrder = (): Array<string | null> =>
      screen
        .getAllByRole('article')
        .map((card) => within(card).getByRole('heading', { level: 3 }).textContent);

    expect(screen.queryByText('keyboard_arrow_down')).not.toBeInTheDocument();
    expect(getReviewOrder()).toEqual(['PetHouse reviewer', 'Food reviewer', 'PetHouse name only']);
    await user.click(screen.getByRole('button', { name: 'Sort reviews' }));

    const sortMenu = screen.getByRole('menu', { name: 'Review sort options' });
    expect(within(sortMenu).getAllByRole('menuitemradio')).toHaveLength(4);

    await user.click(within(sortMenu).getByRole('menuitemradio', { name: 'Newest' }));
    expect(getReviewOrder()).toEqual(['PetHouse name only', 'Food reviewer', 'PetHouse reviewer']);

    await user.click(screen.getByRole('button', { name: 'Sort reviews' }));
    await user.click(
      within(screen.getByRole('menu', { name: 'Review sort options' })).getByRole('menuitemradio', {
        name: 'Highest rating',
      }),
    );
    expect(getReviewOrder()).toEqual(['PetHouse name only', 'PetHouse reviewer', 'Food reviewer']);

    await user.click(screen.getByRole('button', { name: 'Sort reviews' }));
    await user.click(
      within(screen.getByRole('menu', { name: 'Review sort options' })).getByRole('menuitemradio', {
        name: 'Lowest rating',
      }),
    );
    expect(getReviewOrder()).toEqual(['Food reviewer', 'PetHouse reviewer', 'PetHouse name only']);

    await user.click(screen.getByRole('button', { name: 'Sort reviews' }));
    await user.click(
      within(screen.getByRole('menu', { name: 'Review sort options' })).getByRole('menuitemradio', {
        name: 'Most relevant',
      }),
    );
    expect(getReviewOrder()).toEqual(['PetHouse reviewer', 'Food reviewer', 'PetHouse name only']);
  });

  it('closes expanded review controls with Escape and restores Search focus', async () => {
    const user = userEvent.setup();
    vi.spyOn(reviewerAuthApi, 'getCurrentReviewer').mockResolvedValue({ ok: false, data: null });
    renderPage();

    await screen.findByTestId('review-card-review-1');
    const searchButton = screen.getByRole('button', { name: 'Search reviews' });
    await user.click(searchButton);
    expect(screen.getByRole('textbox', { name: 'Search reviews' })).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('textbox', { name: 'Search reviews' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Search reviews' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Sort reviews' }));
    expect(screen.getByRole('menu', { name: 'Review sort options' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu', { name: 'Review sort options' })).not.toBeInTheDocument();
  });

  it('renders an empty review list safely', async () => {
    vi.spyOn(reviewerAuthApi, 'getCurrentReviewer').mockResolvedValue({ ok: false, data: null });
    vi.spyOn(reviewerAuthApi, 'getReviewPage').mockResolvedValue({
      ok: true,
      data: { ...reviewPage, reviews: [] },
    });
    renderPage();
    expect(await screen.findByText('No reviews yet.')).toBeInTheDocument();
    expect(screen.queryAllByRole('article')).toHaveLength(0);
  });

  it('refreshes from server after a successful submit', async () => {
    const user = userEvent.setup();
    vi.spyOn(reviewerAuthApi, 'getCurrentReviewer').mockResolvedValue({ ok: true, data: reviewer });
    const submitReview = vi
      .spyOn(reviewerAuthApi, 'submitReview')
      .mockResolvedValue({ ok: true, data: { review: {} } });
    const getReviewPage = vi.mocked(reviewerAuthApi.getReviewPage);
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Write a review' }));
    const dialog = await screen.findByRole('dialog', { name: 'Write a review' });
    await user.click(
      within(dialog)
        .getByRole('group', { name: 'Rate your experience' })
        .querySelectorAll('svg')[4],
    );
    const photo = new File(['image-content'], 'review.jpg', { type: 'image/jpeg' });
    await user.upload(within(dialog).getByLabelText('Choose images to upload'), photo);
    await user.click(within(dialog).getByRole('button', { name: 'Post' }));
    await waitFor(() =>
      expect(submitReview).toHaveBeenCalledWith(
        {
          placeSlug: 'PetHouse',
          rating: 5,
          reviewText: undefined,
        },
        [photo],
      ),
    );
    expect(getReviewPage).toHaveBeenCalledTimes(1);
    FakeEventSource.instances[0]?.emitUpdate({
      type: 'google-reviews-updated',
      placeSlug: 'PetHouse',
      changeType: 'created',
    });
    await waitFor(() => expect(getReviewPage).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('dialog', { name: 'Write a review' })).not.toBeInTheDocument();
  });

  it('keeps the modal open when submit fails', async () => {
    const user = userEvent.setup();
    vi.spyOn(reviewerAuthApi, 'getCurrentReviewer').mockResolvedValue({ ok: true, data: reviewer });
    vi.spyOn(reviewerAuthApi, 'submitReview').mockResolvedValue({
      ok: false,
      data: null,
      message: 'Could not post review',
    });
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Write a review' }));
    const dialog = await screen.findByRole('dialog', { name: 'Write a review' });
    await user.click(
      within(dialog)
        .getByRole('group', { name: 'Rate your experience' })
        .querySelectorAll('svg')[4],
    );
    await user.click(within(dialog).getByRole('button', { name: 'Post' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Could not post review');
    expect(screen.getByRole('dialog', { name: 'Write a review' })).toBeInTheDocument();
  });

  it('opens the review menu, confirms deletion, and refreshes from the server', async () => {
    const user = userEvent.setup();
    vi.spyOn(reviewerAuthApi, 'getCurrentReviewer').mockResolvedValue({ ok: false, data: null });
    const deleteReview = vi.spyOn(reviewerAuthApi, 'deleteReview').mockResolvedValue({
      ok: true,
      data: null,
    });
    const getReviewPage = vi.mocked(reviewerAuthApi.getReviewPage);
    getReviewPage.mockReset();
    getReviewPage.mockResolvedValueOnce({ ok: true, data: reviewPage }).mockResolvedValueOnce({
      ok: true,
      data: { ...reviewPage, reviews: [] },
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();

    const card = await screen.findByTestId('review-card-review-1');
    await user.click(
      within(card).getByRole('button', { name: "More options for Maya Chen's review" }),
    );
    expect(within(card).getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
    await user.click(within(card).getByRole('menuitem', { name: 'Delete' }));

    await waitFor(() => expect(deleteReview).toHaveBeenCalledWith('review-1'));
    expect(getReviewPage).toHaveBeenCalledTimes(1);
    FakeEventSource.instances[0]?.emitUpdate({
      type: 'google-reviews-updated',
      placeSlug: 'PetHouse',
      changeType: 'deleted',
    });
    await waitFor(() => expect(getReviewPage).toHaveBeenCalledTimes(2));
    expect(screen.queryByTestId('review-card-review-1')).not.toBeInTheDocument();
    expect(screen.getByText('No reviews yet.')).toBeInTheDocument();
  });

  it('keeps the menu and card when deletion is canceled or fails', async () => {
    const user = userEvent.setup();
    vi.spyOn(reviewerAuthApi, 'getCurrentReviewer').mockResolvedValue({ ok: false, data: null });
    const deleteReview = vi.spyOn(reviewerAuthApi, 'deleteReview').mockResolvedValue({
      ok: false,
      data: null,
      message: 'Mock review only',
    });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderPage();

    const card = await screen.findByTestId('review-card-review-1');
    const moreButton = within(card).getByRole('button', {
      name: "More options for Maya Chen's review",
    });
    await user.click(moreButton);
    await user.click(within(card).getByRole('menuitem', { name: 'Delete' }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(deleteReview).not.toHaveBeenCalled();
    expect(within(card).getByRole('menu')).toBeInTheDocument();

    confirm.mockReturnValue(true);
    await user.click(within(card).getByRole('menuitem', { name: 'Delete' }));
    expect(await within(card).findByRole('alert')).toHaveTextContent('Mock review only');
    expect(within(card).getByRole('menu')).toBeInTheDocument();
  });

  it('closes the review menu with Escape and an outside click', async () => {
    const user = userEvent.setup();
    vi.spyOn(reviewerAuthApi, 'getCurrentReviewer').mockResolvedValue({ ok: false, data: null });
    renderPage();

    const card = await screen.findByTestId('review-card-review-1');
    const moreButton = within(card).getByRole('button', {
      name: "More options for Maya Chen's review",
    });
    await user.click(moreButton);
    await user.keyboard('{Escape}');
    expect(within(card).queryByRole('menu')).not.toBeInTheDocument();

    await user.click(moreButton);
    await user.click(document.body);
    expect(within(card).queryByRole('menu')).not.toBeInTheDocument();
  });
});
