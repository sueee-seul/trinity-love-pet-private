import React, { useMemo, useState } from 'react';
import { LoadingState } from '../../../../../shared/components/ui/LoadingState';
import { useAdminGoogleReviewDashboard } from '../../../hooks/useAdminGoogleReviewDashboard';
import {
  GOOGLE_REVIEW_DASHBOARD_PLACE_SLUG,
  GOOGLE_REVIEW_DASHBOARD_TIME_ZONE,
  type GoogleReviewDashboardPeriod,
  type GoogleReviewDashboardQuery,
} from '../../../types/googleReviewDashboard';
import { AverageRatingCard } from './AverageRatingCard';
import { FeedbackFlowChart } from './FeedbackFlowChart';
import { FeedbackMixChart } from './FeedbackMixChart';
import { ManagerAttentionCards } from './ManagerAttentionCards';
import { ResponseHealthChart } from './ResponseHealthChart';

const PERIOD_OPTIONS: readonly { value: GoogleReviewDashboardPeriod; label: string }[] = [
  { value: 'last_7_days', label: 'Last 7 days' },
  { value: 'last_30_days', label: 'Last 30 days' },
  { value: 'last_12_months', label: 'Last 12 months' },
];

const getAucklandDateOnly = (date: Date): string => {
  const formatter = new Intl.DateTimeFormat('en-NZ', {
    timeZone: GOOGLE_REVIEW_DASHBOARD_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!year || !month || !day) {
    throw new Error('Could not determine the current Auckland date');
  }
  return `${year}-${month}-${day}`;
};

const shiftDateOnly = (dateOnly: string, days: number): string => {
  const [year, month, day] = dateOnly.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return [
    shifted.getUTCFullYear(),
    String(shifted.getUTCMonth() + 1).padStart(2, '0'),
    String(shifted.getUTCDate()).padStart(2, '0'),
  ].join('-');
};

const getPeriodQuery = (
  preset: GoogleReviewDashboardPeriod,
): Pick<GoogleReviewDashboardQuery, 'from' | 'to'> => {
  if (preset === 'last_12_months') {
    return {};
  }

  const to = getAucklandDateOnly(new Date());
  const days = preset === 'last_7_days' ? 6 : 29;
  return { from: shiftDateOnly(to, -days), to };
};

const formatLastRefreshed = (value: string): string | null => {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return null;
  }

  if (Math.abs(Date.now() - timestamp) < 60 * 1000) {
    return 'Last refreshed: just now';
  }

  return `Last refreshed: ${new Intl.DateTimeFormat('en-NZ', {
    timeZone: GOOGLE_REVIEW_DASHBOARD_TIME_ZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp))}`;
};

const formatAucklandDate = (value: string): string => {
  const parts = new Intl.DateTimeFormat('en-NZ', {
    timeZone: GOOGLE_REVIEW_DASHBOARD_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return year && month && day ? `${year}-${month}-${day}` : value.slice(0, 10);
};

/**
 * Renders the manager-facing Google Review dashboard.
 *
 * @remarks
 * This dashboard manages its own period preset state and coordinates the data fetch via
 * `useAdminGoogleReviewDashboard`. The `status === 'refreshing'` state is used to
 * preserve the current projection while a new request is in flight.
 */
export const GoogleReviewDashboard: React.FC = () => {
  const [periodPreset, setPeriodPreset] = useState<GoogleReviewDashboardPeriod>('last_12_months');
  const periodQuery = useMemo(() => getPeriodQuery(periodPreset), [periodPreset]);
  const { dashboard, status, error, refresh } = useAdminGoogleReviewDashboard(periodQuery);
  const lastRefreshedLabel = dashboard
    ? formatLastRefreshed(dashboard.freshness.refreshedAt)
    : null;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-5 border-b border-border-soft pb-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="type-display text-notice-primary">Feedback Overview</h1>
            <span className="rounded-full bg-surface-bubbles px-3 py-1 type-meta font-bold text-theme-earth">
              Manager view
            </span>
          </div>
          <p className="mt-2 type-body text-notice-secondary">
            Google review response health and current attention signals
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="sr-only" htmlFor="google-review-dashboard-period">
            Dashboard period
          </label>
          <select
            id="google-review-dashboard-period"
            value={periodPreset}
            onChange={(event) => setPeriodPreset(event.target.value as GoogleReviewDashboardPeriod)}
            className="min-h-11 rounded-xl border border-field-border bg-surface-card px-3 type-button text-notice-primary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            {PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="rounded-xl border border-control-border bg-surface-card px-4 py-3 type-button text-notice-primary">
            {GOOGLE_REVIEW_DASHBOARD_PLACE_SLUG}
          </span>
          <button
            type="button"
            onClick={refresh}
            disabled={status === 'loading' || status === 'refreshing'}
            className="min-h-11 rounded-xl border border-control-border bg-surface-card px-4 type-button text-notice-primary transition-colors hover:bg-surface-deep disabled:cursor-wait disabled:opacity-60"
          >
            {status === 'refreshing' ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-status-danger/30 bg-status-danger/5 px-4 py-3 type-body text-status-danger"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={refresh}
            className="rounded-lg border border-status-danger/30 px-3 py-1.5 type-button text-status-danger hover:bg-surface-card"
          >
            Try again
          </button>
        </div>
      )}

      {dashboard ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 type-meta text-notice-muted">
            <span>
              {formatAucklandDate(dashboard.scope.periodStart)} to{' '}
              {formatAucklandDate(dashboard.scope.periodEnd)} · {dashboard.scope.timezone}
            </span>
            {lastRefreshedLabel && <span>{lastRefreshedLabel}</span>}
          </div>

          <ManagerAttentionCards attention={dashboard.managerAttention} />

          <div className="grid gap-6 xl:grid-cols-2">
            <AverageRatingCard rating={dashboard.rating} />
            <FeedbackMixChart mix={dashboard.feedbackMix} />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <ResponseHealthChart responseHealth={dashboard.responseHealth} />
            <FeedbackFlowChart flow={dashboard.feedbackFlow} />
          </div>
        </>
      ) : status === 'error' ? (
        <div className="rounded-2xl border border-border-soft bg-surface-card px-5 py-16 text-center shadow-card">
          <p className="type-body text-notice-muted">The dashboard is unavailable right now.</p>
          <button
            type="button"
            onClick={refresh}
            className="mt-4 rounded-xl border border-control-border px-4 py-2 type-button text-accent-foreground hover:bg-surface-cream"
          >
            Try again
          </button>
        </div>
      ) : (
        <LoadingState
          label="Loading Google review dashboard…"
          variant="section"
          className="py-20"
        />
      )}
    </div>
  );
};
