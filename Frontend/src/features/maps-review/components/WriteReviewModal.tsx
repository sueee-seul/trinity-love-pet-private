import React, { useCallback, useEffect, useState } from 'react';
import { StarRating } from '../../../shared/components/ui/StarRating';
import { TextArea } from '../../../shared/components/ui/TextArea';
import { reviewerAuthApi, type ReviewerProfile } from '../api/reviewerAuthApi';
import type { RatingStarCount } from '../types/reviewTypes';
import { ReviewIcon } from './ReviewIcon';
import { ReviewPhotoPicker } from './ReviewPhotoPicker';
import { ReviewerAvatar } from './ReviewerAvatar';

interface WriteReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessName: string;
  reviewer: ReviewerProfile | null;
  placeSlug?: string;
}

export const WriteReviewModal: React.FC<WriteReviewModalProps> = ({
  isOpen,
  onClose,
  businessName,
  reviewer,
  placeSlug = 'PetHouse',
}) => {
  const [selectedRating, setSelectedRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [postError, setPostError] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);

  const handleClose = useCallback((): void => {
    setSelectedRating(0);
    setReviewText('');
    setSelectedPhotos([]);
    setPostError(null);
    onClose();
  }, [onClose]);

  const handlePost = async (): Promise<void> => {
    if (selectedRating === 0) {
      setPostError('Please select a rating before posting.');
      return;
    }

    if (!reviewer) {
      setPostError('Reviewer authentication required.');
      return;
    }

    setIsPosting(true);
    setPostError(null);
    try {
      const result = await reviewerAuthApi.submitReview(
        {
          placeSlug,
          rating: selectedRating as RatingStarCount,
          reviewText: reviewText.trim() || undefined,
        },
        selectedPhotos,
      );
      if (!result.ok) {
        setPostError(result.message ?? 'Review could not be posted. Please try again.');
        return;
      }
      handleClose();
    } catch {
      setPostError('Review could not be posted. Please try again.');
    } finally {
      setIsPosting(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return (): void => document.removeEventListener('keydown', handleKeyDown);
  }, [handleClose, isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="maps-review-modal-backdrop"
      data-testid="write-review-modal-backdrop"
      onClick={handleClose}
    >
      <div
        id="write-review-modal"
        className="maps-review-write-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="write-review-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="maps-review-modal-close"
          aria-label="Close review modal"
          onClick={handleClose}
        >
          <ReviewIcon name="close" />
        </button>

        <header className="maps-review-modal-header">
          <h2 id="write-review-modal-title">Write a review</h2>
          <p>{businessName}</p>
        </header>

        <section className="maps-review-modal-reviewer" aria-label="Reviewer identity">
          {reviewer && (
            <ReviewerAvatar
              reviewer={reviewer}
              className="maps-review-modal-avatar"
              imageClassName="maps-review-modal-avatar__image"
              testId="write-review-reviewer-avatar"
            />
          )}
          <div>
            <strong>{reviewer?.displayName}</strong>
            <p>
              Posting with your Google account
              <ReviewIcon name="info" />
            </p>
          </div>
        </section>

        <StarRating
          value={selectedRating}
          onChange={setSelectedRating}
          sizeClassName="h-10 w-10"
          className="maps-review-modal-rating"
          starClassName="maps-review-modal-star"
          ariaLabel="Rate your experience"
        />

        <TextArea
          className="maps-review-modal-textarea"
          aria-label="Review details"
          value={reviewText}
          onValueChange={setReviewText}
          placeholder="Share details of your experience at this place"
        />

        <ReviewPhotoPicker onFilesChange={setSelectedPhotos} />

        {postError && (
          <p className="maps-review-modal-error" role="alert">
            {postError}
          </p>
        )}

        <footer className="maps-review-modal-footer">
          <button type="button" className="maps-review-modal-cancel" onClick={handleClose}>
            Cancel
          </button>
          <button
            type="button"
            className="maps-review-modal-post"
            onClick={() => void handlePost()}
            disabled={selectedRating === 0 || isPosting}
          >
            Post
          </button>
        </footer>
      </div>
    </div>
  );
};
