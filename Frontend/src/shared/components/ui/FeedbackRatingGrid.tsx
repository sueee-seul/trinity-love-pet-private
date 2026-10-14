import React from 'react';
import { StarRating } from './StarRating';
import { type FeedbackRatings, type RatingCategory, RATING_CATEGORIES } from '../../types/feedback';

interface FeedbackRatingGridProps {
  ratings: Partial<FeedbackRatings>;
}

export const FeedbackRatingGrid: React.FC<FeedbackRatingGridProps> = ({ ratings }) => {
  const renderRatingItem = (category: RatingCategory): React.ReactElement | null => {
    const rating = ratings[category];
    if (rating === undefined) return null;
    return (
      <div className="flex flex-col gap-1.5">
        <span className="type-normal capitalize">{category}</span>
        <StarRating rating={rating} />
      </div>
    );
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-y-8 gap-x-4">
      {RATING_CATEGORIES.map((category) => renderRatingItem(category))}
    </div>
  );
};
