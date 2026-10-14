import type { ReactElement } from 'react';
import { usePortalCopy, usePortalLocale } from '../../i18n/portalLocale';
import { formatCareDay, formatCareWeekday, localIsoDate } from './liveCareDates';
import { LIVE_CARE_COPY } from './liveCareCopy';

interface DaySelectorProps {
  /** 'YYYY-MM-DD', drop-off through pick-up inclusive. */
  availableDates: string[];
  selectedDate: string;
  onSelect: (date: string) => void;
}

/**
 * Horizontal strip of day chips for a stay's date range. The days are a group of toggle buttons
 * rather than tabs: the day below is a whole section, not a tab panel, and plain buttons already
 * work with Tab and Enter without the arrow key contract that tabs promise.
 */
export function DaySelector({
  availableDates,
  selectedDate,
  onSelect,
}: DaySelectorProps): ReactElement {
  const locale = usePortalLocale();
  const copy = usePortalCopy(LIVE_CARE_COPY).day;
  const today = localIsoDate(new Date());
  return (
    <div role="group" aria-label={copy.daysGroup} className="-mx-1 flex gap-2 overflow-x-auto p-1">
      {availableDates.map((date) => {
        const isSelected = date === selectedDate;
        const dayLabel = formatCareDay(date, locale);
        return (
          <button
            key={date}
            type="button"
            aria-pressed={isSelected}
            onClick={(): void => onSelect(date)}
            className={`flex min-h-11 shrink-0 flex-col items-center rounded-xl border px-3 py-1.5 text-center transition-colors ${
              isSelected
                ? 'border-accent-foreground bg-surface-bubbles text-notice-primary'
                : 'border-border-soft bg-surface-card text-notice-muted hover:border-control-border hover:text-notice-primary'
            }`}
          >
            <span className="type-eyebrow tracking-wider">
              {date === today ? copy.today : formatCareWeekday(date, locale)}
            </span>
            <span className="type-meta font-bold text-current">{dayLabel}</span>
          </button>
        );
      })}
    </div>
  );
}
