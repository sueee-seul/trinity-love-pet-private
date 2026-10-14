import React from 'react';
import type { GoogleReviewDashboardRating } from '../../../types/googleReviewDashboard';

interface AverageRatingCardProps {
  rating: GoogleReviewDashboardRating;
}

export const AverageRatingCard: React.FC<AverageRatingCardProps> = ({ rating }) => (
  <section
    aria-labelledby="average-google-review-rating-heading"
    className="rounded-2xl border border-border-soft bg-surface-card p-5 shadow-card sm:p-6"
    data-testid="average-google-review-rating-section"
  >
    <h2 id="average-google-review-rating-heading" className="mb-5 type-eyebrow text-theme-earth">
      AVERAGE RATING
    </h2>
    <div className="rounded-2xl border border-border-soft bg-surface-cream/60 p-5 text-center">
      <p className="type-display type-numeral text-display text-notice-primary">
        {rating.average === null ? 'No rating yet' : rating.average.toFixed(1)}
      </p>
      <p className="mt-1 type-button text-notice-primary">Average rating</p>
      <p className="mt-2 type-meta text-notice-muted">
        Based on {rating.reviewCount} {rating.reviewCount === 1 ? 'review' : 'reviews'}
      </p>
    </div>
  </section>
);
