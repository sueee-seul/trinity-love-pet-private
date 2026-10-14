import * as repo from '../repositories/petparent.stays.repository.js';
import type { StayStatus } from '../contracts/stay-status.contract.js';
import { nightsBetweenTimestamps } from './petparent.booking.js';
import { toStayStatus } from './stay-status.js';

export interface PetStaySummary {
  /** booking_pets.uuid. Pass this to GET /api/petparent/live-care/:bookingPetId. */
  bookingPetId: string;
  bookingId: string;
  /** Null once the parent has deleted the pet's profile. */
  petId: string | null;
  petName: string;
  petPhotoUrl?: string;
  facilityName?: string;
  type: 'BOARDING' | 'DAYCARE';
  status: StayStatus;
  dropOffAt: string;
  pickUpAt: string;
  nights: number;
  serviceType: string;
}

const toPetStaySummary = (row: repo.PetStayRow, now: Date): PetStaySummary => {
  const dropOff = row.drop_off_time ?? new Date();
  const pickUp = row.pick_up_time ?? dropOff;
  const sameDay = dropOff.toDateString() === pickUp.toDateString();

  const summary: PetStaySummary = {
    bookingPetId: row.booking_pet_id,
    bookingId: row.booking_id,
    petId: row.pet_id,
    petName: row.pet_name,
    type: sameDay ? 'DAYCARE' : 'BOARDING',
    status: toStayStatus(
      {
        reviewStatus: row.review_status,
        checkInOutcome: row.check_in_outcome,
        dropOffTime: row.drop_off_time,
        pickUpTime: row.pick_up_time,
      },
      now,
    ),
    dropOffAt: dropOff.toISOString(),
    pickUpAt: pickUp.toISOString(),
    nights: nightsBetweenTimestamps(dropOff, pickUp),
    serviceType: row.service_type ?? 'Boarding',
  };
  if (row.pet_photo_url) summary.petPhotoUrl = row.pet_photo_url;
  if (row.facility_name) summary.facilityName = row.facility_name;
  return summary;
};

/**
 * Every stay belonging to this pet parent's pets: upcoming, currently
 * active, and past alike. Not filtered by date; the frontend/chatbot decides
 * what subset (if any) it wants to show.
 */
export const getStaysForOwner = async (
  petOwnersUuid: string,
  now = new Date(),
): Promise<PetStaySummary[]> => {
  const rows = await repo.findStaysForOwner(petOwnersUuid);
  return rows.map((row) => toPetStaySummary(row, now));
};
