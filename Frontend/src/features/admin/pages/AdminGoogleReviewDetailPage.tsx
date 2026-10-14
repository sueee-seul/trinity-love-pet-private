import React, { useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LoadingState } from '../../../shared/components/ui/LoadingState';
import { googleReviewsApi } from '../api/googleReviewsApi';
import { GoogleReviewDetailContent } from '../components/feedback/detail/GoogleReviewDetailContent';
import { GoogleReviewSidebarList } from '../components/feedback/GoogleReviewSidebarList';
import { selectGoogleReviewById } from '../selectors/googleReviewSelectors';
import { useGoogleReviewStore, useGoogleReviews } from '../store/googleReviewStore';

const GOOGLE_REVIEWS_CARD_LIST_PATH = '/admin/feedback?source=google-reviews&view=card';

/**
 * Renders one employee-facing Google Review detail from the shared review-page snapshot.
 *
 * @remarks
 * A direct detail URL uses `useGoogleReviews` to hydrate the shared page; an already-ready
 * snapshot avoids a second list request. A ready snapshot without the requested id returns to
 * the Google card list. Manual replies replace returned reviews in the shared store.
 */
export const AdminGoogleReviewDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { reviewPage, status, error } = useGoogleReviews();
  const replaceReviewInStore = useGoogleReviewStore((state) => state.replaceReview);
  const review = selectGoogleReviewById(reviewPage, id);
  const reviewId = review?.id;

  // The detail callback shares the API boundary with the list, but the list panel (not this page)
  // owns replacing a successful mutation in its local store projection.
  const handleSendReply = useCallback(
    async (replyBody: string): Promise<void> => {
      if (!reviewId) {
        return;
      }

      const updatedReview = await googleReviewsApi.replyToGoogleReview(reviewId, replyBody);
      replaceReviewInStore(updatedReview);
    },
    [replaceReviewInStore, reviewId],
  );

  useEffect(() => {
    if (status === 'ready' && !review) {
      // An unknown or stale id returns to the Google card context instead of rendering an empty
      // detail shell.
      navigate(GOOGLE_REVIEWS_CARD_LIST_PATH, { replace: true });
    }
  }, [navigate, review, status]);

  if (status === 'idle' || status === 'loading') {
    return <LoadingState label="Loading Google review…" variant="page" className="h-screen" />;
  }

  if (status === 'error') {
    return (
      <div
        role="alert"
        className="type-body flex h-screen items-center justify-center text-status-danger"
      >
        {error ?? 'Unable to load Google review.'}
      </div>
    );
  }

  if (!review) {
    return null;
  }

  return (
    <div className="relative -m-4 flex h-[calc(100vh-64px)] overflow-hidden animate-in fade-in duration-300 sm:-m-6 lg:-m-8">
      <GoogleReviewSidebarList reviews={reviewPage?.reviews ?? []} activeReviewId={id} />
      <GoogleReviewDetailContent
        review={review}
        onBackToCards={() => navigate(GOOGLE_REVIEWS_CARD_LIST_PATH)}
        onSendReply={review.reviewerEmail ? handleSendReply : undefined}
      />
    </div>
  );
};
