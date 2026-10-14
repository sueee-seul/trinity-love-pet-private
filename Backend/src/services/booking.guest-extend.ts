import type { PoolClient } from 'pg';
import { AppError } from '../common/middlewares/error.middleware.js';
import {
  formatNewZealandTime,
  newZealandDateOf,
  newZealandWallClockToDate,
} from '../common/utils/new-zealand-time.js';
import {
  EXTENSION_PRICE_CHANGED,
  type ExtendStayInput,
  type ExtensionPetLine,
  type ExtensionPreview,
  type ExtensionResult,
} from '../contracts/booking.change.contract.js';
import { CONCIERGE_MAX_STAY_NIGHTS } from '../contracts/concierge.contract.js';
import { lockBookingCapacity } from '../repositories/booking.capacity.repository.js';
import { movePickUp, readPetNamesForBooking } from '../repositories/booking.charges.repository.js';
import { pool } from '../config/database.js';
import { withLockedBooking } from '../repositories/booking.check-in.repository.js';
import { findFullNights, fullyBookedError } from './booking.capacity.js';
import { assertPreviewedAmount, type ChangeDependencies } from './booking.guest-change.js';
import { bookingNotFound } from './booking.guarantee.js';
import {
  aucklandNightsBetween,
  fromCents,
  nextChargeOrdinal,
  recordInStayCharge,
  settlementFor,
  stayUnderWay,
  toCents,
  type StayUnderWay,
} from './booking.in-stay.js';
import { notifyStayExtended } from './booking.in-stay.notifications.js';
import { createTasksForBookingPet } from './task.fromBooking.service.js';

/**
 * A parent keeping the pet a few more nights while it is here (Scenario 11: "can I extend the
 * stay by one night?"). The added nights are priced at the rates the stay booked (its per-night
 * lines, so the room and any daily food or walk), must have room, and are a separate row in the
 * ledger when the parent confirms: charged to the saved card, or, without one, added to the bill
 * for the desk at check-out. Each pet keeps its check-out time of day. The care plan gains the new days; task generation skips days it already has.
 */

const MS_PER_DAY = 86_400_000;

const daysBetween = (from: string, to: string): number =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / MS_PER_DAY);

const invalidEndDate = (currentEndDate: string): AppError =>
  new AppError(
    `Choose a check-out date after ${currentEndDate}, keeping the whole stay within ${CONCIERGE_MAX_STAY_NIGHTS} nights.`,
    'EXTENSION_DATES_INVALID',
    422,
  );

interface ExtensionPlan extends ExtensionPreview {
  newPickUpByPet: { bookingPetsUuid: string; pickUpAt: Date }[];
}

const planExtension = async (
  stay: StayUnderWay,
  endDate: string,
  petNames: Map<string, string>,
  client?: PoolClient,
): Promise<ExtensionPlan> => {
  const currentEndDate = newZealandDateOf(stay.pickUpAt);
  const addedNights = daysBetween(currentEndDate, endDate);
  const totalNights =
    aucklandNightsBetween(stay.dropOffAt, stay.pickUpAt) + Math.max(addedNights, 0);
  if (addedNights < 1 || totalNights > CONCIERGE_MAX_STAY_NIGHTS) {
    throw invalidEndDate(currentEndDate);
  }
  // The added nights are the ones the stay did not occupy yet: from the old leave day on.
  if (client) await lockBookingCapacity(client);
  const fullNights = await findFullNights(
    {
      startDate: currentEndDate,
      endDate,
      petCount: stay.pets.length,
      excludeBookingId: stay.booking.bookingId,
    },
    client,
  );
  if (fullNights.length > 0) throw fullyBookedError(fullNights);

  const pets: ExtensionPetLine[] = stay.pets.map((pet) => ({
    bookingPetId: pet.bookingPetsUuid,
    petName: petNames.get(pet.bookingPetsUuid) ?? 'your pet',
    nightlyRate: pet.nightlyRate,
    amount: fromCents(toCents(pet.nightlyRate) * addedNights),
  }));
  return {
    currentEndDate,
    newEndDate: endDate,
    addedNights,
    pets,
    amount: fromCents(pets.reduce((cents, pet) => cents + toCents(pet.amount), 0)),
    settlement: settlementFor(stay),
    newPickUpByPet: stay.pets.map((pet) => ({
      bookingPetsUuid: pet.bookingPetsUuid,
      pickUpAt: newZealandWallClockToDate(endDate, formatNewZealandTime(pet.pickUpAt)),
    })),
  };
};

const previewOf = (plan: ExtensionPlan): ExtensionPreview => ({
  currentEndDate: plan.currentEndDate,
  newEndDate: plan.newEndDate,
  addedNights: plan.addedNights,
  pets: plan.pets,
  amount: plan.amount,
  settlement: plan.settlement,
});

export interface ExtensionDependencies extends ChangeDependencies {
  /** Pet names by booking pet id, for the lines and the receipt; read from the booking by default. */
  petNames?: (bookingId: string) => Promise<Map<string, string>>;
}

export const previewExtension = async (
  ownerId: string,
  bookingId: string,
  endDate: string,
  dependencies: ExtensionDependencies = {},
): Promise<ExtensionPreview> => {
  const now = dependencies.now ?? new Date();
  const preview = await withLockedBooking(bookingId, async (booking, client) => {
    const stay = await stayUnderWay(booking, ownerId, now, client);
    const names = await (dependencies.petNames ?? readPetNames)(bookingId);
    return previewOf(await planExtension(stay, endDate, names));
  });
  if (!preview) throw bookingNotFound();
  return preview;
};

export const extendStay = async (
  ownerId: string,
  bookingId: string,
  input: ExtendStayInput,
  dependencies: ExtensionDependencies = {},
): Promise<ExtensionResult> => {
  const now = dependencies.now ?? new Date();
  const extended = await withLockedBooking(bookingId, async (booking, client) => {
    const stay = await stayUnderWay(booking, ownerId, now, client);
    const names = await (dependencies.petNames ?? readPetNames)(bookingId);
    const plan = await planExtension(stay, input.endDate, names, client);
    assertPreviewedAmount(
      input.expectedAmount,
      plan.amount,
      EXTENSION_PRICE_CHANGED,
      'The price of the extra nights has changed since you checked it. Please look at the new price and confirm again.',
    );
    const ordinal = nextChargeOrdinal(
      stay.charges,
      (charge) => charge.kind === 'extension' && charge.description.includes(plan.newEndDate),
    );
    const nights = plan.addedNights === 1 ? '1 night' : `${plan.addedNights} nights`;
    const { chargeId } = await recordInStayCharge(
      stay,
      {
        kind: 'extension',
        bookingPetsUuid: null,
        description: `Stay extended to ${plan.newEndDate}: ${nights} at the booked rates`,
        amount: plan.amount,
        idempotencyKey: `extend-${bookingId}-${plan.newEndDate}-${ordinal}`,
      },
      'the stay was not extended',
      client,
      dependencies.cardProcessor,
    );
    // One check-out time per pet keeps each pet's own time of day.
    for (const pet of plan.newPickUpByPet) {
      await movePickUp(client, bookingId, [pet.bookingPetsUuid], pet.pickUpAt);
    }
    return {
      result: { ...previewOf(plan), chargeId },
      petIds: stay.pets.map((p) => p.bookingPetsUuid),
    };
  });
  if (!extended) throw bookingNotFound();
  // The care plan for the new days: generation skips the days that already have their tasks.
  for (const bookingPetsUuid of extended.petIds) {
    await createTasksForBookingPet(bookingPetsUuid);
  }
  void notifyStayExtended(bookingId, extended.result);
  return extended.result;
};

const readPetNames = (bookingId: string): Promise<Map<string, string>> =>
  readPetNamesForBooking(pool, bookingId);
