import type { StayStatus } from '../types/stays';
import { stayTab } from '../components/stays/stayStatus';
import type { Stay } from './types';

/** The badge tone of each status, matching the tints My stays uses for the same states. The
 * words come from STAY_STATUS_COPY in components/stays/stayStatus.ts, so each stay row, which
 * links to My stays, names the stay the way My stays does. */
export const STAY_STATUS_TONES = {
  waiting_for_review: 'warning',
  approved: 'accent',
  staying_now: 'success',
  stay_ended: 'muted',
  did_not_arrive: 'muted',
  refused: 'danger',
  cancelled: 'danger',
} as const satisfies Record<StayStatus, string>;

/** A stay that is happening now, is booked to happen, or waits for the manager to decide. It
 * uses the My stays Upcoming rule (stayTab), without the refused or cancelled requests, so a
 * request whose dates passed unreviewed is never shown as the pet's next stay. */
export function isCurrentOrUpcoming(stay: Stay, now: number = Date.now()): boolean {
  if (stay.status === 'refused' || stay.status === 'cancelled') return false;
  return (
    stayTab({ status: stay.status, dropOffAt: stay.startAt, pickUpAt: stay.endAt }, now) ===
    'upcoming'
  );
}
