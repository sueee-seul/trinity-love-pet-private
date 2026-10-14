import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import type { KpiPeriodSummary, KpiPeriodSummaryRange } from '../../api/kpiPeriodSummaryApi';
import type { KpiReportKeyNumber } from '../../api/kpiReportsApi';
import { useKpiPeriodSummary } from '../../hooks/useKpiPeriodSummary';

const TITLES: Record<KpiPeriodSummaryRange, string> = {
  '7d': 'Last week',
  '30d': 'Last month',
  '90d': 'Last quarter',
};

/** The card shows the report's first key numbers; the full list is on the report page. */
const KEY_NUMBER_LIMIT = 4;

const formatNumber = (value: number | null, unit: KpiReportKeyNumber['unit']): string =>
  value === null ? 'n/a' : `${value}${unit}`;

const toBodyText = (summary: KpiPeriodSummary | null): string => {
  if (summary?.status === 'ready') {
    return summary.headline;
  }
  if (summary?.status === 'no_text') {
    return 'No summary text for this report';
  }
  return 'Summary not ready yet';
};

/** The saved report summary for the 7d / 30d / 90d tab. It never calls the LLM. */
export const KpiPeriodSummaryCard: React.FC<{ range: KpiPeriodSummaryRange }> = ({ range }) => {
  const { summary, loadStatus } = useKpiPeriodSummary(range);
  const [expanded, setExpanded] = useState(true);
  const title = summary ? `${TITLES[range]} (${summary.periodLabel})` : TITLES[range];

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
          {summary && summary.status !== 'not_ready' && (
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {summary.keyNumbers.slice(0, KEY_NUMBER_LIMIT).map((keyNumber) => (
                <div key={keyNumber.key} className="rounded-xl bg-surface-bubbles px-3 py-2">
                  <dt className="type-meta text-notice-secondary">{keyNumber.label}</dt>
                  <dd className="type-numeral text-notice-primary">
                    {formatNumber(keyNumber.current, keyNumber.unit)}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          <p className="type-body text-notice-secondary">
            {loadStatus === 'loading' ? 'Loading summary…' : toBodyText(summary)}
          </p>
          {summary?.reportId && (
            <Link
              to={`/admin/kpi-reports/${summary.reportId}`}
              className="type-button text-notice-primary underline"
            >
              Open report
            </Link>
          )}
        </div>
      )}
    </section>
  );
};
