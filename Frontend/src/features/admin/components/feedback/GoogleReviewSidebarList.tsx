import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { AdminGoogleReview } from '../../types/googleReview';
import {
  formatGoogleReviewDate,
  getGoogleReviewDisplayName,
  getGoogleReviewInitial,
  getGoogleReviewTriageDisplay,
} from '../../utils/googleReviewPresentation';

interface GoogleReviewSidebarListProps {
  /** Reviews from the already-hydrated employee Google Review page snapshot. */
  reviews: AdminGoogleReview[];
  /** Id used only to style the review currently shown beside the list. */
  activeReviewId?: string;
}

/**
 * Renders the recent-review list used beside the employee Google Review detail.
 *
 * @remarks
 * This component owns navigation to `/admin/google-reviews/:id` and does not fetch or filter the
 * supplied snapshot. The visible search input is currently disabled and has no search behavior;
 * the active id only controls presentation state.
 */
export const GoogleReviewSidebarList: React.FC<GoogleReviewSidebarListProps> = ({
  reviews,
  activeReviewId,
}) => {
  const navigate = useNavigate();

  return (
    <aside
      aria-label="Recent Google Reviews"
      className="flex h-[calc(100vh-64px)] w-80 shrink-0 flex-col border-r border-border-soft bg-surface-cream"
    >
      <div className="border-b border-border-soft p-4">
        <h2 className="mb-3 type-card-title">Recent Google Reviews</h2>
        <input
          type="text"
          placeholder="Search reviews..."
          aria-label="Search sidebar Google reviews"
          // This control is presentational until sidebar search state and filtering are implemented.
          disabled
          className="w-full rounded-lg border border-field-border bg-surface-card px-3 py-2 type-body text-notice-secondary disabled:cursor-not-allowed disabled:opacity-70"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {reviews.length === 0 ? (
          <p className="type-meta p-4 text-center text-notice-muted">No Google reviews yet.</p>
        ) : (
          reviews.map((review) => {
            const reviewerName = getGoogleReviewDisplayName(review);
            const formattedDate = formatGoogleReviewDate(review.createdAt);
            const avatarUrl = review.reviewerIsAnonymous === true ? null : review.reviewerAvatarUrl;

            return (
              <button
                key={review.id}
                type="button"
                onClick={() => navigate(`/admin/google-reviews/${review.id}`)}
                className={`block w-full border-b p-4 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-focus ${
                  review.id === activeReviewId
                    ? 'bg-surface-card ring-2 ring-inset ring-focus'
                    : 'border-border-soft bg-transparent hover:bg-surface-card/70'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-foreground text-surface-card type-meta font-bold">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      getGoogleReviewInitial(reviewerName)
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate type-card-title">{reviewerName}</span>
                      <time
                        dateTime={formattedDate.dateTime}
                        className="shrink-0 type-meta text-notice-secondary"
                      >
                        {formattedDate.label.split(' • ')[0]}
                      </time>
                    </div>
                    <span className="type-meta text-notice-secondary">Google review</span>
                  </div>
                </div>

                {review.triageType && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="inline-flex rounded-md border border-control-border bg-surface-card px-2 py-1 type-meta text-notice-secondary">
                      {getGoogleReviewTriageDisplay(review.triageType)}
                    </span>
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
};
