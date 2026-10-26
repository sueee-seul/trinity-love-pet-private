import type { PortalCopy } from '../../i18n/portalLocale';
import type { BoardingPassStatus, StayStatus, PetStay, StaysTab } from '../../types/stays';

/**
 * The words a pet parent reads for each stay status, in each site language. The server decides
 * the status from the manager's decision and the clock; every page names it with these words (My
 * stays, booking details, Home, Live care and the pet pages), so one stay is never called two
 * things. The Chinese matches the /book pages ("waiting for review", "confirmed").
 */
export const STAY_STATUS_COPY: PortalCopy<Record<StayStatus, string>> = {
  en: {
    waiting_for_review: 'Waiting for review',
    approved: 'Confirmed',
    staying_now: 'Staying now',
    stay_ended: 'Stay ended',
    did_not_arrive: 'Did not arrive',
    refused: 'Not accepted',
    cancelled: 'Cancelled',
  },
  zh: {
    waiting_for_review: '等待审核',
    approved: '已确认',
    staying_now: '正在住宿',
    stay_ended: '住宿已结束',
    did_not_arrive: '未到店',
    refused: '未被接受',
    cancelled: '已取消',
  },
};

/** "View live care" is there only once an approved stay has started. It stays through and after
 * pick-up, so a parent can still look back at the last day of care. A request that is waiting,
 * refused or cancelled never had a pet in our care, so it has nothing to show. */
export function canViewCare(stay: Pick<PetStay, 'status'>): boolean {
  return stay.status === 'staying_now' || stay.status === 'stay_ended';
}

/** A boarding pass exists only once our manager approved the stay: the contract forms when that
 * approval reaches the parent. A request still waiting, refused or cancelled is not a booking, and
 * a pass for it would present it as one (Fair Trading Act s9, s11). */
export function hasBoardingPass<T extends { status: StayStatus }>(
  stay: T,
): stay is T & { status: BoardingPassStatus } {
  return (
    stay.status === 'approved' || stay.status === 'staying_now' || stay.status === 'stay_ended'
  );
}

const isClosedRequest = (status: StayStatus): boolean =>
  status === 'refused' || status === 'cancelled';

/** Which My stays tab a stay sits in. Upcoming holds an approved stay until it ends, a request
 * still waiting for review until its pick-up passes, and a refused or cancelled request while its
 * drop-off is ahead, so the parent sees the answer while it still matters. Past holds ended stays
 * and every request whose dates are over: an old refused, cancelled or never reviewed request
 * must not wait in Upcoming forever. */
export function stayTab(
  stay: Pick<PetStay, 'status' | 'dropOffAt' | 'pickUpAt'>,
  now: number = Date.now(),
): StaysTab {
  // A stay that ended, or that the desk recorded as a no-show, is over.
  if (stay.status === 'stay_ended' || stay.status === 'did_not_arrive') return 'past';
  if (stay.status === 'waiting_for_review') {
    return Date.parse(stay.pickUpAt) < now ? 'past' : 'upcoming';
  }
  return isClosedRequest(stay.status) && Date.parse(stay.dropOffAt) <= now ? 'past' : 'upcoming';
}
