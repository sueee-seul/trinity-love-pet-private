import type { FeedbackTimeFilter } from '../../types/feedback';
import {
  formatFeedbackCalendarDate,
  toFeedbackCalendarDayTimestamp,
} from '../../utils/feedbackTime';

export const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
export const RATING_MIN = 1;
export const RATING_MAX = 5;
export const RATING_STEP = 0.1;

export interface FeedbackTimeDomain {
  min: string;
  max: string;
}

export interface FeedbackRangeFilterValues {
  timeRange: FeedbackTimeFilter;
  dateFrom: string;
  dateTo: string;
  ratingMin: number;
  ratingMax: number;
}

export interface FeedbackRangeFilterDraft {
  timeFrom: number;
  timeTo: number;
  ratingMin: number;
  ratingMax: number;
}

const toTimestamp = toFeedbackCalendarDayTimestamp;

export const clampDate = (date: string, domain: FeedbackTimeDomain): string => {
  const timestamp = Math.min(
    Math.max(toTimestamp(date), toTimestamp(domain.min)),
    toTimestamp(domain.max),
  );
  return formatFeedbackCalendarDate(timestamp);
};

export const getInitialDateRange = (
  timeRange: FeedbackTimeFilter,
  dateFrom: string,
  dateTo: string,
  domain: FeedbackTimeDomain,
): { from: number; to: number } => {
  if (timeRange === 'custom' && dateFrom && dateTo) {
    return {
      from: toTimestamp(clampDate(dateFrom, domain)),
      to: toTimestamp(clampDate(dateTo, domain)),
    };
  }

  return {
    from: toTimestamp(domain.min),
    to: toTimestamp(domain.max),
  };
};

export const toRangeFilterValues = (
  draft: FeedbackRangeFilterDraft,
  domainMin: number,
  domainMax: number,
): FeedbackRangeFilterValues => {
  const selectedDateFrom = Math.min(draft.timeFrom, draft.timeTo);
  const selectedDateTo = Math.max(draft.timeFrom, draft.timeTo);
  const isFullTimeRange = selectedDateFrom <= domainMin && selectedDateTo >= domainMax;

  return {
    timeRange: isFullTimeRange ? 'all' : 'custom',
    dateFrom: isFullTimeRange ? '' : formatFeedbackCalendarDate(selectedDateFrom),
    dateTo: isFullTimeRange ? '' : formatFeedbackCalendarDate(selectedDateTo),
    ratingMin: Math.min(draft.ratingMin, draft.ratingMax),
    ratingMax: Math.max(draft.ratingMin, draft.ratingMax),
  };
};

export const getSliderPercentage = (value: number, min: number, max: number): number => {
  if (max <= min) return 0;
  return ((value - min) / (max - min)) * 100;
};
