// Response types for GET /api/petparent/home.
// Mirrors Backend/src/services/petparent.home.ts.
import type { GetReadyStay } from './getReady';
import type { StayStatus } from './stays';

export type HomeState = 'A' | 'B1' | 'B2' | 'C1' | 'C2';
export type ChecklistKey = 'agreement' | 'payment' | 'vaccination' | 'admission';

export interface ChecklistItem {
  key: ChecklistKey;
  label: string;
  status: 'done' | 'outstanding';
  /** Outstanding items open a page; admission verification has none yet. */
  tappable: boolean;
  /** Only on `vaccination`: the booking pets whose certificate is still missing. */
  bookingPetIds?: string[];
}

export interface HomePet {
  id: string;
  name: string;
  species: 'dog' | 'cat' | 'other';
  breed?: string;
  ageYears?: number;
  photoUrl?: string;
}

/** One booking's pets and dates, the part every stay card on the homepage shows. */
export interface StayGroupSummary {
  bookingId: string;
  confirmationNumber: string;
  dropOffAt: string;
  pickUpAt: string;
  nights: number;
  serviceType: string;
  pets: { bookingPetId: string; petId: string; name: string }[];
}

/** The two decisions an upcoming stay can be in; refused and cancelled ones are never upcoming. */
export type UpcomingStayStatus = Extract<StayStatus, 'waiting_for_review' | 'approved'>;

export interface UpcomingStay extends StayGroupSummary {
  /** 'approved' only once the manager approved every pet on the booking. */
  status: UpcomingStayStatus;
  daysToGo: number;
  checklist: ChecklistItem[];
}

/** A request the manager refused while its drop-off is still ahead. */
export interface RefusedRequest {
  bookingPetId: string;
  bookingId: string;
  petName: string;
  dropOffAt: string;
  pickUpAt: string;
  refusalReason: string | null;
  /** The first name of the manager who refused; null when none is recorded. */
  reviewerName: string | null;
}

/** A stay under way: the pets are at Wagstay now. */
export interface CurrentStay extends StayGroupSummary {
  /** Whole calendar days until pick-up, 0 on the pick-up day. */
  daysUntilPickUp: number;
}

export interface HomeData {
  state: HomeState;
  owner: { firstName: string | null };
  pets: HomePet[];
  hasPastStays: boolean;
  /** All active bookings still ahead of now, soonest drop-off first. */
  upcomingStays: UpcomingStay[];
  /** Bookings under way now (dropped off, not yet picked up), soonest pick-up first. */
  currentStays: CurrentStay[];
  /** Refused requests whose drop-off is still ahead, soonest first. */
  needsAttention: RefusedRequest[];
  /** Approved pets whose drop-off is at most 48 hours away, soonest first. */
  getReady: GetReadyStay[];
}
