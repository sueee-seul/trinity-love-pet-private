import React, { useState } from 'react';
import type { ReviewerProfile } from '../api/reviewerAuthApi';

interface ReviewerAvatarProps {
  reviewer: ReviewerProfile;
  className: string;
  imageClassName?: string;
  testId?: string;
}

const getReviewerInitial = (displayName: string): string => {
  return displayName.trim().charAt(0).toUpperCase();
};

export const ReviewerAvatar: React.FC<ReviewerAvatarProps> = ({
  reviewer,
  className,
  imageClassName,
  testId,
}) => {
  const [failedAvatarKey, setFailedAvatarKey] = useState<string | null>(null);
  const avatarKey = `${reviewer.id}:${reviewer.avatarUrl ?? ''}`;
  const hasImageError = failedAvatarKey === avatarKey;

  return (
    <div className={className} data-testid={testId} aria-label={`${reviewer.displayName}'s avatar`}>
      {reviewer.avatarUrl && !hasImageError ? (
        <img
          className={imageClassName}
          src={reviewer.avatarUrl}
          alt={`${reviewer.displayName}'s avatar`}
          onError={() => setFailedAvatarKey(avatarKey)}
        />
      ) : (
        getReviewerInitial(reviewer.displayName)
      )}
    </div>
  );
};
