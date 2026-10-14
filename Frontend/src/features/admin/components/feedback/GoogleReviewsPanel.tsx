import React, { useMemo, useState } from 'react';
import { googleReviewsApi } from '../../api/googleReviewsApi';
import { useGoogleReviews, useGoogleReviewStore } from '../../store/googleReviewStore';
import { FeedbackLoadingSkeleton } from './FeedbackLoadingSkeleton';
import { FeedbackTable } from './FeedbackTable';
import { GoogleReviewCard } from './GoogleReviewCard';
import { GoogleReviewPhotoViewer } from './GoogleReviewPhotoViewer';
import { GoogleReviewQuickReply } from './GoogleReviewQuickReply';
import { GoogleReviewTypeEditor } from './GoogleReviewTypeEditor';
import {
  formatFeedbackCalendarDate,
  formatFeedbackRelativeTime,
  toFeedbackCalendarDayTimestamp,
} from '../../utils/feedbackTime';
import {
  getGoogleReviewDisplayName,
  getGoogleReviewInitial,
} from '../../utils/googleReviewPresentation';
import {
  isFeedbackProgressStep,
  type FeedbackListItem,
  type FeedbackStatusFilter,
  type FeedbackTypeFilter,
  type FeedbackSortOption,
  type FeedbackTimeFilter,
  type FeedbackViewMode,
  type GoogleReviewAgeFilter,
} from '../../types/feedback';
import type { AdminGoogleReview, GoogleReviewTriageType } from '../../types/googleReview';

interface GoogleReviewsPanelProps {
  /** Parent-owned navigation callback for the app-owned review detail route. */
  onViewDetails: (reviewId: string) => void;
  /** Selects the Google-specific card or shared-table presentation. */
  viewMode?: FeedbackViewMode;
  /** Manager UI gate for triage editing; the server remains the authorization authority. */
  canEditGoogleReviewType?: boolean;
  searchQuery?: string;
  /** Maps to unreplied/replied locally for this Google Review projection. */
  statusFilter?: FeedbackStatusFilter;
  typeFilter?: FeedbackTypeFilter;
  sortOption?: FeedbackSortOption;
  /** Shared range state; this panel currently applies only a complete custom range. */
  timeRange?: FeedbackTimeFilter;
  ratingMin?: number;
  ratingMax?: number;
  dateFrom?: string;
  dateTo?: string;
  /** Google-only local urgency band for unreplied reviews. */
  ageFilter?: GoogleReviewAgeFilter;
}

/**
 * Renders the employee-facing Google Review list from the shared Google Review store.
 *
 * @remarks
 * The store owns the API-backed page, lifecycle status, and error state. Search, type, reply
 * status, urgency, rating, complete custom-date, and sort values are applied in memory here; the
 * panel does not turn filter changes into API requests. The shared `timeRange` prop currently
 * affects this projection only for `custom` when both dates are present. Card mode renders the
 * Google card directly; table mode adapts each review to `FeedbackTable` and reattaches Google
 * content, type-edit, and reply callbacks. Successful mutations replace the API-returned
 * review in the store, while child controls own their local error messages.
 */
export const GoogleReviewsPanel: React.FC<GoogleReviewsPanelProps> = ({
  onViewDetails,
  viewMode = 'card',
  canEditGoogleReviewType = false,
  searchQuery = '',
  statusFilter = 'all',
  typeFilter = 'All',
  sortOption = 'newest',
  timeRange = 'all',
  ratingMin = 1,
  ratingMax = 5,
  dateFrom = '',
  dateTo = '',
  ageFilter = 'all',
}) => {
  const { reviewPage, status, error } = useGoogleReviews();
  const replaceReviewInStore = useGoogleReviewStore((state) => state.replaceReview);
  // Hold one reference time for the mounted panel so urgency bands do not move while a user is
  // reviewing or changing filters.
  const [ageReferenceTime] = useState(() => Date.now());

  // Keep Google mutation ownership in the panel so the server's returned projection replaces the
  // matching row instead of applying an optimistic, locally invented update.
  const handleUpdateReviewType = async (
    reviewId: string,
    triageType: GoogleReviewTriageType,
  ): Promise<void> => {
    const updatedReview = await googleReviewsApi.updateReviewType(reviewId, triageType);
    replaceReviewInStore(updatedReview);
  };

  const handleQuickReply = async (reviewId: string, replyBody: string): Promise<void> => {
    const updatedReview = await googleReviewsApi.replyToGoogleReview(reviewId, replyBody);
    replaceReviewInStore(updatedReview);
  };
  // The store provides the server snapshot; this memo is a display projection and never changes
  // the request or the stored review data.
  const reviews = useMemo(() => {
    const rawReviews = reviewPage?.reviews ?? [];
    let filtered = rawReviews;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (review) =>
          review.reviewerName.toLowerCase().includes(q) ||
          (review.reviewText && review.reviewText.toLowerCase().includes(q)),
      );
    }

    if (typeFilter !== 'All') {
      filtered = filtered.filter(
        (review) => review.triageType?.toLowerCase() === typeFilter.toLowerCase(),
      );
    }

    if (statusFilter === 'unread') {
      filtered = filtered.filter((review) => !review.ownerReply);
    } else if (statusFilter === 'read') {
      filtered = filtered.filter((review) => !!review.ownerReply);
    }

    if (ageFilter !== 'all') {
      filtered = filtered.filter((review) => {
        if (review.ownerReply) {
          return false;
        }

        const ageHours =
          Math.max(0, ageReferenceTime - Date.parse(review.createdAt)) / (60 * 60 * 1000);
        return ageFilter === 'overdue' ? ageHours >= 24 : ageHours >= 12 && ageHours < 24;
      });
    }

    filtered = filtered.filter(
      (review) => review.rating >= ratingMin && review.rating <= ratingMax,
    );

    if (timeRange === 'custom' && dateFrom && dateTo) {
      const fromTime = toFeedbackCalendarDayTimestamp(dateFrom);
      const toTime = toFeedbackCalendarDayTimestamp(dateTo) + 24 * 60 * 60 * 1000 - 1;

      filtered = filtered.filter((review) => {
        const reviewTime = new Date(review.createdAt).getTime();
        return reviewTime >= fromTime && reviewTime <= toTime;
      });
    }

    filtered = [...filtered].sort((a, b) => {
      switch (sortOption) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'highest':
          return b.rating - a.rating;
        case 'lowest':
          return a.rating - b.rating;
        default:
          return 0;
      }
    });

    return filtered;
  }, [
    reviewPage,
    searchQuery,
    statusFilter,
    typeFilter,
    sortOption,
    timeRange,
    ratingMin,
    ratingMax,
    dateFrom,
    dateTo,
    ageFilter,
    ageReferenceTime,
  ]);

  // FeedbackTable owns a shared Internal Feedback row shape, so Google fields are adapted here
  // and supplied back through its Google-specific render callbacks.
  const tableFeedbacks = reviews.map(mapGoogleReviewToFeedback);
  const reviewsById = useMemo(
    () => new Map(reviews.map((review) => [review.id, review] as const)),
    [reviews],
  );

  if (status === 'idle' || status === 'loading') {
    return (
      <div className="py-2">
        <FeedbackLoadingSkeleton viewMode="card" />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <p role="alert" className="type-body py-20 text-center text-status-danger">
        {error ?? 'Reviews could not be loaded. Please try again.'}
      </p>
    );
  }

  if (reviews.length === 0) {
    return (
      <p className="type-body py-20 text-center text-notice-muted">
        No Google reviews match your criteria.
      </p>
    );
  }

  if (viewMode === 'table') {
    return (
      <>
        <FeedbackTable
          feedbacks={tableFeedbacks}
          onViewDetails={onViewDetails}
          source="google-reviews"
          renderReviewerMeta={(feedback) => {
            const review = reviewsById.get(feedback.uuid);
            return review ? (
              <GoogleReviewPhotoViewer
                reviewId={review.id}
                reviewerName={review.reviewerName}
                photoUrls={review.photoUrls}
              />
            ) : null;
          }}
          renderContent={(feedback) => {
            const review = reviewsById.get(feedback.uuid);
            return (
              <div
                className="max-h-24 overflow-y-auto whitespace-pre-wrap break-words pr-2"
                tabIndex={0}
                aria-label={`Review content from ${review?.reviewerName ?? feedback.parentName}`}
              >
                {review?.reviewText ?? 'No written review provided.'}
              </div>
            );
          }}
          renderType={(feedback) => {
            const review = reviewsById.get(feedback.uuid);
            return (
              <GoogleReviewTypeEditor
                reviewId={feedback.uuid}
                triageType={review?.triageType ?? null}
                canEdit={canEditGoogleReviewType}
                onChange={handleUpdateReviewType}
              />
            );
          }}
          renderAction={(feedback) => {
            const review = reviewsById.get(feedback.uuid);
            if (!review || review.ownerReply) {
              return null;
            }

            return (
              <GoogleReviewQuickReply
                reviewId={feedback.uuid}
                reviewerName={review.reviewerName}
                onReply={handleQuickReply}
              />
            );
          }}
        />
      </>
    );
  }

  return (
    <div className="space-y-6" data-testid="google-reviews-list">
      {reviews.map((review) => (
        <GoogleReviewCard
          key={review.id}
          review={review}
          onViewDetails={() => onViewDetails(review.id)}
          onReply={handleQuickReply}
        />
      ))}
    </div>
  );
};

// FeedbackTable's shared row shape requires a category, but Google rows always supply renderType
// above. The fallback below is an adapter value only; it is never rendered as Google output.
const mapGoogleReviewType = (review: AdminGoogleReview): FeedbackListItem['category'] => {
  switch (review.triageType) {
    case 'issue':
      return 'Issue';
    case 'suggestion':
      return 'Suggestion';
    case 'praise':
    default:
      return 'Praise';
  }
};

// This is table-only display data, not a second Google Review record or an API payload.
const mapGoogleReviewToFeedback = (review: AdminGoogleReview): FeedbackListItem => {
  const displayName = getGoogleReviewDisplayName(review);
  const timestamp = Date.parse(review.createdAt);

  return {
    uuid: review.id,
    initials: getGoogleReviewInitial(displayName),
    parentName: displayName,
    petName: '',
    date: formatFeedbackCalendarDate(timestamp),
    timestamp,
    serviceType: '',
    rating: review.rating,
    aiSummary: '',
    category: mapGoogleReviewType(review),
    is_read: review.isRead,
    assigneeId: review.assignedEmployeeUuid,
    current_status: isFeedbackProgressStep(review.currentStatus)
      ? review.currentStatus
      : 'submitted',
    ownerReply: review.ownerReply,
    relativeTime: formatFeedbackRelativeTime(timestamp),
  };
};
