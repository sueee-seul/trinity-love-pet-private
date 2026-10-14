import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { LoadingState } from '../../../shared/components/ui/LoadingState';
import type { KpiReport, KpiReportKeyNumber, KpiReportContent } from '../api/kpiReportsApi';
import { useKpiReport } from '../hooks/useKpiReport';
import { AdminPage } from '../components/layout/AdminPage';

const CARD = 'rounded-2xl border border-border-soft bg-surface-card p-5 shadow-card';
const REPORT_TYPE_LABELS: Record<KpiReportContent['type'], string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
};

const formatValue = (value: number | null, unit: KpiReportKeyNumber['unit']): string => {
  if (value === null) {
    return 'n/a';
  }
  if (unit === '%') {
    return `${value}%`;
  }
  return unit === 'm' ? `${value}m` : String(value);
};

/** Rate changes are percentage points ("pts"), as in the report email. */
const formatChange = ({ change, unit }: KpiReportKeyNumber): string => {
  if (change === null) {
    return 'n/a';
  }
  if (change === 0) {
    return 'no change';
  }
  const arrow = change > 0 ? '▲' : '▼';
  const size = Math.abs(change);
  if (unit === '%') {
    return `${arrow} ${size} pts`;
  }
  return unit === 'm' ? `${arrow} ${size}m` : `${arrow} ${size}`;
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className={CARD}>
    <h2 className="type-button text-notice-primary">{title}</h2>
    <div className="mt-3">{children}</div>
  </section>
);

const ReportBody: React.FC<{ report: KpiReport }> = ({ report }) => {
  const { content } = report;
  const title = `${REPORT_TYPE_LABELS[content.type]} KPI report`;

  return (
    <div className="space-y-6">
      <header className="border-b border-border-soft pb-6">
        <h1 className="type-display text-notice-primary">{title}</h1>
        <p className="mt-2 type-body text-notice-secondary">
          {content.periodLabel} · compared with {content.previousLabel}
        </p>
        <p className="mt-1 type-meta text-notice-muted">
          {report.trigger === 'manual' ? 'Manual run' : 'Scheduled'} ·{' '}
          {new Date(report.createdAt).toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland' })}
        </p>
      </header>

      {content.trends.length > 0 && (
        <section className={`${CARD} border-status-danger/40`}>
          <h2 className="type-button text-status-danger">Trend warnings</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 type-body text-notice-primary">
            {content.trends.map((trend) => (
              <li key={trend}>{trend}</li>
            ))}
          </ul>
        </section>
      )}

      <Section title="Summary">
        <p className="type-body text-notice-secondary">
          {content.headline ?? 'The written summary is not available for this report.'}
        </p>
      </Section>

      <Section title="Key numbers">
        <table className="w-full type-body">
          <thead>
            <tr className="text-left type-meta text-notice-muted">
              <th className="py-2">Metric</th>
              <th className="py-2">This period</th>
              <th className="py-2">Previous</th>
              <th className="py-2">Change</th>
            </tr>
          </thead>
          <tbody>
            {content.keyNumbers.map((item) => (
              <tr key={item.key} className="border-t border-border-soft">
                <td className="py-2 text-notice-primary">{item.label}</td>
                <td className="py-2">{formatValue(item.current, item.unit)}</td>
                <td className="py-2 text-notice-secondary">
                  {formatValue(item.previous, item.unit)}
                </td>
                <td
                  className={`py-2 ${item.worse ? 'font-bold text-status-danger' : 'text-notice-secondary'}`}
                >
                  {formatChange(item)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {content.movers.length > 0 && (
        <Section title="Biggest changes">
          <ul className="list-disc space-y-1 pl-5 type-body text-notice-secondary">
            {content.movers.map((mover) => (
              <li key={mover}>{mover}</li>
            ))}
          </ul>
        </Section>
      )}

      {content.staff.length > 0 && (
        <Section title="Staff">
          <table className="w-full type-body">
            <thead>
              <tr className="text-left type-meta text-notice-muted">
                <th className="py-2">Staff</th>
                <th className="py-2">Scheduled</th>
                <th className="py-2">Completion</th>
                <th className="py-2">Overdue</th>
              </tr>
            </thead>
            <tbody>
              {content.staff.map((person) => (
                <tr key={person.name} className="border-t border-border-soft">
                  <td className="py-2 text-notice-primary">{person.name}</td>
                  <td className="py-2">{person.scheduled}</td>
                  <td className="py-2">{formatValue(person.completionRate, '%')}</td>
                  <td className="py-2">{person.overdue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      <Section title="Main delay reasons">
        {content.delayReasons.length > 0 ? (
          <ul className="space-y-2 type-body">
            {content.delayReasons.map(({ theme, count, example }) => (
              <li key={theme}>
                <span className="font-bold text-notice-primary">{theme}</span>{' '}
                <span className="text-notice-secondary">({count})</span>
                <p className="type-meta text-notice-muted">{`e.g. "${example}"`}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="type-body text-notice-secondary">
            {content.delayReasonCount > 0
              ? `${content.delayReasonCount} delay reasons were recorded but could not be grouped.`
              : 'No delay reasons were recorded.'}
          </p>
        )}
      </Section>

      <p className="type-meta text-notice-muted">
        Charts are on the{' '}
        <Link to="/admin/operation" className="underline">
          KPI dashboard
        </Link>{' '}
        (Operation → KPI).
      </p>
    </div>
  );
};

/** One saved report with its loading and error states; used by the page and the dialog. */
export const KpiReportView: React.FC<{ reportId: string }> = ({ reportId }) => {
  const load = useKpiReport(reportId);

  return (
    <>
      {load.status === 'loading' && (
        <LoadingState label="Loading KPI report…" variant="section" className="py-20" />
      )}
      {load.status === 'not_found' && (
        <p className="type-body text-notice-secondary">This report could not be found.</p>
      )}
      {load.status === 'error' && (
        <p role="alert" className="type-body text-status-danger">
          The report could not be loaded. Please try again.
        </p>
      )}
      {load.status === 'loaded' && <ReportBody report={load.report} />}
    </>
  );
};

/** A saved weekly, monthly or quarterly KPI report on its own page (direct links). */
export const KpiReportPage: React.FC = () => {
  const { id = '' } = useParams();

  return (
    <AdminPage width="standard">
      <KpiReportView reportId={id} />
    </AdminPage>
  );
};
