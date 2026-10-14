import React, { useState } from 'react';

interface StarRatingProps {
  rating?: number; // Read-only mode
  value?: number; // Interactive mode
  onChange?: (value: number) => void;
  sizeClassName?: string;
  className?: string;
  starClassName?: string;
  ariaLabel?: string;
}

export const StarRating: React.FC<StarRatingProps> = ({
  rating,
  value,
  onChange,
  sizeClassName = 'w-4 h-4',
  className = '',
  starClassName = '',
  ariaLabel,
}) => {
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const currentRating = rating ?? value ?? 0;
  const displayedRating = hoverRating ?? currentRating;

  const stars = Array.from({ length: 5 }, (_, index) => index + 1).map((star) => {
    const isFilled = star <= Math.round(displayedRating);
    return (
      <svg
        key={star}
        onClick={() => onChange?.(star)}
        onMouseEnter={() => onChange && setHoverRating(star)}
        className={`${sizeClassName} ${isFilled ? 'text-rating-filled' : 'text-rating-empty'} ${onChange ? 'cursor-pointer hover:scale-110 transition-transform' : ''} ${starClassName}`}
        fill={isFilled ? 'currentColor' : 'none'}
        stroke={isFilled ? 'none' : 'currentColor'}
        strokeWidth={isFilled ? undefined : 1.5}
        strokeLinejoin="round"
        viewBox="0 0 20 20"
      >
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    );
  });

  return (
    <div
      className={`flex gap-1 ${className}`}
      role={ariaLabel ? 'group' : undefined}
      aria-label={ariaLabel}
      onMouseLeave={() => onChange && setHoverRating(null)}
    >
      {stars}
    </div>
  );
};
