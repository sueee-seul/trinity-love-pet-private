import React from 'react';
import {
  DAY_IN_MILLISECONDS,
  RATING_MAX,
  RATING_MIN,
  RATING_STEP,
  type FeedbackRangeFilterDraft,
} from './feedbackRangeFilter.utils';

interface FeedbackRangeFilterPopoverProps {
  draft: FeedbackRangeFilterDraft;
  domainMin: number;
  sliderDomainMax: number;
  timeFromPercentage: number;
  timeToPercentage: number;
  ratingMinPercentage: number;
  ratingMaxPercentage: number;
  timeRangeLabel: string;
  ratingRangeLabel: string;
  onTimeFromChange: (value: number) => void;
  onTimeToChange: (value: number) => void;
  onRatingMinChange: (value: number) => void;
  onRatingMaxChange: (value: number) => void;
  onReset: () => void;
  onClose: () => void;
}

export const FeedbackRangeFilterPopover: React.FC<FeedbackRangeFilterPopoverProps> = ({
  draft,
  domainMin,
  sliderDomainMax,
  timeFromPercentage,
  timeToPercentage,
  ratingMinPercentage,
  ratingMaxPercentage,
  timeRangeLabel,
  ratingRangeLabel,
  onTimeFromChange,
  onTimeToChange,
  onRatingMinChange,
  onRatingMaxChange,
  onReset,
  onClose,
}) => (
  <div
    id="feedback-range-popover"
    role="dialog"
    aria-label="Feedback time and rating filters"
    data-testid="feedback-range-popover"
    className="absolute right-0 top-full z-20 mt-3 flex w-[min(760px,calc(100vw-2rem))] flex-col gap-6 rounded-2xl border border-control-border bg-surface-card p-5 shadow-lg sm:flex-row sm:items-end"
  >
    <div className="min-w-0 flex-1">
      <div className="mb-2 flex items-center justify-between gap-4">
        <h2 className="type-button text-notice-secondary">Time range</h2>
        <span className="type-meta whitespace-nowrap text-notice-muted">{timeRangeLabel}</span>
      </div>
      <div className="relative h-8">
        <div className="absolute left-0 right-0 top-3 h-1 rounded-full bg-surface-cream" />
        <div
          className="absolute top-3 h-1 rounded-full bg-accent-foreground"
          style={{ left: `${timeFromPercentage}%`, right: `${100 - timeToPercentage}%` }}
        />
        <label className="sr-only" htmlFor="feedback-time-from-slider">
          Feedback time range start
        </label>
        <input
          id="feedback-time-from-slider"
          aria-label="Feedback time range start"
          type="range"
          min={domainMin}
          max={sliderDomainMax}
          step={DAY_IN_MILLISECONDS}
          value={Math.min(draft.timeFrom, draft.timeTo)}
          onChange={(event) => onTimeFromChange(Number(event.target.value))}
          className="pointer-events-none absolute inset-0 h-8 w-full appearance-none bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:pointer-events-auto"
        />
        <label className="sr-only" htmlFor="feedback-time-to-slider">
          Feedback time range end
        </label>
        <input
          id="feedback-time-to-slider"
          aria-label="Feedback time range end"
          type="range"
          min={domainMin}
          max={sliderDomainMax}
          step={DAY_IN_MILLISECONDS}
          value={Math.max(draft.timeTo, draft.timeFrom)}
          onChange={(event) => onTimeToChange(Number(event.target.value))}
          className="pointer-events-none absolute inset-0 h-8 w-full appearance-none bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:pointer-events-auto"
        />
      </div>
    </div>

    <div className="min-w-0 flex-1">
      <div className="mb-2 flex items-center justify-between gap-4">
        <h2 className="type-button text-notice-secondary">Rating</h2>
        <span className="type-meta whitespace-nowrap text-notice-muted">{ratingRangeLabel}</span>
      </div>
      <div className="relative h-8">
        <div className="absolute left-0 right-0 top-3 h-1 rounded-full bg-surface-cream" />
        <div
          className="absolute top-3 h-1 rounded-full bg-accent-foreground"
          style={{
            left: `${ratingMinPercentage}%`,
            right: `${100 - ratingMaxPercentage}%`,
          }}
        />
        <label className="sr-only" htmlFor="feedback-rating-min-slider">
          Minimum feedback rating
        </label>
        <input
          id="feedback-rating-min-slider"
          aria-label="Minimum feedback rating"
          type="range"
          min={RATING_MIN}
          max={RATING_MAX}
          step={RATING_STEP}
          value={Math.min(draft.ratingMin, draft.ratingMax)}
          onChange={(event) => onRatingMinChange(Number(event.target.value))}
          className="pointer-events-none absolute inset-0 h-8 w-full appearance-none bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:pointer-events-auto"
        />
        <label className="sr-only" htmlFor="feedback-rating-max-slider">
          Maximum feedback rating
        </label>
        <input
          id="feedback-rating-max-slider"
          aria-label="Maximum feedback rating"
          type="range"
          min={RATING_MIN}
          max={RATING_MAX}
          step={RATING_STEP}
          value={Math.max(draft.ratingMax, draft.ratingMin)}
          onChange={(event) => onRatingMaxChange(Number(event.target.value))}
          className="pointer-events-none absolute inset-0 h-8 w-full appearance-none bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:pointer-events-auto"
        />
      </div>
    </div>

    <div className="flex shrink-0 justify-end gap-2 sm:pb-0">
      <button
        type="button"
        className="type-button rounded-lg px-3 py-2 text-notice-muted transition-colors hover:bg-surface-cream hover:text-notice-secondary focus:outline-none focus:ring-2 focus:ring-focus/20"
        onClick={onReset}
      >
        Reset
      </button>
      <button
        type="button"
        className="type-button rounded-lg bg-accent-foreground px-3 py-2 text-surface-card transition-colors hover:bg-accent-foreground-hover focus:outline-none focus:ring-2 focus:ring-focus/20"
        onClick={onClose}
      >
        Close
      </button>
    </div>
  </div>
);
