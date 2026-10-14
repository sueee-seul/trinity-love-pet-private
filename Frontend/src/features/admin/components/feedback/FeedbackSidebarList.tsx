import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FEEDBACK_TYPES } from '../../../../shared/types/feedback';
import { Select } from '../../../../shared/components/ui/Select';
import { DateField } from '../../../../shared/components/ui/date';
import { LoadingState } from '../../../../shared/components/ui/LoadingState';
import { useAdminFeedbackSnapshot } from '../../hooks/useAdminFeedbackSnapshot';
import { selectFeedbackList } from '../../selectors/feedbackSelectors';
import { useFeedbackStore } from '../../store/feedbackStore';
import {
  type FeedbackRatingFilter,
  type FeedbackTimeFilter,
  type FeedbackTypeFilter,
  isFeedbackRatingFilter,
  isFeedbackTimeFilter,
  isFeedbackTypeFilter,
} from '../../types/feedback';
import { FeedbackTypeTag } from './FeedbackTypeTag';

const getRatingBounds = (ratingFilter: FeedbackRatingFilter): { min: number; max: number } => {
  if (ratingFilter === 'low') return { min: 1, max: 2 };
  if (ratingFilter === 'medium') return { min: 2.1, max: 3.9 };
  if (ratingFilter === 'high') return { min: 4, max: 5 };
  return { min: 1, max: 5 };
};

export const FeedbackSidebarList: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<FeedbackTypeFilter>('All');
  const [timeRange, setTimeRange] = useState<FeedbackTimeFilter>('all');
  const [ratingFilter, setRatingFilter] = useState<FeedbackRatingFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useAdminFeedbackSnapshot();

  const feedbackByUuid = useFeedbackStore((state) => state.feedbackByUuid);
  const feedbackUuids = useFeedbackStore((state) => state.feedbackUuids);
  const snapshotStatus = useFeedbackStore((state) => state.snapshotStatus);
  const snapshotError = useFeedbackStore((state) => state.snapshotError);

  const effectiveTimeRange =
    timeRange === 'custom' ? (dateFrom && dateTo ? 'custom' : 'all') : timeRange;
  const ratingBounds = getRatingBounds(ratingFilter);
  const feedbacks = useMemo(() => {
    const allFeedbacks = feedbackUuids.flatMap((uuid) => {
      const feedback = feedbackByUuid[uuid];
      return feedback ? [feedback] : [];
    });

    return selectFeedbackList(allFeedbacks, {
      searchQuery,
      statusFilter: 'all',
      typeFilter,
      sortOption: 'newest',
      timeRange: effectiveTimeRange,
      ratingMin: ratingBounds.min,
      ratingMax: ratingBounds.max,
      dateFrom,
      dateTo,
    });
  }, [
    dateFrom,
    dateTo,
    effectiveTimeRange,
    feedbackByUuid,
    feedbackUuids,
    ratingBounds.max,
    ratingBounds.min,
    searchQuery,
    typeFilter,
  ]);

  const loading = snapshotStatus === 'idle' || snapshotStatus === 'loading';
  const error = snapshotStatus === 'error' ? snapshotError : null;

  return (
    <div className="w-80 border-r border-border-soft bg-surface-cream flex flex-col h-[calc(100vh-64px)]">
      <div className="p-4 border-b border-border-soft">
        <h2 className="type-card-title mb-3">Recent Feedback</h2>
        <Select
          aria-label="Sidebar feedback type filter"
          className="mb-3"
          selectClassName="pl-3"
          value={typeFilter}
          onChange={(value) => {
            if (isFeedbackTypeFilter(value)) {
              setTypeFilter(value);
            }
          }}
          options={[
            { value: 'All', label: 'All Types' },
            ...FEEDBACK_TYPES.map((type) => ({ value: type, label: type })),
          ]}
        />
        <div className="relative mb-3">
          <svg
            className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-notice-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search feedback..."
            aria-label="Search sidebar feedback"
            className="w-full type-body bg-surface-card border border-field-border rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-focus/20 focus:border-focus transition-all text-notice-secondary"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select
            aria-label="Sidebar feedback time range"
            className="min-w-0 appearance-none bg-surface-card border border-field-border text-notice-secondary px-2 py-2 rounded-lg type-meta focus:outline-none focus:ring-2 focus:ring-focus/20 cursor-pointer"
            value={timeRange}
            onChange={(event) => {
              if (isFeedbackTimeFilter(event.target.value)) {
                setTimeRange(event.target.value);
              }
            }}
          >
            <option value="all">All time</option>
            <option value="last_7_days">7 days</option>
            <option value="last_30_days">30 days</option>
            <option value="custom">Custom</option>
          </select>
          <select
            aria-label="Sidebar feedback rating filter"
            className="min-w-0 appearance-none bg-surface-card border border-field-border text-notice-secondary px-2 py-2 rounded-lg type-meta focus:outline-none focus:ring-2 focus:ring-focus/20 cursor-pointer"
            value={ratingFilter}
            onChange={(event) => {
              if (isFeedbackRatingFilter(event.target.value)) {
                setRatingFilter(event.target.value);
              }
            }}
          >
            <option value="all">All ratings</option>
            <option value="low">≤ 2</option>
            <option value="medium">2 to 3.9</option>
            <option value="high">≥ 4</option>
          </select>
        </div>
        {timeRange === 'custom' && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="sr-only" htmlFor="sidebar-feedback-date-from">
              Sidebar feedback date from
            </label>
            <DateField
              id="sidebar-feedback-date-from"
              locale="en"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={setDateFrom}
              className="min-w-0 rounded-lg border border-field-border bg-surface-card px-2 py-2 type-meta text-notice-secondary focus:outline-none focus:ring-2 focus:ring-focus/20"
            />
            <label className="sr-only" htmlFor="sidebar-feedback-date-to">
              Sidebar feedback date to
            </label>
            <DateField
              id="sidebar-feedback-date-to"
              locale="en"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={setDateTo}
              className="min-w-0 rounded-lg border border-field-border bg-surface-card px-2 py-2 type-meta text-notice-secondary focus:outline-none focus:ring-2 focus:ring-focus/20"
            />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <LoadingState
            label="Loading sidebar feedback…"
            variant="section"
            spinnerSize="sm"
            className="items-stretch justify-start p-4"
          >
            <div aria-hidden="true" className="mt-4 space-y-3">
              {['one', 'two', 'three', 'four'].map((row) => (
                <div key={row} className="rounded-xl border border-border-soft bg-surface-card p-4">
                  <div className="flex items-start gap-3">
                    <span className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-surface-cream" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <span className="block h-4 w-3/5 animate-pulse rounded bg-surface-cream" />
                      <span className="block h-3 w-2/5 animate-pulse rounded bg-surface-cream" />
                    </div>
                  </div>
                  <span className="mt-3 block h-8 w-full animate-pulse rounded bg-surface-cream" />
                  <span className="mt-3 block h-5 w-20 animate-pulse rounded bg-surface-cream" />
                </div>
              ))}
            </div>
          </LoadingState>
        ) : error ? (
          <div role="alert" className="type-meta p-4 text-center text-status-danger">
            {error}
          </div>
        ) : feedbacks.length === 0 ? (
          <div className="type-meta p-4 text-center">No results found.</div>
        ) : (
          feedbacks.map((feedback) => {
            const isActive = feedback.uuid === id;

            return (
              <div
                key={feedback.uuid}
                onClick={() => navigate(`/admin/feedback/${feedback.uuid}`)}
                className={`p-4 border-b cursor-pointer transition-colors relative
                  ${!feedback.is_read ? 'bg-surface-bubbles border-control-border hover:bg-surface-bubbles/50' : 'bg-transparent border-border-soft hover:bg-surface-cream/50'}
                  ${isActive ? 'ring-inset ring-2 ring-focus' : ''}
                `}
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-accent-foreground text-surface-card type-meta font-bold flex items-center justify-center flex-shrink-0">
                    {feedback.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                      <h4 className="type-card-title truncate">{feedback.parentName}</h4>
                      <span className="type-meta text-notice-secondary flex-shrink-0 ml-2">
                        {feedback.date}
                      </span>
                    </div>
                    <p className="type-meta text-notice-secondary truncate mt-0.5">
                      {feedback.petName}
                      {feedback.serviceType && ` (${feedback.serviceType})`}
                    </p>
                  </div>
                </div>

                <p className="type-body text-notice-secondary mt-2 line-clamp-2">
                  {feedback.aiSummary}
                </p>

                <div className="mt-3">
                  <FeedbackTypeTag category={feedback.category} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
