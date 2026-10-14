import React, { useState } from 'react';
import { SegmentedControl } from '../../../../shared/components/ui/SegmentedControl';
import { useStaffDetail } from '../../hooks/useStaffDetail';
import { ShiftCalendar } from './ShiftCalendar';
import type { DashboardRange, StaffDetailCompletion } from '../../types/staffDashboard';

interface StaffDetailPanelProps {
  staffId: string;
  initialRange: DashboardRange;
  onBack: () => void;
}

const RANGE_OPTIONS: { value: DashboardRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This Month' },
];

const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

const formatTime = (iso: string | null): string => {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleTimeString('en-NZ', { hour: 'numeric', minute: '2-digit' });
};

const formatRelativeDay = (iso: string | null): string => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const startOf = (d: Date): number =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOf(new Date()) - startOf(date)) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString('en-NZ', { month: 'short', day: 'numeric' });
};

const formatOverdue = (minutes: number | null): string => {
  if (minutes === null || minutes <= 0) return '';
  if (minutes < 60) return `Overdue ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `Overdue ${hours}h` : `Overdue ${hours}h ${rest}m`;
};

const PAGE_SIZE = 3;

const Pager: React.FC<{ page: number; totalPages: number; onChange: (page: number) => void }> = ({
  page,
  totalPages,
  onChange,
}) => {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-3 flex items-center justify-center gap-3">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, page - 1))}
        disabled={page === 0}
        aria-label="Previous page"
        className="rounded-full border border-border-soft px-3 py-1 type-meta disabled:opacity-30 hover:bg-surface-cream"
      >
        ‹
      </button>
      <span className="type-meta">
        {page + 1} / {totalPages}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(totalPages - 1, page + 1))}
        disabled={page === totalPages - 1}
        aria-label="Next page"
        className="rounded-full border border-border-soft px-3 py-1 type-meta disabled:opacity-30 hover:bg-surface-cream"
      >
        ›
      </button>
    </div>
  );
};

const CompletionDonut: React.FC<{ completion: StaffDetailCompletion }> = ({ completion }) => {
  const { done, overdue, pending, rate } = completion;
  const total = done + overdue + pending || 1;
  const radius = 52;
  const circumference = 2 * Math.PI * radius;

  const segments = [
    { color: 'var(--color-status-success)', value: done },
    { color: 'var(--color-status-danger)', value: overdue },
    { color: 'var(--color-theme-honey)', value: pending },
  ];

  const rings = segments.map((segment, index) => {
    const length = (segment.value / total) * circumference;
    const prior = segments
      .slice(0, index)
      .reduce((sum, prev) => sum + (prev.value / total) * circumference, 0);
    return {
      color: segment.color,
      dash: `${length} ${circumference - length}`,
      offset: -prior,
    };
  });

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center">
      <svg viewBox="0 0 140 140" className="h-56 w-56 -rotate-90">
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke="var(--color-border-soft)"
          strokeWidth="14"
        />
        {rings.map((ring) => (
          <circle
            key={ring.color}
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke={ring.color}
            strokeWidth="14"
            strokeDasharray={ring.dash}
            strokeDashoffset={ring.offset}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="font-fraunces type-numeral text-display font-bold text-notice-primary">
          {rate}%
        </p>
        <p className="type-meta">Completion rate</p>
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 type-meta">
        <span>
          <span
            className="mr-1 inline-block h-2 w-2 rounded-full align-middle"
            style={{ background: 'var(--color-status-success)' }}
          />
          {done} done
        </span>
        <span>
          <span
            className="mr-1 inline-block h-2 w-2 rounded-full align-middle"
            style={{ background: 'var(--color-status-danger)' }}
          />
          {overdue} overdue
        </span>
        <span>
          <span
            className="mr-1 inline-block h-2 w-2 rounded-full align-middle"
            style={{ background: 'var(--color-theme-honey)' }}
          />
          {pending} pending
        </span>
      </div>
    </div>
  );
};

export const StaffDetailPanel: React.FC<StaffDetailPanelProps> = ({
  staffId,
  initialRange,
  onBack,
}) => {
  const { data, loading, error, range, setRange } = useStaffDetail(staffId, initialRange);
  const [issuesPage, setIssuesPage] = useState(0);
  const [taskPage, setTasksPage] = useState(0);

  return (
    <div className="animate-in fade-in duration-300 space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="type-meta text-notice-secondary transition-colors hover:text-accent-foreground"
      >
        ‹ Back to team
      </button>

      {loading && !data && <p className="type-body text-notice-muted">Loading…</p>}
      {error && (
        <p role="alert" className="type-body text-status-danger">
          {error}
        </p>
      )}

      {data && (
        <div className={`space-y-6 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-surface-bubbles font-fraunces type-card-title text-theme-earth">
              {initialsOf(data.staff.name)}
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="type-title type-card-title">{data.staff.name}</h2>
                <span className="rounded-full bg-surface-bubbles px-2.5 py-0.5 type-eyebrow uppercase text-theme-earth">
                  {data.staff.role ?? 'staff'}
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 type-eyebrow uppercase ${
                    data.staff.onShift
                      ? 'bg-status-success/12 text-status-success'
                      : 'bg-surface-deep text-notice-secondary'
                  }`}
                >
                  {data.staff.onShift ? 'On shift' : 'Off shift'}
                </span>
              </div>
              <p className="type-meta mt-0.5">
                {data.staff.email}
                {data.staff.employeeNumber ? ` · ${data.staff.employeeNumber}` : ''}
                {data.staff.employmentType ? ` · ${data.staff.employmentType}` : ''}
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-border-soft bg-surface-card p-6 shadow-card flex h-full flex-col">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h3 className="type-card-title">Task completion</h3>
                <SegmentedControl options={RANGE_OPTIONS} value={range} onChange={setRange} />
              </div>
              <CompletionDonut completion={data.completion} />
            </section>

            <section className="rounded-2xl border border-border-soft bg-surface-card p-6 shadow-card">
              <h3 className="type-card-title">Recent issues</h3>
              {data.recentIssues.length === 0 ? (
                <p className="mt-3 type-meta">No recent issues.</p>
              ) : (
                ((): React.ReactElement => {
                  const totalPages = Math.max(1, Math.ceil(data.recentIssues.length / PAGE_SIZE));
                  const currentPage = Math.min(issuesPage, totalPages - 1);
                  const visible = data.recentIssues.slice(
                    currentPage * PAGE_SIZE,
                    currentPage * PAGE_SIZE + PAGE_SIZE,
                  );
                  return (
                    <>
                      <ul className="mt-3 space-y-3">
                        {visible.map((issue) => (
                          <li
                            key={issue.id}
                            className="border-b border-border-soft pb-3 last:border-0 last:pb-0"
                          >
                            <div className="flex items-center gap-2">
                              {issue.flagged && (
                                <span className="rounded-full bg-status-warning/15 px-2 py-0.5 type-eyebrow uppercase text-theme-earth">
                                  Flagged
                                </span>
                              )}
                              <span className="type-meta">{formatRelativeDay(issue.at)}</span>
                            </div>
                            <p className="mt-1 type-body">{issue.issue}</p>
                          </li>
                        ))}
                      </ul>
                      <Pager page={currentPage} totalPages={totalPages} onChange={setIssuesPage} />
                    </>
                  );
                })()
              )}
            </section>
          </div>

          <section className="rounded-2xl border border-border-soft bg-surface-card p-6 shadow-card">
            <h3 className="type-card-title">Today&apos;s tasks</h3>
            {data.todaysTasks.length === 0 ? (
              <p className="mt-3 type-meta">Nothing scheduled today.</p>
            ) : (
              ((): React.ReactElement => {
                const totalTaskPages = Math.max(1, Math.ceil(data.todaysTasks.length / PAGE_SIZE));
                const currentTaskPage = Math.min(taskPage, totalTaskPages - 1);
                const visibleTasks = data.todaysTasks.slice(
                  currentTaskPage * PAGE_SIZE,
                  currentTaskPage * PAGE_SIZE + PAGE_SIZE,
                );
                return (
                  <>
                    <ul className="mt-3 divide-y divide-border-soft">
                      {visibleTasks.map((task) => {
                        const overdueText = task.overdue ? formatOverdue(task.overdueMinutes) : '';
                        const where = [task.petName, task.location].filter(Boolean).join(' · ');
                        return (
                          <li
                            key={task.id}
                            className={`flex flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-2.5 ${
                              task.overdue ? 'bg-status-danger/5' : ''
                            }`}
                          >
                            <span
                              className={`type-body ${task.overdue ? 'text-status-danger' : ''}`}
                            >
                              {task.title}
                              {where && <span className="type-meta">{` (${where})`}</span>}
                            </span>
                            <span
                              className={`type-meta ${task.overdue ? 'text-status-danger' : ''}`}
                            >
                              {overdueText || formatTime(task.scheduledAt)}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    <Pager
                      page={currentTaskPage}
                      totalPages={totalTaskPages}
                      onChange={setTasksPage}
                    />
                  </>
                );
              })()
            )}
          </section>

          <ShiftCalendar shifts={data.shiftCalendar} />
        </div>
      )}
    </div>
  );
};
