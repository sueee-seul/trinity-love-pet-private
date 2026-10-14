import { act, render, screen, waitFor, within } from '@testing-library/react';
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
  avatarUrl: null,
};

// Four existing likes, none of them this viewer's, so the count is distinguishable from the
// empty state and from the count after a successful like.
const reviewPage = {
  location: {
    id: 'location-1',
    displayName: 'PetHouse',
    formattedAddress: 'Auckland, NZ',
    googleMapsUri: null,
    averageRating: 5,
    totalReviews: 1,
    ratingBreakdown: [{ stars: 5 as const, count: 1 }],
  },
  reviews: [
    {
      id: 'review-1',
      reviewerName: 'Maya Chen',
      reviewerAvatarUrl: null,
      reviewerIsAnonymous: false,
      rating: 5 as const,
      reviewText: 'Great care',
      photoUrls: [],
      createdAt: '2026-09-05T21:25:12.000Z',
      updatedAt: '2026-09-05T21:25:12.000Z',
      ownerReply: null,
      ownerReplyUpdatedAt: null,
      likeCount: 4,
      viewerHasLiked: false,
    },
  ],
};

const renderPage = (): void => {
  render(
    <MemoryRouter initialEntries={['/maps/place/PetHouse/']}>
      <PetHouseReviewPage />
    </MemoryRouter>,
  );
};

describe('PetHouseReviewPage review likes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    FakeEventSource.reset();
    vi.stubGlobal('EventSource', FakeEventSource as unknown as typeof EventSource);
    // logout() also clears isHydrating, but a real page load starts with hydration pending.
    // Matching that matters here: the page treats the first settled identity as the one the
    // initial request already used, and only reloads on a later change.
    useReviewerAuthStore.setState({ reviewer: null, isAuthenticated: false, isHydrating: true });
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
  });

  it('shows the like total while signed out and sends a signed-out tap to sign in', async () => {
    const user = userEvent.setup();
    vi.spyOn(reviewerAuthApi, 'getCurrentReviewer').mockResolvedValue({ ok: false, data: null });
    const setReviewLike = vi.spyOn(reviewerAuthApi, 'setReviewLike');
    renderPage();

    const card = await screen.findByTestId('review-card-review-1');
    const likeButton = within(card).getByRole('button', { name: "Like Maya Chen's review" });
    expect(likeButton).toHaveTextContent('4');

    await user.click(likeButton);

    await waitFor(() => expect(googleLoginMock).toHaveBeenCalled());
    expect(setReviewLike).not.toHaveBeenCalled();
    expect(likeButton).toHaveTextContent('4');
  });

  it('records a signed-in like once and clears it on the second tap', async () => {
    const user = userEvent.setup();
    vi.spyOn(reviewerAuthApi, 'getCurrentReviewer').mockResolvedValue({ ok: true, data: reviewer });
    const setReviewLike = vi
      .spyOn(reviewerAuthApi, 'setReviewLike')
      .mockResolvedValueOnce({
        ok: true,
        data: { reviewId: 'review-1', likeCount: 5, viewerHasLiked: true },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: { reviewId: 'review-1', likeCount: 4, viewerHasLiked: false },
      });
    renderPage();

    const card = await screen.findByTestId('review-card-review-1');
    await user.click(within(card).getByRole('button', { name: "Like Maya Chen's review" }));

    const likedButton = await within(card).findByRole('button', {
      name: "Unlike Maya Chen's review",
    });
    expect(likedButton).toHaveTextContent('5');
    expect(likedButton).toHaveAttribute('aria-pressed', 'true');
    expect(setReviewLike).toHaveBeenCalledWith('review-1', true);

    await user.click(likedButton);

    const unlikedButton = await within(card).findByRole('button', {
      name: "Like Maya Chen's review",
    });
    expect(unlikedButton).toHaveTextContent('4');
    expect(setReviewLike).toHaveBeenLastCalledWith('review-1', false);
  });

  it('ignores a second tap while the first like request is still in flight', async () => {
    const user = userEvent.setup();
    vi.spyOn(reviewerAuthApi, 'getCurrentReviewer').mockResolvedValue({ ok: true, data: reviewer });
    let resolveLike!: (result: Awaited<ReturnType<typeof reviewerAuthApi.setReviewLike>>) => void;
    const setReviewLike = vi.spyOn(reviewerAuthApi, 'setReviewLike').mockReturnValue(
      new Promise((resolve) => {
        resolveLike = resolve;
      }),
    );
    renderPage();

    const card = await screen.findByTestId('review-card-review-1');
    await user.click(within(card).getByRole('button', { name: "Like Maya Chen's review" }));
    const likedButton = await within(card).findByRole('button', {
      name: "Unlike Maya Chen's review",
    });
    await user.click(likedButton);

    expect(setReviewLike).toHaveBeenCalledTimes(1);

    resolveLike({ ok: true, data: { reviewId: 'review-1', likeCount: 5, viewerHasLiked: true } });
    await waitFor(() => expect(likedButton).toHaveTextContent('5'));
  });

  // Regression: viewerHasLiked is per session, so it must not survive a change of reviewer.
  // Before this was fixed, signing out left the button lit and the next reviewer to sign in
  // inherited it, so their first tap removed someone else's like instead of adding their own.
  it('drops the previous reviewer like state when the viewer signs out', async () => {
    const user = userEvent.setup();
    vi.spyOn(reviewerAuthApi, 'getCurrentReviewer').mockResolvedValue({ ok: true, data: reviewer });
    vi.spyOn(reviewerAuthApi, 'logout').mockResolvedValue({ ok: true, data: null });
    const likedByViewer = {
      ...reviewPage,
      reviews: [{ ...reviewPage.reviews[0], likeCount: 5, viewerHasLiked: true }],
    };
    const signedOutView = {
      ...reviewPage,
      reviews: [{ ...reviewPage.reviews[0], likeCount: 5, viewerHasLiked: false }],
    };
    const getReviewPage = vi.mocked(reviewerAuthApi.getReviewPage);
    getReviewPage.mockReset();
    getReviewPage
      .mockResolvedValueOnce({ ok: true, data: likedByViewer })
      .mockResolvedValue({ ok: true, data: signedOutView });
    renderPage();

    const card = await screen.findByTestId('review-card-review-1');
    expect(
      await within(card).findByRole('button', { name: "Unlike Maya Chen's review" }),
    ).toHaveTextContent('5');

    await user.click(screen.getByRole('button', { name: 'Open account menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }));

    // The other five likes stay; only this viewer's own marker goes.
    const afterSignOut = await within(card).findByRole('button', {
      name: "Like Maya Chen's review",
    });
    expect(afterSignOut).toHaveTextContent('5');
    expect(afterSignOut).toHaveAttribute('aria-pressed', 'false');
    await waitFor(() => expect(getReviewPage).toHaveBeenCalledTimes(2));
  });

  it('reloads like state when a different reviewer signs in', async () => {
    vi.spyOn(reviewerAuthApi, 'getCurrentReviewer').mockResolvedValue({ ok: true, data: reviewer });
    const likedByFirst = {
      ...reviewPage,
      reviews: [{ ...reviewPage.reviews[0], likeCount: 5, viewerHasLiked: true }],
    };
    const secondReviewerView = {
      ...reviewPage,
      reviews: [{ ...reviewPage.reviews[0], likeCount: 5, viewerHasLiked: false }],
    };
    const getReviewPage = vi.mocked(reviewerAuthApi.getReviewPage);
    getReviewPage.mockReset();
    getReviewPage
      .mockResolvedValueOnce({ ok: true, data: likedByFirst })
      .mockResolvedValue({ ok: true, data: secondReviewerView });
    renderPage();

    const card = await screen.findByTestId('review-card-review-1');
    await within(card).findByRole('button', { name: "Unlike Maya Chen's review" });

    // A Google sign-in happens in a popup, so the page is never reloaded; only the store changes.
    act(() => {
      useReviewerAuthStore
        .getState()
        .login({ id: 'reviewer-2', displayName: 'Sam Rivera', avatarUrl: null });
    });

    const forSecondReviewer = await within(card).findByRole('button', {
      name: "Like Maya Chen's review",
    });
    expect(forSecondReviewer).toHaveTextContent('5');
    await waitFor(() => expect(getReviewPage).toHaveBeenCalledTimes(2));
  });

  it('restores the previous like total when the like cannot be saved', async () => {
    const user = userEvent.setup();
    vi.spyOn(reviewerAuthApi, 'getCurrentReviewer').mockResolvedValue({ ok: true, data: reviewer });
    vi.spyOn(reviewerAuthApi, 'setReviewLike').mockResolvedValue({
      ok: false,
      data: null,
      message: 'Like service unavailable',
    });
    renderPage();

    const card = await screen.findByTestId('review-card-review-1');
    await user.click(within(card).getByRole('button', { name: "Like Maya Chen's review" }));

    expect(await screen.findByText('Like service unavailable')).toBeInTheDocument();
    const likeButton = within(card).getByRole('button', { name: "Like Maya Chen's review" });
    expect(likeButton).toHaveTextContent('4');
    expect(likeButton).toHaveAttribute('aria-pressed', 'false');
  });

  it('sends an expired session to sign in instead of reporting a save error', async () => {
    const user = userEvent.setup();
    // Signed in on load, signed out by the time the like request is answered.
    vi.spyOn(reviewerAuthApi, 'getCurrentReviewer')
      .mockResolvedValueOnce({ ok: true, data: reviewer })
      .mockResolvedValue({ ok: false, data: null });
    vi.spyOn(reviewerAuthApi, 'setReviewLike').mockResolvedValue({
      ok: false,
      data: null,
      message: 'Reviewer authentication required',
    });
    renderPage();

    const card = await screen.findByTestId('review-card-review-1');
    await user.click(within(card).getByRole('button', { name: "Like Maya Chen's review" }));

    await waitFor(() => expect(googleLoginMock).toHaveBeenCalled());
    expect(screen.queryByText('Reviewer authentication required')).not.toBeInTheDocument();
    expect(within(card).getByRole('button', { name: "Like Maya Chen's review" })).toHaveTextContent(
      '4',
    );
  });
});
