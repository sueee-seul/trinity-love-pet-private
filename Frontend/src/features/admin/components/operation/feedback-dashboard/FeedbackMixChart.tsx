import React from 'react';
import type {
  GoogleReviewDashboard,
  GoogleReviewDashboardTriageType,
} from '../../../types/googleReviewDashboard';
import { DashboardVisualHelp } from './DashboardVisualHelp';

interface FeedbackMixChartProps {
  mix: GoogleReviewDashboard['feedbackMix'];
}

const MIX_LABELS: Record<GoogleReviewDashboardTriageType, string> = {
  issue: 'Issue',
  suggestion: 'Suggestion',
  praise: 'Praise',
  unclassified: 'Unclassified',
};

/** SVG strokes and inline styles read CSS variables, so the ring follows the theme. */
const MIX_COLORS: Record<GoogleReviewDashboardTriageType, string> = {
  issue: 'var(--color-status-danger)',
  suggestion: 'var(--color-status-warning)',
  praise: 'var(--color-status-success)',
  unclassified: 'var(--color-notice-muted)',
};

const RADIUS = 54;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export const FeedbackMixChart: React.FC<FeedbackMixChartProps> = ({ mix }) => {
  const arcs = mix.segments.map((segment, index) => {
    const length = mix.total === 0 ? 0 : (segment.count / mix.total) * CIRCUMFERENCE;
    const offset = mix.segments.slice(0, index).reduce((total, previousSegment) => {
      return total + (mix.total === 0 ? 0 : (previousSegment.count / mix.total) * CIRCUMFERENCE);
    }, 0);
    const arc = (
      <circle
        key={segment.type}
        cx="80"
        cy="80"
        r={RADIUS}
        fill="none"
        stroke={MIX_COLORS[segment.type]}
        strokeWidth="18"
        strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
        strokeDashoffset={-offset}
        transform="rotate(-90 80 80)"
      />
    );
    return arc;
  });

  return (
    <section
      aria-labelledby="feedback-mix-heading"
      className="rounded-2xl border border-border-soft bg-surface-card p-5 shadow-card sm:p-6"
      data-testid="feedback-mix-section"
    >
      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <h2 id="feedback-mix-heading" className="type-eyebrow text-theme-earth">
            FEEDBACK MIX
          </h2>
          <DashboardVisualHelp
            visualName="Feedback Mix"
            note="Shows each review in one category: Issue, Suggestion, Praise, or Unclassified. Use it to see which feedback type is most common in the selected period; percentages are review shares, not star ratings."
          />
        </div>
        <span className="type-meta text-notice-muted">Selected period</span>
      </div>

      {mix.total === 0 ? (
        <p className="type-body py-10 text-center text-notice-muted">
          No reviews in the selected period.
        </p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center">
          <div className="relative mx-auto h-40 w-40">
            <svg
              role="img"
              aria-label={`Feedback mix for ${mix.total} reviews`}
              className="h-full w-full"
              viewBox="0 0 160 160"
            >
              <circle cx="80" cy="80" r={RADIUS} fill="none" stroke="#f1e8df" strokeWidth="18" />
              {arcs}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="type-display type-numeral text-display text-notice-primary">
                {mix.total}
              </span>
              <span className="type-meta text-notice-muted">total</span>
            </div>
          </div>

          <ul className="space-y-3" aria-label="Feedback mix values">
            {mix.segments.map((segment) => (
              <li key={segment.type} className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: MIX_COLORS[segment.type] }}
                />
                <span className="type-button flex-1 text-notice-primary">
                  {MIX_LABELS[segment.type]}
                </span>
                <span className="type-meta text-notice-muted">
                  {segment.percentage.toFixed(1)}%
                </span>
                <span className="type-button min-w-8 text-right text-notice-primary">
                  {segment.count}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};
