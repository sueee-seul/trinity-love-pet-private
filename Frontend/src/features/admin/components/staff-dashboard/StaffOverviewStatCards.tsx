import React from 'react';
import type { StaffOverviewTotals } from '../../types/staffDashboard';

interface staffOverviewStatCardsProps {
  totals: StaffOverviewTotals;
}

interface StatCard {
  key: string;
  label: string;
  value: number;
  hint?: string;
  alert?: boolean;
}

export const StaffOverviewStatCards: React.FC<staffOverviewStatCardsProps> = ({ totals }) => {
  const cards: StatCard[] = [
    {
      key: 'staff',
      label: 'Total staff',
      value: totals.staff,
      hint: `${totals.fullTime} full,${totals.partTime} part `,
    },
    { key: 'on-shift', label: 'On shift', value: totals.onShiftNow },
    {
      key: 'overdue',
      label: 'Overdue tasks',
      value: totals.overdueTasks,
      alert: totals.overdueTasks > 0,
    },
    { key: 'issues', label: 'Open issues', value: totals.openIssues, alert: totals.openIssues > 0 },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.key}
          className={`rounded-2xl border p-5 shadow-card ${
            card.alert
              ? 'border-status-danger/20 bg-status-danger/5'
              : 'border-border-soft bg-surface-card'
          }`}
        >
          <p className={`type-meta ${card.alert ? 'text-status-danger' : ''}`}>{card.label}</p>
          <p
            className={`mt-2 font-fraunces text-3xl font-bold ${
              card.alert ? 'text-status-danger' : 'text-notice-primary'
            }`}
          >
            {card.value}
          </p>
          {card.hint && <p className="type-meta mt-1">· {card.hint}</p>}
        </div>
      ))}
    </div>
  );
};
