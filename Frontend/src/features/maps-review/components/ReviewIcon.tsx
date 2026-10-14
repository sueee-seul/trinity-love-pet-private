import React from 'react';

interface ReviewIconProps {
  name: string;
  className?: string;
}

export const ReviewIcon: React.FC<ReviewIconProps> = ({ name, className = '' }) => {
  return (
    <span aria-hidden="true" className={`maps-review-icon ${className}`}>
      {name}
    </span>
  );
};
