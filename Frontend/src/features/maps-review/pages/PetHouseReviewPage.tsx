import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { subscribeToGoogleReviewServerEvents } from '../../../shared/events/googleReviewServerEvents';
import { reviewerAuthApi, type ReviewerProfile } from '../api/reviewerAuthApi';
import { RatingSummary } from '../components/RatingSummary';
import { ReviewCard } from '../components/ReviewCard';
import { ReviewControls } from '../components/ReviewControls';
import { ReviewIcon } from '../components/ReviewIcon';
import { ReviewPageHeader } from '../components/ReviewPageHeader';
import { MapsReviewGoogleAuthProvider } from '../components/MapsReviewGoogleAuth';
import { useMapsReviewGoogleAuth } from '../components/mapsReviewGoogleAuthContext';
import { ShareDialog } from '../components/ShareDialog';
import { WriteReviewModal } from '../components/WriteReviewModal';
import { useReviewerAuth } from '../hooks/useReviewerAuth';
import { useReviewLikes } from '../hooks/useReviewLikes';
import { selectReviewList, type ReviewSortOption } from '../selectors/reviewSelectors';
import type {
  PetHouseReview,
  PublicGoogleBusinessReview,
  ReviewPageData,
  ShareTarget,
} from '../types/reviewTypes';
import { toBackendAssetUrl } from '../utils/reviewMedia';
import { buildReviewShareUrl, REVIEW_SHARE_PARAM, reviewAnchorId } from '../utils/shareLinks';
import '../styles/maps-review.css';

const REVIEW_PLACE_SLUG = 'PetHouse';
const PET_HOUSE_SERVICE_LABEL = 'Pet Boarding & Daycare';
const PET_HOUSE_LOGO_SRC = '/maps-review/pethouse-mark.png';
const REVIEW_TIME_ZONE = 'Pacific/Auckland';
const reviewDateTimeFormatter = new Intl.DateTimeFormat('en-NZ', {
  timeZone: REVIEW_TIME_ZONE,
  dateStyle: 'medium',
  timeStyle: 'medium',
});

const formatReviewDateTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return 'Date unavailable';
  }

  return reviewDateTimeFormatter.format(date);
};

const toDisplayedReview = (review: PublicGoogleBusinessReview): PetHouseReview => {
  const isAnonymous = review.reviewerIsAnonymous === true;
  const reviewerName = isAnonymous ? 'Anonymous reviewer' : review.reviewerName;
  return {
    id: review.id,
    reviewerName,
    reviewerMeta: 'Google review',
    rating: review.rating,
    ageLabel: formatReviewDateTime(review.createdAt),
    text: review.reviewText ?? '',
    likeCount: review.likeCount,
    viewerHasLiked: review.viewerHasLiked,
    isAnonymousReviewer: isAnonymous,
    photoUrls: review.photoUrls.map(toBackendAssetUrl),
    avatarSrc: isAnonymous ? undefined : (review.reviewerAvatarUrl ?? undefined),
    initials: isAnonymous ? undefined : reviewerName.trim().charAt(0).toUpperCase(),
    ownerResponse:
      review.ownerReply === null
        ? undefined
        : {
            ageLabel: formatReviewDateTime(review.ownerReplyUpdatedAt ?? review.updatedAt),
            text: review.ownerReply,
          },
  };
};

/**
 * The public mock Google Review page for PetHouse.
 *
 * @remarks
 * This surface operates entirely outside the employee portal. It loads the review page projection,
 * supports the public reviewer login flow, manages the write-review modal, and automatically
 * refreshes via server-sent events when the public review stream updates.
 */
export const PetHouseReviewPage: React.FC = () => {
  const [isWriteReviewOpen, setIsWriteReviewOpen] = useState(false);
  const openReview = useCallback((): void => setIsWriteReviewOpen(true), []);
  const closeReview = useCallback((): void => setIsWriteReviewOpen(false), []);

  return (
    <MapsReviewGoogleAuthProvider onLoginSuccess={openReview}>
      <PetHouseReviewContent
        isWriteReviewOpen={isWriteReviewOpen}
        onOpenReview={openReview}
        onCloseReview={closeReview}
      />
    </MapsReviewGoogleAuthProvider>
  );
};

interface PetHouseReviewContentProps {
  isWriteReviewOpen: boolean;
  onOpenReview: () => void;
  onCloseReview: () => void;
}

const PetHouseReviewContent: React.FC<PetHouseReviewContentProps> = ({
  isWriteReviewOpen,
  onOpenReview,
  onCloseReview,
}) => {
  const { reviewer, isHydrating, hydrate, logout } = useReviewerAuth();
  const { requestLogin, loginError, clearLoginError } = useMapsReviewGoogleAuth();
  const [reviewPage, setReviewPage] = useState<ReviewPageData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<ReviewSortOption>('relevance');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null);
  const closeShare = useCallback((): void => setShareTarget(null), []);
  const [searchParams] = useSearchParams();
  const sharedReviewId = searchParams.get(REVIEW_SHARE_PARAM);

  const reviewPageRequestRef = React.useRef<Promise<void> | null>(null);
  const isMountedRef = React.useRef(true);

  const loadReviewPage = useCallback(async (isBackgroundRefresh = false): Promise<void> => {
    if (reviewPageRequestRef.current) {
      return reviewPageRequestRef.current;
    }

    const request = reviewerAuthApi
      .getReviewPage(REVIEW_PLACE_SLUG)
      .then((result) => {
        if (!isMountedRef.current) {
          return;
        }

        if (!result.ok || !result.data) {
          setLoadError(result.message ?? 'Reviews could not be loaded. Please try again.');
          return;
        }

        setReviewPage(result.data);
        setLoadError(null);
      })
      .catch(() => {
        if (isMountedRef.current) {
          setLoadError('Reviews could not be loaded. Please try again.');
        }
      })
      .finally(() => {
        if (isMountedRef.current && !isBackgroundRefresh) {
          setIsLoading(false);
        }
        reviewPageRequestRef.current = null;
      });

    reviewPageRequestRef.current = request;
    return request;
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    void loadReviewPage();
    return (): void => {
      isMountedRef.current = false;
    };
  }, [loadReviewPage]);

  useEffect(() => {
    return subscribeToGoogleReviewServerEvents('public', REVIEW_PLACE_SLUG, () => {
      void loadReviewPage(true);
    });
  }, [loadReviewPage]);

  // A reviewer loaded from the session cookie is not known on the first render, so an action
  // taken during hydration must wait for it before deciding the visitor is signed out.
  const resolveReviewer = useCallback(async (): Promise<ReviewerProfile | null> => {
    return isHydrating ? await hydrate() : reviewer;
  }, [hydrate, isHydrating, reviewer]);

  const applyReviews = useCallback(
    (updater: (reviews: PublicGoogleBusinessReview[]) => PublicGoogleBusinessReview[]): void => {
      setReviewPage((page) => (page ? { ...page, reviews: updater(page.reviews) } : page));
    },
    [],
  );

  // viewerHasLiked is resolved from the session on the server, so it goes stale the moment the
  // signed-in reviewer changes. Clear it and reload, otherwise a visitor who signs out keeps
  // being shown as the liker, and the next reviewer to sign in inherits that state and would
  // toggle it off on their first tap. likeCount is left alone: other people's likes still stand.
  const settledReviewerIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (isHydrating) {
      return;
    }

    const reviewerId = reviewer?.id ?? null;
    const previousReviewerId = settledReviewerIdRef.current;
    settledReviewerIdRef.current = reviewerId;
    // undefined means the session has only just settled for the first time; the initial page
    // request already carried the session cookie, so there is nothing stale to replace yet.
    if (previousReviewerId === undefined || previousReviewerId === reviewerId) {
      return;
    }

    applyReviews((reviews) => reviews.map((review) => ({ ...review, viewerHasLiked: false })));
    void loadReviewPage(true);
  }, [applyReviews, isHydrating, loadReviewPage, reviewer?.id]);

  const { toggleLike, likeError } = useReviewLikes({
    resolveReviewer,
    revalidateReviewer: hydrate,
    onLoginRequired: requestLogin,
    applyReviews,
  });

  const openWriteReview = async (): Promise<void> => {
    const currentReviewer = await resolveReviewer();
    if (currentReviewer) {
      clearLoginError();
      onOpenReview();
      return;
    }
    requestLogin();
  };

  const deleteReview = useCallback(async (reviewId: string): Promise<void> => {
    const result = await reviewerAuthApi.deleteReview(reviewId);
    if (!result.ok) {
      throw new Error(result.message ?? 'Review could not be deleted. Please try again.');
    }
  }, []);

  const location = reviewPage?.location;
  const placeName = location?.displayName ?? 'PetHouse';
  const filteredReviews = useMemo(
    () =>
      selectReviewList(reviewPage?.reviews ?? [], {
        searchQuery,
        sortOption,
      }),
    [reviewPage?.reviews, searchQuery, sortOption],
  );
  const displayedReviews = filteredReviews.map(toDisplayedReview);
  const isModalOpen = isWriteReviewOpen && Boolean(reviewer);

  // A shared link names one review, so bring it into view once it has rendered. The guard keeps
  // a background SSE refresh from yanking the page back while the visitor is reading elsewhere.
  const scrolledSharedReviewIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!sharedReviewId || scrolledSharedReviewIdRef.current === sharedReviewId) {
      return;
    }

    const sharedCard = document.getElementById(reviewAnchorId(sharedReviewId));
    if (!sharedCard) {
      return;
    }

    scrolledSharedReviewIdRef.current = sharedReviewId;
    sharedCard.scrollIntoView({ block: 'center' });
  }, [filteredReviews, sharedReviewId]);

  return (
    <div className="maps-review-page" data-testid="maps-review-page">
      <ReviewPageHeader reviewer={reviewer} onSignOut={logout} />
      <main>
        <section className="maps-review-place-summary" aria-labelledby="place-title">
          <div className="maps-review-place-heading">
            <button
              type="button"
              className="maps-review-back-button"
              aria-label="Back to search results"
              aria-disabled="true"
            >
              <ReviewIcon name="arrow_back" />
            </button>
            <img className="maps-review-place-logo" src={PET_HOUSE_LOGO_SRC} alt="" />
            <div className="maps-review-place-copy">
              <div className="maps-review-place-title-row">
                <h1 id="place-title">{placeName}</h1>
                <ReviewIcon name="verified" className="maps-review-verified" />
              </div>
              <p>
                {PET_HOUSE_SERVICE_LABEL}
                <span aria-hidden="true"> • </span>
                {location?.formattedAddress ?? 'Auckland, NZ'}
              </p>
            </div>
          </div>
          {isLoading ? (
            <p role="status">Loading reviews…</p>
          ) : loadError ? (
            <p className="maps-review-auth-inline-error" role="alert">
              {loadError}
            </p>
          ) : location ? (
            <RatingSummary
              averageRating={location.averageRating}
              totalReviews={location.totalReviews}
              ratingBreakdown={location.ratingBreakdown}
            />
          ) : null}
          <button
            type="button"
            className="maps-review-write-button"
            aria-controls="write-review-modal"
            aria-expanded={isModalOpen}
            onClick={() => void openWriteReview()}
          >
            <ReviewIcon name="edit_square" />
            <span>Write a review</span>
          </button>
          {loginError && (
            <p className="maps-review-auth-inline-error" role="alert">
              {loginError}
            </p>
          )}
        </section>
        <div className="maps-review-content">
          <ReviewControls
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            sortOption={sortOption}
            onSortChange={setSortOption}
          />
          <section className="maps-review-list" aria-labelledby="reviews-title">
            <h2 id="reviews-title" className="maps-review-sr-only">
              Customer reviews
            </h2>
            {likeError && (
              <p className="maps-review-auth-inline-error" role="alert">
                {likeError}
              </p>
            )}
            {!isLoading && !loadError && displayedReviews.length === 0 && (
              <p>{searchQuery.trim() ? 'No reviews match your search.' : 'No reviews yet.'}</p>
            )}
            {displayedReviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                onDelete={() => deleteReview(review.id)}
                onToggleLike={() => void toggleLike(review.id, review.viewerHasLiked)}
                isHighlighted={review.id === sharedReviewId}
                onShare={() =>
                  setShareTarget({
                    url: buildReviewShareUrl(review.id),
                    title: review.isAnonymousReviewer
                      ? `A review of ${placeName}`
                      : `${review.reviewerName}'s review of ${placeName}`,
                  })
                }
              />
            ))}
          </section>
        </div>
      </main>
      <WriteReviewModal
        isOpen={isModalOpen}
        onClose={onCloseReview}
        businessName={placeName}
        reviewer={reviewer}
      />
      <ShareDialog target={shareTarget} onClose={closeShare} />
    </div>
  );
};
