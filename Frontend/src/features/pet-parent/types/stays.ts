import type { GetReadyTask } from './getReady';

/** The manager's decision on one booking pet (`booking_pets.manager_review_status`). */
export type ManagerReviewStatus = 'pending' | 'approved' | 'refused' | 'cancelled';

/** What a pet parent (and the staff pet list) reads for one stay. The server works it out from
 * the manager's decision, what the desk recorded on arrival and the clock
 * (Backend/src/services/stay-status.ts); the pages only put it into words
 * (components/stays/stayStatus.ts). Mirrors Backend/src/contracts/stay-status.contract.ts. */
export type StayStatus =
  | 'waiting_for_review'
  | 'approved'
  | 'staying_now'
  | 'stay_ended'
  | 'did_not_arrive'
  | 'refused'
  | 'cancelled';

/** The statuses a boarding pass exists for: every one follows the manager's approval. */
export type BoardingPassStatus = Extract<StayStatus, 'approved' | 'staying_now' | 'stay_ended'>;

export type StaysTab = 'upcoming' | 'past';

export interface StayPet {
  /** Null once the parent has deleted the pet's profile; the stay and its name stay on record. */
  id: string | null;
  name: string;
  /** Optional photo URL. When omitted, the avatar falls back to the pet's
   * initial instead of a broken image. */
  photoUrl?: string;
}

export interface StayServiceLine {
  id: string;
  name: string;
  quantity: number;
  /** Dollars for this line across the whole stay. 0 = included/free. */
  total: number;
}

/** Mirrors `booking_pets_caring_info`: the pet's care/intake details
 * captured during booking, camelCased as `MyBookingCaringInfo` returns them
 * from GET /api/petparent/bookings. */
export interface StayCaringInfo {
  feedingRoutine: string;
  medInstruction: string;
  firstTimeBoarding: boolean | null;
  crateTrained: boolean | null;
  socialAllow: boolean | null;
  fullyVaccinated: boolean | null;
  behaveNHealth: string;
  others: string;
}

export type StayCardStatus =
  'pending' | 'authorized' | 'succeeded' | 'canceled' | 'failed' | 'refunded';

/** The saved card behind a stay booked on the booking page (Backend petparent.stays-with-card.ts). */
export interface StayCard {
  status: StayCardStatus;
  amount: number;
  /** What check-in or a cancellation took (0: released in full); null until then. */
  capturedAmount: number | null;
  /** Stripe test keys or the development fake: no real money moves. */
  testMode: boolean;
  /** Agreed to the pay-at-request terms: held when sent, charged once every pet is decided. */
  paysAtRequest: boolean;
}

/** One pet's stay: the same grain as a `booking_pets` row, and the same
 * grain `PetStayCard` renders: even when a pet shared a booking with
 * another pet, each gets its own record with its own dates, services,
 * caring info, and total. */
export interface PetStay {
  bookingPetId: string;
  bookingId: string;
  /** The same human-facing code shown on the booking page's request
   * receipt, e.g. "PB-7K2Q9M". */
  confirmationNumber: string;
  /** ISO timestamp the booking was created at. */
  createdAt: string;
  pet: StayPet;
  /** ISO timestamps. */
  dropOffAt: string;
  pickUpAt: string;
  status: StayStatus;
  reviewStatus: ManagerReviewStatus;
  /** The manager's reason, only while the request is refused. */
  refusalReason: string | null;
  /** The first name of the manager who confirmed or refused; null when no manager decided. */
  reviewerName: string | null;
  nights: number;
  serviceType: string;
  services: StayServiceLine[];
  caringInfo: StayCaringInfo;
  total: number;
  /** The "Get ready" tasks, only while the stay is approved and has not started; otherwise null. */
  getReady: GetReadyTask[] | null;
  /** What the desk recorded on drop-off day. */
  checkInOutcome: 'checked_in' | 'no_show' | 'wagstay_unable' | null;
  /** Free date changes used on this booking; one is allowed. */
  /** Date changes the guest can still make; null when the stay's terms set no limit. */
  dateChangesLeft: number | null;
  /** Null for a stay booked without a saved card. */
  card: StayCard | null;
}

/** A stay our manager approved, the only kind that has a boarding pass. */
export type ApprovedPetStay = PetStay & { status: BoardingPassStatus };

export interface MyStaysPageProps {
  /** Overrides the API fetch, mainly for tests/storybook-style previews.
   * When omitted, stays are fetched from GET /api/petparent/bookings. */
  stays?: PetStay[];
  /** Called with the stay's `bookingPetId` when "View live care" is clicked.
   * Defaults to navigating to /parent/live-care/:bookingPetId. The button
   * only shows on an approved stay from drop-off on (see stayStatus.ts's
   * `canViewCare`); before that the card says when live care opens. */
  onViewCare?: (bookingPetId: string) => void;
  /** Called with the stay's `bookingPetId` when "Booking details" is
   * clicked. Defaults to opening the booking details modal. */
  onViewBookingDetails?: (bookingPetId: string) => void;
}
