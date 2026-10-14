import { useMemo } from 'react';
import { useAdminFeedbackSnapshot } from './useAdminFeedbackSnapshot';
import {
  getFeedbackTimeDomain,
  selectFeedbackList,
  type FeedbackTimeDomain,
} from '../selectors/feedbackSelectors';
import { useFeedbackStore } from '../store/feedbackStore';
import type {
  FeedbackSortOption,
  FeedbackStatusFilter,
  FeedbackTimeFilter,
  FeedbackTypeFilter,
} from '../types/feedback';

interface UseAdminFeedbackDataOptions {
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

interface AdminFeedbackDataState {
  feedbacks: ReturnType<typeof selectFeedbackList>;
  loading: boolean;
  feedbackError: string | null;
  timeDomain: FeedbackTimeDomain;
}

export const useAdminFeedbackData = ({
  searchQuery,
  statusFilter,
  typeFilter,
  sortOption,
  timeRange,
  ratingMin,
  ratingMax,
  dateFrom,
  dateTo,
}: UseAdminFeedbackDataOptions): AdminFeedbackDataState => {
  useAdminFeedbackSnapshot();

  const feedbackByUuid = useFeedbackStore((state) => state.feedbackByUuid);
  const feedbackUuids = useFeedbackStore((state) => state.feedbackUuids);
  const snapshotStatus = useFeedbackStore((state) => state.snapshotStatus);
  const snapshotError = useFeedbackStore((state) => state.snapshotError);

  const allFeedbacks = useMemo(
    () =>
      feedbackUuids.flatMap((uuid) => {
        const feedback = feedbackByUuid[uuid];
        return feedback ? [feedback] : [];
      }),
    [feedbackByUuid, feedbackUuids],
  );
  const feedbacks = useMemo(
    () =>
      selectFeedbackList(allFeedbacks, {
        searchQuery,
        statusFilter,
        typeFilter,
        sortOption,
        timeRange,
        ratingMin,
        ratingMax,
        dateFrom,
        dateTo,
      }),
    [
      allFeedbacks,
      searchQuery,
      statusFilter,
      typeFilter,
      sortOption,
      timeRange,
      ratingMin,
      ratingMax,
      dateFrom,
      dateTo,
    ],
  );
  const timeDomain = useMemo(() => getFeedbackTimeDomain(allFeedbacks), [allFeedbacks]);

  return {
    feedbacks,
    loading: snapshotStatus === 'idle' || snapshotStatus === 'loading',
    feedbackError: snapshotError,
    timeDomain,
  };
};
