import type {
  AdminFeedback,
  FeedbackSortOption,
  FeedbackStatusFilter,
  FeedbackTimeFilter,
  FeedbackTypeFilter,
} from '../types/feedback';
import { formatFeedbackCalendarDate } from '../utils/feedbackTime';

const ONE_DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const ONE_YEAR_IN_MILLISECONDS = 365 * ONE_DAY_IN_MILLISECONDS;

export interface FeedbackListSelectorOptions {
  searchQuery: string;
  statusFilter: FeedbackStatusFilter;
  typeFilter: FeedbackTypeFilter;
  sortOption: FeedbackSortOption;
  timeRange: FeedbackTimeFilter;
  ratingMin: number;
  ratingMax: number;
  dateFrom: string;
  dateTo: string;
}

export interface FeedbackTimeDomain {
  min: string;
  max: string;
}

const getFallbackTimeDomain = (): FeedbackTimeDomain => {
  const today = Date.now();
  return {
    min: formatFeedbackCalendarDate(today - ONE_YEAR_IN_MILLISECONDS),
    max: formatFeedbackCalendarDate(today),
  };
};

const matchesTimeRange = (
  feedback: AdminFeedback,
  timeRange: FeedbackTimeFilter,
  dateFrom: string,
  dateTo: string,
): boolean => {
  if (timeRange === 'all') return true;

  if (timeRange === 'last_7_days' || timeRange === 'last_30_days') {
    const days = timeRange === 'last_7_days' ? 7 : 30;
    return feedback.timestamp >= Date.now() - days * ONE_DAY_IN_MILLISECONDS;
  }

  const feedbackDate = formatFeedbackCalendarDate(feedback.timestamp);
  return feedbackDate >= dateFrom && feedbackDate <= dateTo;
};

const compareFeedbacks = (
  left: AdminFeedback,
  right: AdminFeedback,
  sortOption: FeedbackSortOption,
): number => {
  if (sortOption === 'highest') {
    return (
      right.rating - left.rating ||
      right.timestamp - left.timestamp ||
      right.uuid.localeCompare(left.uuid)
    );
  }

  if (sortOption === 'lowest') {
    return (
      left.rating - right.rating ||
      left.timestamp - right.timestamp ||
      left.uuid.localeCompare(right.uuid)
    );
  }

  if (sortOption === 'oldest') {
    return left.timestamp - right.timestamp || left.uuid.localeCompare(right.uuid);
  }

  return right.timestamp - left.timestamp || right.uuid.localeCompare(left.uuid);
};

export const selectFeedbackList = (
  feedbacks: AdminFeedback[],
  options: FeedbackListSelectorOptions,
): AdminFeedback[] => {
  const searchTerm = options.searchQuery.trim().toLowerCase();

  return feedbacks
    .filter((feedback) => {
      const searchableText = [
        feedback.parentName,
        feedback.petName,
        feedback.aiSummary,
        ...(feedback.answers ?? []),
        feedback.transcript ?? '',
      ]
        .join(' ')
        .toLowerCase();

      return (
        (!searchTerm || searchableText.includes(searchTerm)) &&
        (options.typeFilter === 'All' || feedback.category === options.typeFilter) &&
        (options.statusFilter === 'all' ||
          (options.statusFilter === 'read' ? feedback.is_read : !feedback.is_read)) &&
        feedback.rating >= options.ratingMin &&
        feedback.rating <= options.ratingMax &&
        matchesTimeRange(feedback, options.timeRange, options.dateFrom, options.dateTo)
      );
    })
    .sort((left, right) => compareFeedbacks(left, right, options.sortOption));
};

export const getFeedbackTimeDomain = (feedbacks: AdminFeedback[]): FeedbackTimeDomain => {
  if (feedbacks.length === 0) return getFallbackTimeDomain();

  const today = formatFeedbackCalendarDate(Date.now());
  const earliestFeedbackDate = formatFeedbackCalendarDate(
    Math.min(...feedbacks.map((feedback) => feedback.timestamp)),
  );
  const min = earliestFeedbackDate > today ? today : earliestFeedbackDate;

  return {
    min: min === today ? formatFeedbackCalendarDate(Date.now() - ONE_DAY_IN_MILLISECONDS) : min,
    max: today,
  };
};
