import React from 'react';
import type { AdminGoogleReview } from '../../types/googleReview';
import { StarRating } from '../../../../shared/components/ui/StarRating';
import { GoogleReviewPhotoViewer } from './GoogleReviewPhotoViewer';
import { GoogleReviewQuickReply } from './GoogleReviewQuickReply';
import {
  formatGoogleReviewDate,
  getGoogleReviewDisplayName,
  getGoogleReviewInitial,
  getGoogleReviewTriageDisplay,
} from '../../utils/googleReviewPresentation';

interface GoogleReviewCardProps {
  /** Employee-facing Google Review projection supplied by the parent panel. */
  review: AdminGoogleReview;
  /** Parent-owned action, normally used to navigate to the review detail route. */
  onViewDetails: () => void;
  /** Parent-owned reply mutation shared with the Table Reply action. */
  onReply: (reviewId: string, replyBody: string) => Promise<void>;
}

/**
 * Renders a compact employee-facing Google Review card.
 *
 * @remarks
 * The card displays the reviewer, rating, date, and manually assigned review type, plus
 * conditional photo/reply actions. The article uses button semantics, so click, Enter, and Space
 * all invoke the parent-owned detail callback; the independent photo and reply controls stop that
 * navigation and own their respective overlay interactions.
 */
export const GoogleReviewCard: React.FC<GoogleReviewCardProps> = ({
  review,
  onViewDetails,
  onReply,
}) => {
  const reviewerName = getGoogleReviewDisplayName(review);
  const formattedDate = formatGoogleReviewDate(review.createdAt);
  const avatarUrl = review.reviewerIsAnonymous === true ? null : review.reviewerAvatarUrl;

  return (
    <article
      className="relative mb-6 overflow-hidden rounded-xl border border-border-soft bg-surface-card shadow-sm transition-all hover:shadow-md cursor-pointer focus:outline-none focus:ring-2 focus:ring-focus"
      data-testid={`google-review-card-${review.id}`}
      onClick={onViewDetails}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) {
          return;
        }

        // The clickable element is an article rather than a native button, so keyboard activation
        // must mirror its click behavior for Enter and Space.
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onViewDetails();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-deep text-accent-foreground type-numeral type-card-title">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={`${reviewerName}'s avatar`}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              ) : (
                getGoogleReviewInitial(reviewerName)
              )}
            </div>
            <div>
              <h3 className="type-card-title">{reviewerName}</h3>
              <p className="type-meta mt-1 text-notice-secondary">
                <time dateTime={formattedDate.dateTime}>{formattedDate.label}</time>
                {review.photoUrls.length > 0 && (
                  <>
                    <span className="mx-1">•</span>
                    <GoogleReviewPhotoViewer
                      reviewId={review.id}
                      reviewerName={reviewerName}
                      photoUrls={review.photoUrls}
                    />
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <StarRating
              rating={review.rating}
              sizeClassName="h-5 w-5"
              ariaLabel={`Rating: ${review.rating} out of 5 stars`}
            />
            <span className="ml-1 type-numeral text-notice-secondary">
              {review.rating.toFixed(1)}
            </span>
          </div>
        </div>

        {review.reviewText?.trim() && (
          <p className="ml-16 mb-5 whitespace-pre-wrap break-words type-body text-notice-primary">
            {review.reviewText}
          </p>
        )}

        {review.triageType && (
          <div className="ml-16 mb-5 flex items-center gap-2">
            <span className="rounded-md border border-control-border bg-surface-cream px-2 py-1 type-meta text-notice-secondary">
              {getGoogleReviewTriageDisplay(review.triageType)}
            </span>
          </div>
        )}

        <div className="ml-16 flex flex-wrap justify-end gap-2">
          {review.ownerReply && (
            <span
              role="status"
              className="inline-flex items-center rounded-full bg-status-success/10 px-2.5 py-1 type-meta text-status-success"
            >
              Replied
            </span>
          )}
          {!review.ownerReply && (
            <GoogleReviewQuickReply
              reviewId={review.id}
              reviewerName={reviewerName}
              onReply={onReply}
            />
          )}
          <span className="flex items-center gap-1.5 rounded-md border border-control-border bg-surface-cream px-3 py-1.5 type-button text-notice-secondary pointer-events-none">
            View Details
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </div>
    </article>
  );
};
