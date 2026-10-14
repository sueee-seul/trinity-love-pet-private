import React, { useState } from 'react';
import { useKpiDailySummary } from '../../hooks/useKpiDailySummary';
import type { KpiDailySummary, KpiDailySummaryFigures } from '../../api/kpiApi';

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** Staff shown in "Needs attention": only those with overdue tasks, most overdue first. */
const ATTENTION_LIMIT = 3;

/** "2026-09-30" → "30 Sep"; fixed labels so every browser shows the same text. */
const formatSummaryDate = (date: string): string => {
  const value = new Date(`${date}T00:00:00Z`);
  return `${value.getUTCDate()} ${MONTH_LABELS[value.getUTCMonth()]}`;
};

const toBodyText = (summary: KpiDailySummary | null): string => {
  if (summary?.status === 'ready') {
    return summary.text;
  }
  if (summary?.status === 'empty') {
    return 'No tasks were scheduled yesterday';
  }
  return 'Summary not ready yet';
};

const StatTile: React.FC<{ label: string; value: string; note?: string }> = ({
  label,
  value,
  note,
}) => (
  <div className="rounded-xl bg-surface-bubbles px-3 py-2">
    <dt className="type-meta text-notice-secondary">{label}</dt>
    <dd className="type-numeral text-notice-primary">{value}</dd>
    {note && <dd className="type-meta text-notice-secondary">{note}</dd>}
  </div>
);

const SummaryFigures: React.FC<{ figures: KpiDailySummaryFigures }> = ({ figures }) => {
  const attention = figures.staff.filter((staff) => staff.overdue > 0).slice(0, ATTENTION_LIMIT);

  return (
    <>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Scheduled" value={String(figures.scheduled)} />
        <StatTile label="Completed" value={`${figures.completed} (${figures.completionRate}%)`} />

        <StatTile label="Overdue" value={String(figures.overdue)} />
        <StatTile label="Open at day end" value={String(figures.incompleteAtDayEnd)} />
      </dl>
      {attention.length > 0 && (
        <p className="type-meta text-notice-secondary">
          <span className="font-bold text-notice-primary">Needs attention</span>{' '}
          {attention.map((staff) => `${staff.name} ${staff.overdue}/${staff.assigned}`).join(' · ')}
        </p>
      )}
    </>
  );
};

/** Yesterday's saved summary for the Today tab. It never calls the LLM. */
export const KpiDailySummaryCard: React.FC = () => {
  const { summary, loadStatus } = useKpiDailySummary();
  const [expanded, setExpanded] = useState(true);

  const title = summary
    ? `Yesterday's summary (${formatSummaryDate(summary.date)})`
    : "Yesterday's summary";

  return (
    <section className="rounded-2xl border border-border-soft bg-surface-card p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h2 className="type-button text-notice-primary">{title}</h2>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="min-h-11 rounded-xl border border-control-border bg-surface-card px-4 type-button text-notice-primary transition-colors hover:bg-surface-deep"
        >
          {expanded ? 'Hide' : 'Show'}
        </button>
      </div>
      {expanded && (
        <div className="mt-4 space-y-3">
          {summary?.status === 'ready' && <SummaryFigures figures={summary.figures} />}
          <p className="type-body text-notice-secondary">
            {loadStatus === 'loading' ? 'Loading summary…' : toBodyText(summary)}
          </p>
        </div>
      )}
    </section>
  );
};
