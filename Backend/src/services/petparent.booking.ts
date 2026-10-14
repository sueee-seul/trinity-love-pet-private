import * as petparentRepository from '../repositories/petparent.booking.repository.js';
import { listBookingsForOwner } from '../repositories/petparent.booking.read.repository.js';
import {
  listPetFactsForOwner,
  type OwnerPetFactRows,
} from '../repositories/petparent.petFacts.repository.js';
import type { GetReadyTask } from '../contracts/get-ready.contract.js';
import type { ManagerReviewStatus, StayStatus } from '../contracts/stay-status.contract.js';
import { getReadyTasksFor, loadGetReadyFacts } from './petparent.getReady.js';
import { refusalReasonFor, reviewerNameFor, toStayStatus } from './stay-status.js';

/**
 * A saved pet as the booking page receives it (GET /api/petparent/pets), with what the account
 * already knows so the parent is not asked again. Mirrored by the frontend `Pet` type in
 * Frontend/src/features/pet-parent/types/booking.ts.
 */
export interface SavedPetRecord extends petparentRepository.BookingPetRecord {
  /**
   * false once the pet has finished a stay our manager approved. Otherwise null: the account
   * cannot tell (the pet may have stayed with us before this system), so it is never guessed.
   */
  firstTimeBoarding: false | null;
  /**
   * true while staff keep an active medication on file for the pet. Otherwise null: no record
   * does not prove the pet takes no medicine, so the booking page still asks.
   */
  needsMedication: true | null;
}

type SavedPetFacts = Pick<SavedPetRecord, 'firstTimeBoarding' | 'needsMedication'>;

/** Pure, so each fact is tested without a database. */
export const savedPetFacts = (
  petId: string,
  facts: OwnerPetFactRows,
  now: Date,
): SavedPetFacts => ({
  firstTimeBoarding: facts.stays.some(
    (stay) => stay.petId === petId && toStayStatus(stay, now) === 'stay_ended',
  )
    ? false
    : null,
  needsMedication: facts.activeMedicationPetIds.has(petId) ? true : null,
});

export const getPetsForOwner = async (
  petOwnersUuid: string,
  now = new Date(),
): Promise<SavedPetRecord[]> => {
  const [pets, facts] = await Promise.all([
    petparentRepository.listPetsForOwner(petOwnersUuid),
    listPetFactsForOwner(petOwnersUuid),
  ]);
  return pets.map((pet) => ({ ...pet, ...savedPetFacts(pet.id, facts, now) }));
};

export const getServiceCatalog = (): Promise<petparentRepository.BookingServiceRecord[]> =>
  petparentRepository.listServices();

// `bookings` has no human-facing code column, so it's derived deterministically
// from the booking id rather than stored separately. Exported: the homepage
// service and the concierge checkout reuse this rather than re-deriving it.
export const toConfirmationNumber = (bookingId: string): string =>
  `PB-${bookingId.replace(/-/g, '').slice(0, 6).toUpperCase()}`;

// Exported: the homepage service and the stays list both need the same
// night-count rule the bookings list below uses.
export const nightsBetweenTimestamps = (start: Date, end: Date): number =>
  Math.max(Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)), 1);

const serviceLineTotal = (
  priceAtBooking: number,
  priceUnit: string | null,
  nights: number,
  quantity: number,
): number => {
  const scalesWithNights = priceUnit === 'per night' || priceUnit === 'per day';
  const multiplier = scalesWithNights ? nights : 1;
  return priceAtBooking * multiplier * quantity;
};

export interface MyBookingServiceLine {
  id: string;
  name: string;
  quantity: number;
  /** Dollars for this line across the whole stay. 0 = included/free. */
  total: number;
}

export interface MyBookingCaringInfo {
  feedingRoutine: string;
  medInstruction: string;
  firstTimeBoarding: boolean | null;
  crateTrained: boolean | null;
  socialAllow: boolean | null;
  fullyVaccinated: boolean | null;
  behaveNHealth: string;
  others: string;
}

export interface MyBookingSummary {
  bookingPetId: string;
  bookingId: string;
  confirmationNumber: string;
  createdAt: string;
  /** `id` is null once the parent has deleted the pet's profile; the name is kept on the stay. */
  pet: { id: string | null; name: string; photoUrl?: string };
  dropOffAt: string;
  pickUpAt: string;
  /** What the parent reads, from the manager's decision and the clock. */
  status: StayStatus;
  /** The manager's decision itself (`booking_pets.manager_review_status`). */
  reviewStatus: ManagerReviewStatus;
  /** The manager's reason, only while the request is refused. */
  refusalReason: string | null;
  /** The first name of the manager who confirmed or refused; null when no manager decided. */
  reviewerName: string | null;
  nights: number;
  serviceType: string;
  services: MyBookingServiceLine[];
  caringInfo: MyBookingCaringInfo;
  total: number;
  /** The "Get ready" tasks, only while the stay is approved and has not started; otherwise null. */
  getReady: GetReadyTask[] | null;
}

const EMPTY_CARING_INFO: MyBookingCaringInfo = {
  feedingRoutine: '',
  medInstruction: '',
  firstTimeBoarding: null,
  crateTrained: null,
  socialAllow: null,
  fullyVaccinated: null,
  behaveNHealth: '',
  others: '',
};

// Every paid booking for this owner, one summary per `booking_pets` row,
// the same grain "My Stays" renders one card per, whatever the manager decided.
// `dropOffTime`/`pickUpTime` are only ever null if a row predates them being
// required at write time; such a row has nothing meaningful to show a pet
// parent, so it's skipped rather than surfaced with blank dates.
export const listMyBookings = async (
  petOwnersUuid: string,
  now = new Date(),
): Promise<MyBookingSummary[]> => {
  const [rows, getReadyFacts] = await Promise.all([
    listBookingsForOwner(petOwnersUuid),
    loadGetReadyFacts(petOwnersUuid, now),
  ]);

  const summaries: MyBookingSummary[] = [];
  for (const row of rows) {
    if (!row.dropOffTime || !row.pickUpTime) continue;

    const nights = nightsBetweenTimestamps(row.dropOffTime, row.pickUpTime);
    const services = row.services.map((s) => ({
      id: s.id,
      name: s.name,
      quantity: s.quantity,
      total: serviceLineTotal(s.priceAtBooking, s.priceUnit, nights, s.quantity),
    }));
    const boardingRate = row.services.find((s) => s.category === 'boarding_rate');
    const ci = row.caringInfo;

    const pet: MyBookingSummary['pet'] = { id: row.petId, name: row.petName };
    if (row.petPhotoUrl) pet.photoUrl = row.petPhotoUrl;
    const status = toStayStatus(row, now);

    summaries.push({
      bookingPetId: row.bookingPetId,
      bookingId: row.bookingId,
      confirmationNumber: toConfirmationNumber(row.bookingId),
      createdAt: row.createdAt.toISOString(),
      pet,
      dropOffAt: row.dropOffTime.toISOString(),
      pickUpAt: row.pickUpTime.toISOString(),
      status,
      reviewStatus: row.reviewStatus,
      refusalReason: refusalReasonFor(row.reviewStatus, row.refusalReason),
      reviewerName: reviewerNameFor(row.reviewStatus, row.reviewerName),
      nights,
      serviceType: boardingRate?.name ?? 'Boarding',
      services,
      caringInfo: ci
        ? {
            feedingRoutine: ci.feedingRoutine ?? '',
            medInstruction: ci.medInstruction ?? '',
            firstTimeBoarding: ci.firstTimeBoarding,
            crateTrained: ci.crateTrained,
            socialAllow: ci.socialAllow,
            fullyVaccinated: ci.fullyVaccinated,
            behaveNHealth: ci.behaveNHealth ?? '',
            others: ci.others ?? '',
          }
        : EMPTY_CARING_INFO,
      total: services.reduce((sum, s) => sum + s.total, 0),
      getReady: getReadyTasksFor(status, getReadyFacts.get(row.bookingPetId)),
    });
  }
  return summaries;
};
