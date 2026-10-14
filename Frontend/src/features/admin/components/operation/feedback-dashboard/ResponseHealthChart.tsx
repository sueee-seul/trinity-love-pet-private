import React from 'react';
import type {
  GoogleReviewDashboard,
  GoogleReviewDashboardAgingBucketKey,
} from '../../../types/googleReviewDashboard';

interface ResponseHealthChartProps {
  responseHealth: GoogleReviewDashboard['responseHealth'];
}

const BUCKET_TONE_CLASSES: Record<GoogleReviewDashboardAgingBucketKey, string> = {
  safe: 'bg-status-success/5 text-status-success',
  watch: 'bg-theme-sun/10 text-theme-earth',
  attention: 'bg-theme-apricot/10 text-theme-earth',
  overdue: 'bg-status-danger/5 text-status-danger',
};

const MARK_COLORS: Record<GoogleReviewDashboardAgingBucketKey, string> = {
  safe: '#6b9c70',
  watch: '#e5a32a',
  attention: '#d78327',
  overdue: '#d95b4f',
};

const MAX_VISIBLE_MARKS = 18;

const getBucketWindow = (minHours: number, maxHours: number | null): string => {
  if (maxHours === null) {
    return `${minHours}h+`;
  }

  return minHours === 0 ? `Under ${maxHours}h` : `${minHours}h to under ${maxHours}h`;
};

export const ResponseHealthChart: React.FC<ResponseHealthChartProps> = ({ responseHealth }) => {
  return (
    <section
      aria-labelledby="response-health-heading"
      className="rounded-2xl border border-border-soft bg-surface-card p-5 shadow-card sm:p-6"
      data-testid="response-health-section"
    >
      <div className="mb-5">
        <div>
          <h2 id="response-health-heading" className="type-eyebrow text-theme-earth">
            RESPONSE HEALTH
          </h2>
          <p className="mt-2 type-body text-notice-muted">
            Reviews without a successful reply by time since received
          </p>
        </div>
      </div>

      <div className="grid overflow-hidden rounded-xl border border-border-soft sm:grid-cols-4">
        {responseHealth.buckets.map((bucket) => (
          <div
            key={bucket.key}
            className={`min-h-44 border-b border-border-soft p-3 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 ${BUCKET_TONE_CLASSES[bucket.key]}`}
            aria-label={`${bucket.label}, ${getBucketWindow(bucket.minHours, bucket.maxHours)}, ${bucket.count} pending reviews`}
          >
            <div className="flex flex-col items-center gap-1 text-center">
              <span className="type-meta font-bold uppercase">{bucket.label}</span>
              <span className="type-meta">{getBucketWindow(bucket.minHours, bucket.maxHours)}</span>
            </div>

            <div className="mt-5 flex min-h-16 flex-wrap content-center justify-center gap-2">
              {Array.from({ length: Math.min(bucket.count, MAX_VISIBLE_MARKS) }, (_, index) => (
                <span
                  key={`${bucket.key}-${index}`}
                  aria-hidden="true"
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: MARK_COLORS[bucket.key] }}
                />
              ))}
              {bucket.count > MAX_VISIBLE_MARKS && (
                <span className="type-meta font-bold">+{bucket.count - MAX_VISIBLE_MARKS}</span>
              )}
            </div>

            <p className="mt-4 text-center type-display type-numeral text-display text-notice-primary">
              {bucket.count}
            </p>
            <p className="text-center type-meta text-notice-muted">pending</p>
          </div>
        ))}
      </div>

      <p className="mt-4 type-meta text-notice-muted">
        Thresholds are inclusive at 4h, 12h, and 24h; bucket counts sum to{' '}
        {responseHealth.pendingCount}.
      </p>
      <p className="mt-1 type-meta text-notice-muted">
        Reviews at 24h+ are overdue under the 24-hour reply SLA. Use this view to prioritize reviews
        approaching or exceeding the SLA.
      </p>
    </section>
  );
};
