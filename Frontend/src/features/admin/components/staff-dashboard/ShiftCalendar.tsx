import React, { useMemo, useState } from 'react';
import type { StaffDetailShift } from '../../types/staffDashboard';

interface ShiftCalendarProps {
  shifts: StaffDetailShift[];
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const ymd = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(
    2,
    '0',
  )}`;

export const ShiftCalendar: React.FC<ShiftCalendarProps> = ({ shifts }) => {
  const byDate = useMemo(() => {
    const map = new Map<string, StaffDetailShift>();
    shifts.forEach((shift) => map.set(shift.date, shift));
    return map;
  }, [shifts]);

  const initialMonth = useMemo(() => {
    const first = shifts[0]?.date;
    const base = first ? new Date(`${first}T00:00:00`) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  }, [shifts]);

  const [month, setMonth] = useState<Date>(initialMonth);

  const cells = useMemo(() => {
    const year = month.getFullYear();
    const m = month.getMonth();
    const offset = (new Date(year, m, 1).getDay() + 6) % 7; // monday based
    const start = new Date(year, m, 1 - offset);
    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      return { date, key: ymd(date), inMonth: date.getMonth() === m };
    });
  }, [month]);

  const monthLabel = month.toLocaleDateString('en-NZ', { month: 'short', year: 'numeric' });
  const step = (delta: number): void =>
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));

  return (
    <section className="rounded-2xl border border-border-soft bg-surface-card p-6 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label="Previous month"
          className="rounded-full border border-border-soft px-3 py-1 type-meta hover:bg-surface-cream"
        >
          ‹
        </button>
        <h3 className="type-card-title">Shift calendar: {monthLabel}</h3>
        <button
          type="button"
          onClick={() => step(1)}
          aria-label="Next month"
          className="rounded-full border border-border-soft px-3 py-1 type-meta hover:bg-surface-cream"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-px text-center">
        {WEEKDAYS.map((weekday) => (
          <div key={weekday} className="pb-2 type-meta">
            {weekday}
          </div>
        ))}
        {cells.map((cell) => {
          const shift = byDate.get(cell.key);
          return (
            <div
              key={cell.key}
              title={shift ? `${shift.start ?? '?'} to ${shift.finish ?? '?'}` : undefined}
              className={`flex min-h-14 flex-col items-center gap-1 rounded-lg p-1 ${
                cell.inMonth ? '' : 'opacity-30'
              }`}
            >
              <span className="type-meta">{cell.date.getDate()}</span>
              {shift && (
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: 'var(--color-status-success)' }}
                />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
