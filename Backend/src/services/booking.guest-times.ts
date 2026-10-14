import { AppError } from '../common/middlewares/error.middleware.js';
import { newZealandDateOf, newZealandWallClockToDate } from '../common/utils/new-zealand-time.js';
import type { ChangeTimesInput, ChangeTimesResult } from '../contracts/booking.change.contract.js';
import { setPetTimes } from '../repositories/booking.charges.repository.js';
import { isActivePet, withLockedBooking } from '../repositories/booking.check-in.repository.js';
import type { ChangeDependencies } from './booking.guest-change.js';
import { bookingNotFound } from './booking.guarantee.js';
import { notifyTimesChanged } from './booking.in-stay.notifications.js';

/**
 * A new drop-off or pick-up time of day on the booked dates (Scenario 11: pickup coordination).
 * Nights are counted in Auckland dates, so neither changes the price or the room count; it tells
 * staff when to expect the parent. The drop-off time can move until the pet arrives; the pick-up
 * time until the pet is collected.
 */

const timeInvalid = (what: string): AppError =>
  new AppError(`Choose a ${what} time that is still ahead.`, 'STAY_TIME_INVALID', 422);

export const changeStayTimes = async (
  ownerId: string,
  bookingId: string,
  bookingPetId: string,
  input: ChangeTimesInput,
  dependencies: ChangeDependencies = {},
): Promise<ChangeTimesResult> => {
  const now = dependencies.now ?? new Date();
  const changed = await withLockedBooking(bookingId, async (booking, client) => {
    if (booking.ownerId !== ownerId) throw bookingNotFound();
    const pet = booking.pets.find((candidate) => candidate.bookingPetsUuid === bookingPetId);
    if (!pet || !isActivePet(pet.reviewStatus) || !pet.dropOffAt || !pet.pickUpAt) {
      throw bookingNotFound();
    }
    let dropOffAt = pet.dropOffAt;
    let pickUpAt = pet.pickUpAt;
    if (input.dropOffTime !== undefined) {
      // Only before the pet is here: once staff recorded an arrival the drop-off is history.
      if (pet.outcome !== null || now.getTime() >= pet.dropOffAt.getTime()) {
        throw timeInvalid('check-in');
      }
      dropOffAt = newZealandWallClockToDate(newZealandDateOf(pet.dropOffAt), input.dropOffTime);
      if (dropOffAt.getTime() <= now.getTime()) throw timeInvalid('check-in');
    }
    if (input.pickUpTime !== undefined) {
      if (
        (pet.outcome !== null && pet.outcome !== 'checked_in') ||
        now.getTime() >= pet.pickUpAt.getTime()
      ) {
        throw timeInvalid('check-out');
      }
      pickUpAt = newZealandWallClockToDate(newZealandDateOf(pet.pickUpAt), input.pickUpTime);
      if (pickUpAt.getTime() <= now.getTime()) throw timeInvalid('check-out');
    }
    if (pickUpAt.getTime() <= dropOffAt.getTime()) throw timeInvalid('check-out');
    await setPetTimes(client, bookingId, bookingPetId, {
      ...(input.dropOffTime !== undefined ? { dropOffAt } : {}),
      ...(input.pickUpTime !== undefined ? { pickUpAt } : {}),
    });
    return { dropOffAt: dropOffAt.toISOString(), pickUpAt: pickUpAt.toISOString() };
  });
  if (!changed) throw bookingNotFound();
  void notifyTimesChanged(bookingId, bookingPetId, changed);
  return changed;
};
