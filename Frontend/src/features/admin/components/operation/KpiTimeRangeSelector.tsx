import React from 'react';

/**
 * Time range selector for the KPI dashboard.
 * The dashboard always operates on today's data; the selected range
 * determines how many days of history are shown (ending today).
 *
 * - `'today'` → only today's data (1 day)
 * - `'7d'`    → last 7 days ending today
 * - `'30d'`   → last 30 days ending today
 * - `'90d'`   → last 90 days ending today
 */
export type KpiRange = 'today' | '7d' | '30d' | '90d';

/**
 * Time range selector component rendered in the KPI dashboard header.
 * Shows a set of toggle buttons for selecting the date range.
 *
 * @param value    - The currently selected range.
 * @param onChange - Callback invoked when the user selects a new range.
 * @param disabled - When true, all buttons are non-interactive.
 */
interface KpiTimeRangeSelectorProps {
  value: KpiRange;
  onChange: (range: KpiRange) => void;
  disabled?: boolean;
}

const RANGE_OPTIONS: readonly { value: KpiRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
];

export const KpiTimeRangeSelector: React.FC<KpiTimeRangeSelectorProps> = ({
  value,
  onChange,
  disabled,
}) => {
  return (
    <div className="inline-flex rounded-xl border border-control-border bg-surface-card p-1">
      {RANGE_OPTIONS.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            disabled={disabled}
            className={`min-h-[2.25rem] rounded-lg px-4 type-button transition-colors ${
              isActive
                ? 'bg-surface-cream text-accent-foreground shadow-sm'
                : 'text-notice-secondary hover:text-accent-foreground disabled:cursor-wait disabled:opacity-60'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};
