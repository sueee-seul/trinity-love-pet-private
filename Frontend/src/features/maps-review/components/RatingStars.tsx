import React from 'react';
import { ReviewIcon } from './ReviewIcon';

interface RatingStarsProps {
  className?: string;
  sizeClassName?: string;
  value?: number | null;
}

export const RatingStars: React.FC<RatingStarsProps> = ({
  className = '',
  sizeClassName = 'maps-review-stars--medium',
  value = null,
}) => {
  const roundedValue = value === null || value === undefined ? 0 : Math.round(value);
  return (
    <span
      className={`maps-review-stars ${className}`}
      aria-label={value === null ? 'No rating' : `${value} out of 5 stars`}
    >
      {Array.from({ length: 5 }, (_, index) => (
        <ReviewIcon
          key={`rating-star-${index + 1}`}
          name="star"
          className={`${index < roundedValue ? 'maps-review-icon--filled' : 'maps-review-icon--empty'} ${sizeClassName}`}
        />
      ))}
    </span>
  );
};
