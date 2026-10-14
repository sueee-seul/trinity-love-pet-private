import type { LiveCareData } from '../../types/liveCare';
import type { StayStatus, PetStay } from '../../types/stays';
import { localIsoDate } from './liveCareDates';

/** Where a stay is in time, which decides whether Live care may call itself live. */
export type StayPhase = 'upcoming' | 'in-progress' | 'ended';

// Live care only opens approved stays, so these are the only statuses it can meet.
const PHASE_BY_STATUS: Partial<Record<StayStatus, StayPhase>> = {
  approved: 'upcoming',
  staying_now: 'in-progress',
  stay_ended: 'ended',
};

/**
 * The phase of the stay on screen. The status the server sent with the parent's bookings wins
 * once they have loaded. The live care response only carries calendar days, so it is the
 * fallback, and it cannot tell the morning of pick-up day from the evening after the pet has
 * gone home.
 */
export function stayPhase(
  stayDays: Pick<LiveCareData, 'dropOffDate' | 'pickUpDate'>,
  booking: PetStay | undefined,
  now: Date = new Date(),
): StayPhase {
  const bookedPhase = booking ? PHASE_BY_STATUS[booking.status] : undefined;
  if (bookedPhase) return bookedPhase;

  // 'YYYY-MM-DD' strings sort the same way as the days they name.
  const today = localIsoDate(now);
  if (today < stayDays.dropOffDate) return 'upcoming';
  return today > stayDays.pickUpDate ? 'ended' : 'in-progress';
}

/** Every one of the parent's approved stays under way right now, the choices of the pet switcher. */
export function staysInProgress(stays: PetStay[]): PetStay[] {
  return stays.filter((stay) => stay.status === 'staying_now');
}

// The stay whose time is highest, or null for an empty list. The first one wins a tie.
function latestBy(stays: PetStay[], time: (stay: PetStay) => number): PetStay | null {
  return stays.reduce<PetStay | null>(
    (best, stay) => (best === null || time(stay) > time(best) ? stay : best),
    null,
  );
}

/**
 * The stay /parent/live-care opens when the link names none: the approved stay under way (the one
 * that started last, if several), else the approved one that ended last. A past stay beats one
 * still to come, because only the past one has any care to show. Requests the manager has not
 * approved never count. Null when there is neither; the server then picks, which also covers a
 * parent whose only approved stays are still to come.
 */
export function defaultLiveCareStay(stays: PetStay[]): PetStay | null {
  return (
    latestBy(staysInProgress(stays), (stay) => Date.parse(stay.dropOffAt)) ??
    latestBy(
      stays.filter((stay) => stay.status === 'stay_ended'),
      (stay) => Date.parse(stay.pickUpAt),
    )
  );
}
