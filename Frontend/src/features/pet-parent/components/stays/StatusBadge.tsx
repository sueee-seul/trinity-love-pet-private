import type { ReactElement } from 'react';
import { usePortalCopy } from '../../i18n/portalLocale';
import type { StayStatus } from '../../types/stays';
import { STATUS_PILL, STATUS_TONE } from '../home/homeStyles';
import { STAY_STATUS_COPY } from './stayStatus';

interface StatusBadgeProps {
  status: StayStatus;
  /** Replaces the default wording, for a page that describes the same state in its own words
   * (Live care says "Not started" for an approved stay that has not begun). */
  label?: string;
}

// Every pair keeps its text at 4.5:1 or more on the tint behind it, and the label always says the
// status in words, so the colour is never the only signal.
const STATUS_STYLES: Record<StayStatus, string> = {
  waiting_for_review: STATUS_TONE.neutral,
  approved: 'bg-accent-foreground/10 text-accent-foreground',
  staying_now: STATUS_TONE.success,
  stay_ended: 'bg-surface-deep text-notice-secondary',
  did_not_arrive: 'bg-surface-deep text-notice-secondary',
  refused: 'bg-status-danger/10 text-status-danger',
  cancelled: 'bg-status-danger/10 text-status-danger',
};

export function StatusBadge({ status, label }: StatusBadgeProps): ReactElement {
  const statusLabels = usePortalCopy(STAY_STATUS_COPY);
  const isLive = status === 'staying_now';
  return (
    <span className={`${STATUS_PILL} gap-1.5 ${STATUS_STYLES[status]}`}>
      {/* One dot style for every status; only a stay under way pulses, because it is live. */}
      <span className="relative flex h-2 w-2" aria-hidden="true">
        {isLive && (
          <span className="absolute inline-flex h-full w-full rounded-full bg-current opacity-60 motion-safe:animate-ping" />
        )}
        <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
      </span>
      {label ?? statusLabels[status]}
    </span>
  );
}
