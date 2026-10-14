import React from 'react';

interface KpiChartPlaceholderProps {
  title: string;
  description?: string;
}

export const KpiChartPlaceholder: React.FC<KpiChartPlaceholderProps> = ({
  title,
  description = 'This chart is not ready yet.',
}) => {
  return (
    <div className="rounded-2xl border border-border-soft bg-surface-card p-5 shadow-card">
      <h3 className="type-button text-notice-primary">{title}</h3>
      <div className="mt-4 flex h-48 items-center justify-center rounded-xl border border-dashed border-border-soft">
        <p className="type-body text-notice-muted">{description}</p>
      </div>
    </div>
  );
};
