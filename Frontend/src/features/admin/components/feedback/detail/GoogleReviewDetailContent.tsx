import React, { useState } from 'react';
import type { AdminGoogleReview } from '../../../types/googleReview';
import { StarRating } from '../../../../../shared/components/ui/StarRating';
import { DraftResponseEditor } from './DraftResponseEditor';
import {
  formatGoogleReviewDate,
  getGoogleReviewDisplayName,
  getGoogleReviewInitial,
} from '../../../utils/googleReviewPresentation';
import { toBackendAssetUrl } from '../../../../maps-review/utils/reviewMedia';

interface GoogleReviewDetailContentProps {
  /** Full employee Google Review projection selected by the detail page. */
  review: AdminGoogleReview;
  /** Parent-owned navigation back to the Google card list context. */
  onBackToCards: () => void;
  /** Optional parent-owned employee reply mutation; absent disables sending in the shared editor. */
  onSendReply?: (emailBody: string) => Promise<void>;
}

/**
 * Renders the full employee-facing Google Review detail and reply surface.
 *
 * @remarks
 * Original review text and photos are rendered from the selected API-backed projection. Reply
 * submission is delegated through the shared `DraftResponseEditor` only when the caller supplies
 * `onSendReply`; this component reports success after that promise resolves and maps rejected
 * sends to its local alert message. It does not own the Google Review list store.
 */
export const GoogleReviewDetailContent: React.FC<GoogleReviewDetailContentProps> = ({
  review,
  onBackToCards,
  onSendReply,
}) => {
  const [replyMessage, setReplyMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const reviewerName = getGoogleReviewDisplayName(review);
  const formattedDate = formatGoogleReviewDate(review.createdAt);
  const avatarUrl = review.reviewerIsAnonymous === true ? null : review.reviewerAvatarUrl;
  const hasSentReply = Boolean(review.ownerReply);
  const responseMessage = review.ownerReply ?? '';
  const responseRevision = review.ownerReplyUpdatedAt ?? 'empty';

  const handleSendReply = async (emailBody: string): Promise<void> => {
    if (!onSendReply) {
      return;
    }

    setReplyMessage(null);
    await onSendReply(emailBody);
    setReplyMessage({ type: 'success', text: 'Reply sent successfully.' });
  };

  const handleReplyError = (): void => {
    setReplyMessage({ type: 'error', text: 'Failed to send reply. Please try again.' });
  };

  // The shared editor is reused for the employee Google Review reply, with voice input disabled
  // for this surface.
  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-1 flex-col overflow-y-auto bg-surface-card">
      <div className="mx-auto w-full max-w-4xl p-8">
        <button
          type="button"
          onClick={onBackToCards}
          className="mb-6 flex items-center gap-2 type-button text-accent-foreground transition-colors hover:text-accent-foreground-hover"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Google Reviews
        </button>

        <article className="rounded-xl border border-border-soft bg-surface-card shadow-sm">
          <div className="p-8">
            <div className="mb-8 flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-deep text-accent-foreground type-numeral type-card-title">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={`${reviewerName}'s avatar`}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    getGoogleReviewInitial(reviewerName)
                  )}
                </div>
                <div>
                  <h1 className="type-display type-card-title">{reviewerName}</h1>
                  <p className="type-meta mt-1 text-notice-secondary">
                    <time dateTime={formattedDate.dateTime}>{formattedDate.label}</time>
                    <span className="mx-1">•</span>
                    <span>Google review</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <StarRating
                  rating={review.rating}
                  sizeClassName="h-5 w-5"
                  ariaLabel={`Rating: ${review.rating} out of 5 stars`}
                />
                <span className="ml-1 type-numeral text-notice-secondary">
                  {review.rating.toFixed(1)}
                </span>
              </div>
            </div>

            <section aria-labelledby="google-review-original-title">
              <h2 id="google-review-original-title" className="mb-3 type-eyebrow text-notice-muted">
                Original Review
              </h2>
              <div className="rounded-lg border border-border-soft bg-surface-cream p-6">
                <p className="type-body whitespace-pre-wrap leading-relaxed text-notice-secondary">
                  {review.reviewText ?? 'No written review provided.'}
                </p>
              </div>
            </section>

            {review.photoUrls.length > 0 && (
              <section className="mt-8" aria-labelledby="google-review-photos-title">
                <h2 id="google-review-photos-title" className="mb-3 type-eyebrow text-notice-muted">
                  Review Photos
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" role="list">
                  {review.photoUrls.map((photoUrl, index) => (
                    <div key={photoUrl} role="listitem" className="overflow-hidden rounded-lg">
                      <img
                        src={toBackendAssetUrl(photoUrl)}
                        alt={`${reviewerName}'s review photo ${index + 1}`}
                        className="aspect-square w-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </article>

        {replyMessage && (
          <div
            role={replyMessage.type === 'error' ? 'alert' : 'status'}
            className={`mt-4 type-body ${replyMessage.type === 'error' ? 'text-status-danger' : 'text-status-success'}`}
          >
            {replyMessage.text}
          </div>
        )}

        <DraftResponseEditor
          key={`${review.id}:${responseRevision}`}
          defaultEmail={review.reviewerEmail ?? undefined}
          defaultMessage={responseMessage}
          replyStatus={hasSentReply ? 'replied' : 'not_replied'}
          onSend={
            !hasSentReply && review.reviewerEmail && onSendReply ? handleSendReply : undefined
          }
          onSendError={handleReplyError}
          enableVoiceInput={false}
          submitLabel="Reply"
          sendingLabel="Replying..."
        />
      </div>
    </div>
  );
};
