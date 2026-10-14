import React, { useEffect, useState } from 'react';
import type { FeedbackTimeFilter } from '../../types/feedback';
import {
  formatFeedbackCalendarDate,
  formatFeedbackCalendarDateLabel,
  toFeedbackCalendarDayTimestamp,
} from '../../utils/feedbackTime';
import { FeedbackRangeFilterPopover } from './FeedbackRangeFilterPopover';
import {
  DAY_IN_MILLISECONDS,
  getInitialDateRange,
  getSliderPercentage,
  RATING_MAX,
  RATING_MIN,
  type FeedbackRangeFilterDraft,
  type FeedbackRangeFilterValues,
  type FeedbackTimeDomain,
  toRangeFilterValues,
} from './feedbackRangeFilter.utils';

export type {
  FeedbackRangeFilterDraft,
  FeedbackRangeFilterValues,
  FeedbackTimeDomain,
} from './feedbackRangeFilter.utils';

export interface FeedbackRangeFilterProps {
  timeRange: FeedbackTimeFilter;
  ratingMin: number;
  ratingMax: number;
  dateFrom: string;
  dateTo: string;
  timeDomain: FeedbackTimeDomain;
  onRangeFiltersChange: (values: FeedbackRangeFilterValues) => void;
}

const toTimestamp = toFeedbackCalendarDayTimestamp;

export const FeedbackRangeFilter: React.FC<FeedbackRangeFilterProps> = ({
  timeRange,
  ratingMin,
  ratingMax,
  dateFrom,
  dateTo,
  timeDomain,
  onRangeFiltersChange,
}) => {
  const [isRangePopoverOpen, setIsRangePopoverOpen] = useState(false);
  const initialDateRange = getInitialDateRange(timeRange, dateFrom, dateTo, timeDomain);
  const [draft, setDraft] = useState<FeedbackRangeFilterDraft>({
    timeFrom: initialDateRange.from,
    timeTo: initialDateRange.to,
    ratingMin,
    ratingMax,
  });

  useEffect(() => {
    if (!isRangePopoverOpen) return;

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setIsRangePopoverOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return (): void => document.removeEventListener('keydown', handleKeyDown);
  }, [isRangePopoverOpen]);

  const domainMin = toTimestamp(timeDomain.min);
  const timeDomainMax = toTimestamp(timeDomain.max);
  const sliderDomainMax = Math.max(timeDomainMax, domainMin + DAY_IN_MILLISECONDS);
  const timeFromPercentage = getSliderPercentage(draft.timeFrom, domainMin, sliderDomainMax);
  const timeToPercentage = getSliderPercentage(draft.timeTo, domainMin, sliderDomainMax);
  const ratingMinPercentage = getSliderPercentage(draft.ratingMin, RATING_MIN, RATING_MAX);
  const ratingMaxPercentage = getSliderPercentage(draft.ratingMax, RATING_MIN, RATING_MAX);

  const emitRangeFiltersChange = (nextDraft: FeedbackRangeFilterDraft): void => {
    onRangeFiltersChange(toRangeFilterValues(nextDraft, domainMin, timeDomainMax));
  };

  const updateDraft = (nextDraft: FeedbackRangeFilterDraft): void => {
    setDraft(nextDraft);
    emitRangeFiltersChange(nextDraft);
  };

  const openRangePopover = (): void => {
    const nextDateRange = getInitialDateRange(timeRange, dateFrom, dateTo, timeDomain);
    setDraft({
      timeFrom: nextDateRange.from,
      timeTo: nextDateRange.to,
      ratingMin,
      ratingMax,
    });
    setIsRangePopoverOpen(true);
  };

  const resetRangeFilters = (): void => {
    const resetDateRange = getInitialDateRange('all', '', '', timeDomain);
    const resetDraft: FeedbackRangeFilterDraft = {
      timeFrom: resetDateRange.from,
      timeTo: resetDateRange.to,
      ratingMin: RATING_MIN,
      ratingMax: RATING_MAX,
    };
    setDraft(resetDraft);
    onRangeFiltersChange({
      timeRange: 'all',
      dateFrom: '',
      dateTo: '',
      ratingMin: RATING_MIN,
      ratingMax: RATING_MAX,
    });
    setIsRangePopoverOpen(false);
  };

  return (
    <div
      className="relative flex flex-wrap items-center gap-3"
      data-testid="feedback-range-trigger-wrapper"
    >
      <button
        type="button"
        aria-label="Open time and rating filters"
        aria-expanded={isRangePopoverOpen}
        aria-haspopup="dialog"
        aria-controls="feedback-range-popover"
        className="type-button rounded-full border border-control-border bg-surface-card px-4 py-2 text-notice-secondary transition-colors hover:bg-surface-cream focus:outline-none focus:ring-2 focus:ring-focus/20"
        onClick={openRangePopover}
      >
        Time &amp; Rating
      </button>

      {isRangePopoverOpen && (
        <FeedbackRangeFilterPopover
          draft={draft}
          domainMin={domainMin}
          sliderDomainMax={sliderDomainMax}
          timeFromPercentage={timeFromPercentage}
          timeToPercentage={timeToPercentage}
          ratingMinPercentage={ratingMinPercentage}
          ratingMaxPercentage={ratingMaxPercentage}
          timeRangeLabel={`${formatFeedbackCalendarDateLabel(formatFeedbackCalendarDate(draft.timeFrom))} to ${formatFeedbackCalendarDateLabel(formatFeedbackCalendarDate(draft.timeTo))}`}
          ratingRangeLabel={`${draft.ratingMin.toFixed(1)} to ${draft.ratingMax.toFixed(1)}`}
          onTimeFromChange={(value) =>
            updateDraft({
              ...draft,
              timeFrom: Math.min(value, draft.timeTo),
            })
          }
          onTimeToChange={(value) =>
            updateDraft({
              ...draft,
              timeTo: Math.max(value, draft.timeFrom),
            })
          }
          onRatingMinChange={(value) =>
            updateDraft({
              ...draft,
              ratingMin: Math.min(value, draft.ratingMax),
            })
          }
          onRatingMaxChange={(value) =>
            updateDraft({
              ...draft,
              ratingMax: Math.max(value, draft.ratingMin),
            })
          }
          onReset={resetRangeFilters}
          onClose={() => setIsRangePopoverOpen(false)}
        />
      )}
    </div>
  );
};
