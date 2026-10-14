import type { ReactNode } from 'react';

type DashboardPanelProps = {
  title: string;
  children: ReactNode;
};

export function DashboardPanel({ title, children }: DashboardPanelProps): ReactNode {
  return (
    <section className="rounded-xl border border-border-soft bg-surface-card p-4 shadow-card">
      <h2 className="mb-3 type-card-title text-notice-primary">{title}</h2>
      {children}
    </section>
  );
}
