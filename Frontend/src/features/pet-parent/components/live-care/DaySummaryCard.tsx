import type { ReactElement } from 'react';
import { usePortalCopy } from '../../i18n/portalLocale';
import type { CareEntry, RingStyle, StatTile } from '../../types/liveCare';
import { LIVE_CARE_COPY } from './liveCareCopy';

interface DaySummaryCardProps {
  entries: CareEntry[];
  stats: StatTile[];
}

// The server sends title case labels ("Potty Breaks"); the portal writes labels in sentence case.
function sentenceCase(label: string): string {
  return label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
}

/** How far through the chosen day's care the sitter is: a progress ring and the day's stat tiles.
 * The ring uses the named classes from ringConnectorStyles.ts, not Tailwind utilities. */
export function DaySummaryCard({ entries, stats }: DaySummaryCardProps): ReactElement {
  const completed = entries.filter((entry) => entry.status === 'completed').length;
  const total = entries.length;
  const pct = total > 0 ? Math.round((completed / total) * 1000) / 10 : 0;
  // A task still waiting for its time cannot be "next at" anything, as on the staff pages.
  const nextUpcoming = entries.find(
    (entry): entry is CareEntry & { time: string } =>
      entry.status === 'upcoming' && entry.time !== null,
  );
  const copy = usePortalCopy(LIVE_CARE_COPY).day;

  return (
    <div className="rounded-2xl border border-border-soft bg-surface-card p-4 shadow-card sm:p-5">
      <div className="flex items-center gap-4">
        {/* The sentence beside the ring says the same thing in words. */}
        <div
          className="care-progress-ring"
          style={{ '--pct': pct } as RingStyle}
          aria-hidden="true"
        >
          <div className="care-progress-ring-inner type-meta font-bold text-notice-primary">
            {completed}/{total}
          </div>
        </div>
        <div className="min-w-0">
          <p className="type-body m-0 font-bold">{copy.activitiesDone(completed, total)}</p>
          <p className="type-meta m-0 mt-0.5">
            {nextUpcoming ? copy.nextActivity(nextUpcoming.title, nextUpcoming.time) : copy.allDone}
          </p>
        </div>
      </div>

      <dl className="m-0 mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col-reverse items-center gap-1 rounded-xl border border-border-soft bg-surface-cream/50 px-2 py-3 text-center"
          >
            <dt className="type-meta leading-tight">{sentenceCase(stat.label)}</dt>
            <dd className="m-0 font-fraunces text-card-title font-bold text-notice-primary">
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
