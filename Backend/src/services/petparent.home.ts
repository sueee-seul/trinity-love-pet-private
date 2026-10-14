import { getCardProcessor } from './payments/card-processor.factory.js';
import {
  listPetsForOwner,
  type BookingPetRecord,
} from '../repositories/petparent.booking.repository.js';
import * as repo from '../repositories/petparent.home.repository.js';
import type { HomeStayRow } from '../repositories/petparent.home.repository.js';
import type { GetReadyStay } from '../contracts/get-ready.contract.js';
import type { StayStatus } from '../contracts/stay-status.contract.js';
import { nightsBetweenTimestamps, toConfirmationNumber } from './petparent.booking.js';
import { refusalReasonFor, reviewerNameFor, toStayStatus } from './stay-status.js';
import {
  getReadyStaysForHome,
  loadGetReadyFacts,
  type GetReadyFactsByStay,
} from './petparent.getReady.js';
import {
  buildChecklist,
  daysToGo,
  resolveHomeState,
  type ChecklistItem,
  type HomeState,
} from './petparent.home.logic.js';

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

/** A request the manager refused while its drop-off is still ahead, so other dates can still work. */
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

/** A stay under way: the pets are at Wagstay now, so the homepage points to Live Care. */
export interface CurrentStay extends StayGroupSummary {
  /** Whole calendar days until pick-up, 0 on the pick-up day. */
  daysUntilPickUp: number;
}

export interface HomeResponse {
  state: HomeState;
  owner: { firstName: string | null };
  pets: HomePet[];
  hasPastStays: boolean;
  /** All active bookings still ahead of `now`, soonest drop-off first. */
  upcomingStays: UpcomingStay[];
  /** Bookings under way at `now` (dropped off, not yet picked up), soonest pick-up first. */
  currentStays: CurrentStay[];
  /** Refused requests whose drop-off is still ahead, soonest first: "Needs your attention". */
  needsAttention: RefusedRequest[];
  /** Approved pets whose drop-off is at most 48 hours away, soonest first: "Get ready". */
  getReady: GetReadyStay[];
}

export interface BuildHomeInput {
  firstName: string | null;
  pets: BookingPetRecord[];
  stays: HomeStayRow[];
  getReadyFacts: GetReadyFactsByStay;
  now: Date;
}

const DEFAULT_SERVICE_TYPE = 'Boarding';

const toHomePet = (pet: BookingPetRecord): HomePet => {
  const home: HomePet = { id: pet.id, name: pet.name, species: pet.species };
  if (pet.breed !== undefined) home.breed = pet.breed;
  if (pet.age !== undefined) home.ageYears = pet.age;
  if (pet.imageUrl !== undefined) home.photoUrl = pet.imageUrl;
  return home;
};

const groupByBooking = (stays: HomeStayRow[]): HomeStayRow[][] => {
  const groups = new Map<string, HomeStayRow[]>();
  for (const stay of stays) {
    groups.set(stay.bookingId, [...(groups.get(stay.bookingId) ?? []), stay]);
  }
  return [...groups.values()];
};

const earliest = (dates: Date[]): Date => new Date(Math.min(...dates.map((d) => d.getTime())));
const latest = (dates: Date[]): Date => new Date(Math.max(...dates.map((d) => d.getTime())));

const firstOf = (group: HomeStayRow[]): HomeStayRow => {
  const first = group[0];
  if (!first) throw new Error('A booking group cannot be empty');
  return first;
};

const toStayGroupSummary = (group: HomeStayRow[]): StayGroupSummary => {
  const first = firstOf(group);
  const dropOff = earliest(group.map((stay) => stay.dropOffTime));
  const pickUp = latest(group.map((stay) => stay.pickUpTime));
  return {
    bookingId: first.bookingId,
    confirmationNumber: toConfirmationNumber(first.bookingId),
    dropOffAt: dropOff.toISOString(),
    pickUpAt: pickUp.toISOString(),
    nights: nightsBetweenTimestamps(dropOff, pickUp),
    serviceType: first.serviceType ?? DEFAULT_SERVICE_TYPE,
    pets: group.map((stay) => ({
      bookingPetId: stay.bookingPetId,
      petId: stay.petId,
      name: stay.petName,
    })),
  };
};

// A booking waits for review until the manager approved every pet on it, so the chip never
// promises a pet a place the manager has not given yet.
const groupStatus = (group: HomeStayRow[], now: Date): UpcomingStayStatus =>
  group.every((stay) => toStayStatus(stay, now) === 'approved') ? 'approved' : 'waiting_for_review';

const toUpcomingStay = (group: HomeStayRow[], now: Date): UpcomingStay => {
  const summary = toStayGroupSummary(group);
  return {
    ...summary,
    status: groupStatus(group, now),
    daysToGo: daysToGo(new Date(summary.dropOffAt), now),
    checklist: buildChecklist({
      hasAgreement: group.every((stay) => stay.hasAgreement),
      paymentSucceeded: group.every((stay) => stay.paymentSucceeded),
      cardSaved: group.every((stay) => stay.cardSaved === true),
      paymentTestMode: group.some((stay) => stay.paymentTestMode === true),
      approved: group.every((stay) => stay.reviewStatus === 'approved'),
      pets: group.map((stay) => ({
        bookingPetId: stay.bookingPetId,
        fullyVaccinated: stay.fullyVaccinated,
        hasVaccinationCertificate: stay.hasVaccinationCertificate,
      })),
    }),
  };
};

const toRefusedRequest = (stay: HomeStayRow): RefusedRequest => ({
  bookingPetId: stay.bookingPetId,
  bookingId: stay.bookingId,
  petName: stay.petName,
  dropOffAt: stay.dropOffTime.toISOString(),
  pickUpAt: stay.pickUpTime.toISOString(),
  refusalReason: refusalReasonFor(stay.reviewStatus, stay.refusalReason),
  reviewerName: reviewerNameFor(stay.reviewStatus, stay.reviewerName),
});

/**
 * Resolves the homepage from already-loaded data, one pet at a time by the manager's decision
 * (stay-status.ts). "Upcoming" is a pending or approved pet whose drop-off is ahead;
 * "past" is an approved stay that ended; a pending pet whose dates have come is neither, since
 * it was never booked in. A stay under way does not change the state, which describes the
 * booking history, and is listed in `currentStays` so the homepage can lead with it.
 */
export const buildHome = (input: BuildHomeInput): HomeResponse => {
  const { now } = input;
  const withStatus = (...statuses: StayStatus[]): HomeStayRow[] =>
    input.stays.filter((stay) => statuses.includes(toStayStatus(stay, now)));
  const isAhead = (stay: HomeStayRow): boolean => stay.dropOffTime.getTime() > now.getTime();

  const upcoming = withStatus('waiting_for_review', 'approved').filter(isAhead);
  const past = withStatus('stay_ended');
  const underWay = withStatus('staying_now');
  const needsAttention = withStatus('refused')
    .filter(isAhead)
    .sort((a, b) => a.dropOffTime.getTime() - b.dropOffTime.getTime())
    .map(toRefusedRequest);

  const upcomingGroups = groupByBooking(upcoming).sort(
    (a, b) =>
      earliest(a.map((s) => s.dropOffTime)).getTime() -
      earliest(b.map((s) => s.dropOffTime)).getTime(),
  );
  const upcomingStays = upcomingGroups.map((group) => toUpcomingStay(group, now));
  const currentStays = groupByBooking(underWay)
    .map((group): CurrentStay => {
      const summary = toStayGroupSummary(group);
      return { ...summary, daysUntilPickUp: daysToGo(new Date(summary.pickUpAt), now) };
    })
    .sort((a, b) => Date.parse(a.pickUpAt) - Date.parse(b.pickUpAt));

  return {
    state: resolveHomeState({
      petCount: input.pets.length,
      hasUpcomingStay: upcomingStays.length > 0,
      hasPastStays: past.length > 0,
    }),
    owner: { firstName: input.firstName },
    pets: input.pets.map(toHomePet),
    hasPastStays: past.length > 0,
    upcomingStays,
    currentStays,
    needsAttention,
    getReady: getReadyStaysForHome(input.stays, input.getReadyFacts, now),
  };
};

export const getHome = async (petOwnersUuid: string, now = new Date()): Promise<HomeResponse> => {
  const [firstName, pets, stays, getReadyFacts] = await Promise.all([
    repo.findOwnerFirstName(petOwnersUuid),
    listPetsForOwner(petOwnersUuid),
    repo.listHomeStays(petOwnersUuid, getCardProcessor()?.testMode ?? false),
    loadGetReadyFacts(petOwnersUuid, now),
  ]);

  return buildHome({ firstName, pets, stays, getReadyFacts, now });
};
