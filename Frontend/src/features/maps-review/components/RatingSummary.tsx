import React from 'react';
import type { RatingBreakdown } from '../types/reviewTypes';
import { RatingStars } from './RatingStars';

interface RatingSummaryProps {
  averageRating: number | null;
  totalReviews: number;
  ratingBreakdown: readonly RatingBreakdown[];
}

export const RatingSummary: React.FC<RatingSummaryProps> = ({
  averageRating,
  totalReviews,
  ratingBreakdown,
}) => {
  const highestCount = Math.max(0, ...ratingBreakdown.map((row) => row.count));

  return (
    <section className="maps-review-rating-summary" aria-labelledby="rating-summary-title">
      <h2 id="rating-summary-title" className="maps-review-sr-only">
        Rating summary
      </h2>

      <div className="maps-review-breakdown" aria-label="Rating distribution">
        {ratingBreakdown.map((row) => (
          <div className="maps-review-breakdown__row" key={row.stars}>
            <span className="maps-review-breakdown__number">{row.stars}</span>
            <span className="maps-review-breakdown__track" aria-hidden="true">
              <span
                className="maps-review-breakdown__fill"
                style={{ width: highestCount ? `${(row.count / highestCount) * 100}%` : '0%' }}
              />
            </span>
            <span className="maps-review-breakdown__count">{row.count}</span>
          </div>
        ))}
      </div>

      <div className="maps-review-overall-rating">
        <span className="maps-review-overall-rating__number">
          {averageRating === null ? 'None' : averageRating.toFixed(1)}
        </span>
        <RatingStars value={averageRating} sizeClassName="maps-review-stars--large" />
        <span className="maps-review-overall-rating__total">{totalReviews} reviews</span>
      </div>
    </section>
  );
};
