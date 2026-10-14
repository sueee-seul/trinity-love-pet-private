import React, { useEffect, useRef, useState } from 'react';
import type { PetHouseReview } from '../types/reviewTypes';
import { reviewAnchorId } from '../utils/shareLinks';
import { RatingStars } from './RatingStars';
import { ReviewIcon } from './ReviewIcon';

interface ReviewCardProps {
  review: PetHouseReview;
  onDelete: () => Promise<void>;
  /** Requests a like toggle. Signing in and saving are owned by the caller, not this card. */
  onToggleLike: () => void;
  /** Requests the share dialog. Building the link and opening the dialog belong to the caller. */
  onShare: () => void;
  /** True when the visitor arrived on a shared link pointing at this review. */
  isHighlighted?: boolean;
}

export const ReviewCard: React.FC<ReviewCardProps> = ({
  review,
  onDelete,
  onToggleLike,
  onShare,
  isHighlighted = false,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;

    const handleOutsideClick = (event: MouseEvent): void => {
      const target = event.target;
      if (menuRef.current && target instanceof Node && !menuRef.current.contains(target)) {
        setIsMenuOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return (): void => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isMenuOpen]);

  const handleDelete = async (): Promise<void> => {
    if (isDeleting || !window.confirm('Delete this review? This cannot be undone.')) return;

    setDeleteError(null);
    setIsDeleting(true);
    try {
      await onDelete();
      setIsMenuOpen(false);
    } catch (error: unknown) {
      setDeleteError(error instanceof Error ? error.message : 'Review could not be deleted.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <article
      // A shared link addresses this element, so the id is part of the deep link contract.
      id={reviewAnchorId(review.id)}
      className={`maps-review-card ${review.ownerResponse ? 'maps-review-card--with-response' : 'maps-review-card--compact'}${isHighlighted ? ' maps-review-card--highlighted' : ''}`}
      data-testid={`review-card-${review.id}`}
    >
      <div className="maps-review-card__reviewer">
        <div className="maps-review-avatar">
          {review.avatarSrc ? (
            <img src={review.avatarSrc} alt={`${review.reviewerName}'s avatar`} />
          ) : (
            <span aria-hidden="true">{review.initials}</span>
          )}
        </div>
        <div>
          <h3>{review.reviewerName}</h3>
          <p>{review.reviewerMeta}</p>
        </div>
      </div>

      <div className="maps-review-card__content">
        <div className="maps-review-card__meta">
          <RatingStars value={review.rating} />
          <time>{review.ageLabel}</time>
          <div ref={menuRef} className="maps-review-review-menu">
            <button
              ref={menuButtonRef}
              type="button"
              className="maps-review-more"
              aria-label={`More options for ${review.reviewerName}'s review`}
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
              aria-controls={`review-menu-${review.id}`}
              onClick={() => {
                setDeleteError(null);
                setIsMenuOpen((open) => !open);
              }}
            >
              <ReviewIcon name="more_vert" />
            </button>
            {isMenuOpen && (
              <div
                id={`review-menu-${review.id}`}
                role="menu"
                aria-label={`Review options for ${review.reviewerName}`}
                className="maps-review-review-menu__popover"
              >
                <button
                  type="button"
                  role="menuitem"
                  className="maps-review-review-menu__item"
                  onClick={() => void handleDelete()}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            )}
          </div>
        </div>

        {deleteError && (
          <p className="maps-review-delete-error" role="alert">
            {deleteError}
          </p>
        )}

        {review.text && (
          <p
            className={`maps-review-card__text ${review.isTruncated ? 'maps-review-card__text--truncated' : ''}`}
          >
            {review.text}
          </p>
        )}

        {review.photoUrls.length > 0 && (
          <div className="maps-review-card__photos" role="list" aria-label="Review photos">
            {review.photoUrls.map((photoUrl, index) => (
              <img
                key={photoUrl}
                className="maps-review-card__photo"
                src={photoUrl}
                alt={`${review.reviewerName}'s review photo ${index + 1}`}
                loading="lazy"
                decoding="async"
              />
            ))}
          </div>
        )}

        {review.isTruncated && (
          <button
            type="button"
            className="maps-review-show-more"
            aria-label={`Show more of ${review.reviewerName}'s review`}
            aria-disabled="true"
          >
            Show more
          </button>
        )}

        <div className="maps-review-card__actions">
          <button
            type="button"
            className={`maps-review-like${review.viewerHasLiked ? ' maps-review-like--active' : ''}`}
            aria-label={`${review.viewerHasLiked ? 'Unlike' : 'Like'} ${review.reviewerName}'s review`}
            aria-pressed={review.viewerHasLiked}
            onClick={onToggleLike}
          >
            <ReviewIcon name={review.viewerHasLiked ? 'thumb_up' : 'thumb_up_off_alt'} />
            <span>{review.likeCount > 0 ? review.likeCount : 'Like'}</span>
          </button>

          <button
            type="button"
            className="maps-review-share-action"
            aria-label={`Share ${review.reviewerName}'s review`}
            aria-haspopup="dialog"
            onClick={onShare}
          >
            <ReviewIcon name="share" />
            <span>Share</span>
          </button>
        </div>

        {review.ownerResponse && (
          <div className="maps-review-response">
            <div className="maps-review-response__heading">
              <strong>Response from the owner</strong>
              <time>{review.ownerResponse.ageLabel}</time>
            </div>
            <p>{review.ownerResponse.text}</p>
          </div>
        )}
      </div>
    </article>
  );
};
