import React, { useMemo, useState } from 'react';
import type { StaffOverviewRow } from '../../types/staffDashboard';

interface StaffOverviewListProps {
  staff: StaffOverviewRow[];
  onSelect: (staffId: string) => void;
}

const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

const StatCell: React.FC<{ label: string; value: React.ReactNode; alert?: boolean }> = ({
  label,
  value,
  alert,
}) => (
  <div className="text-right">
    <p className={`type-meta ${alert ? 'text-status-danger' : ''}`}>{label}</p>
    <p
      className={`type-body font-semibold ${alert ? 'text-status-danger' : 'text-notice-primary'}`}
    >
      {value}
    </p>
  </div>
);

export const StaffOverviewList: React.FC<StaffOverviewListProps> = ({ staff, onSelect }) => {
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return staff;
    return staff.filter((member) =>
      [member.name, member.email, member.role ?? '', member.employeeNumber ?? '']
        .join(' ')
        .toLowerCase()
        .includes(trimmed),
    );
  }, [staff, query]);

  return (
    <section className="rounded-2xl border border-border-soft bg-surface-card p-6 shadow-card">
      <label className="block">
        <span className="sr-only">Search the team</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name, email or employee role"
          className="w-full rounded-full border border-field-border bg-surface-cream px-5 py-2.5 type-body focus:border-control-border focus:outline-none focus:ring-2 focus:ring-focus"
        />
      </label>

      {visible.length === 0 ? (
        <p className="mt-6 type-body text-notice-muted">
          {query.trim() ? 'No one matches your search.' : 'No staff for this range.'}
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {visible.map((member) => {
            const flagged = member.overdue > 0 || member.issues > 0;
            return (
              <li key={member.id}>
                <button
                  type="button"
                  onClick={() => onSelect(member.id)}
                  className={`flex w-full items-center gap-x-6 gap-y-3 rounded-xl px-4 py-3 text-left transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-focus ${
                    flagged ? 'bg-status-danger/5' : 'bg-surface-cream'
                  }`}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-bubbles type-eyebrow text-theme-earth">
                    {initialsOf(member.name)}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="type-body font-medium">{member.name}</p>
                      <span className="rounded-full bg-surface-bubbles px-2.5 py-0.5 type-eyebrow uppercase text-theme-earth">
                        {member.role ?? 'staff'}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 type-eyebrow uppercase ${
                          member.onShift
                            ? 'bg-status-success/12 text-status-success'
                            : 'bg-surface-deep text-notice-secondary'
                        }`}
                      >
                        {member.onShift ? 'On shift' : 'Off shift'}
                      </span>
                    </div>
                    <p className="type-meta mt-0.5 break-words">
                      {member.email}
                      {member.employeeNumber ? ` · ${member.employeeNumber}` : ''}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-6">
                    <StatCell
                      label="Tasks done"
                      value={`${member.tasksDone} / ${member.tasksTotal}`}
                    />
                    <StatCell label="Overdue" value={member.overdue} alert={member.overdue > 0} />
                    <StatCell label="Issues" value={member.issues} alert={member.issues > 0} />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
