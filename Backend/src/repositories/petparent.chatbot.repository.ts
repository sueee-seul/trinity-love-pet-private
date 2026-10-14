import { pool } from '../config/database.js';
import type { CheckInOutcome } from '../contracts/booking.check-in.contract.js';
import type { ManagerReviewStatus } from '../contracts/stay-status.contract.js';
import type { BookingServiceCategory } from './petparent.booking.repository.js';

// Real-data reads for the AI chatbot's context resolver and answer generator
// (see docs/pet-parent-ai-chatbot-architecture.md). Pet listing itself is not
// duplicated here: petparent.booking.repository.ts's listPetsForOwner()
// already returns it in the shape the resolver needs.

export interface ChatbotBookingRow {
  bookingPetId: string;
  petUuid: string;
  dropOffTime: Date | null;
  pickUpTime: Date | null;
  reviewStatus: ManagerReviewStatus;
  /** What the desk recorded on arrival; null until then. */
  checkInOutcome: CheckInOutcome | null;
}

interface ChatbotBookingSqlRow {
  booking_pet_id: string;
  pet_uuid: string;
  drop_off_time: Date | null;
  pick_up_time: Date | null;
  review_status: ManagerReviewStatus;
  check_in_outcome: CheckInOutcome | null;
}

/**
 * Every non-draft booking (one row per booking_pets) across a set of pets,
 * fetched in one query so the resolver's guardrails can be evaluated for
 * every pet named or compared in a single turn without N+1 round trips.
 */
export const findChatbotBookingsForPets = async (
  petUuids: string[],
): Promise<ChatbotBookingRow[]> => {
  if (petUuids.length === 0) return [];
  const result = await pool.query<ChatbotBookingSqlRow>(
    `SELECT bp.uuid::text AS booking_pet_id,
            bp.pet_uuid::text AS pet_uuid,
            bp.drop_off_time,
            bp.pick_up_time,
            bp.manager_review_status AS review_status,
            bp.check_in_outcome
     FROM booking_pets bp
     JOIN bookings b ON b.uuid = bp.bookings_uuid
     WHERE bp.pet_uuid = ANY($1::uuid[]) AND b.status <> 'draft'
     ORDER BY bp.drop_off_time`,
    [petUuids],
  );
  return result.rows.map((row) => ({
    bookingPetId: row.booking_pet_id,
    petUuid: row.pet_uuid,
    dropOffTime: row.drop_off_time,
    pickUpTime: row.pick_up_time,
    reviewStatus: row.review_status,
    checkInOutcome: row.check_in_outcome,
  }));
};

export interface ChatbotCaringInfoRow {
  feeding_routine: string | null;
  medication_instructions: string | null;
  first_time_boarding: boolean | null;
  crate_trained: boolean | null;
  other_notes: string | null;
  allows_socialization: boolean | null;
  fully_vaccinated: boolean | null;
  behavior_and_health_notes: string | null;
}

/** The 1:1 caring-info extension row for one stay, or null if none was ever recorded. */
export const findChatbotCaringInfo = async (
  bookingPetId: string,
): Promise<ChatbotCaringInfoRow | null> => {
  const result = await pool.query<ChatbotCaringInfoRow>(
    `SELECT feeding_routine, medication_instructions, first_time_boarding, crate_trained,
            other_notes, allows_socialization, fully_vaccinated, behavior_and_health_notes
     FROM booking_pets_caring_info
     WHERE booking_pets_uuid = $1::uuid`,
    [bookingPetId],
  );
  return result.rows[0] ?? null;
};

export interface ChatbotServiceRow {
  name: string;
  category: BookingServiceCategory;
}

/** What's booked for one stay: the boarding rate, food arrangement, and any add-ons. */
export const findChatbotServicesForBooking = async (
  bookingPetId: string,
): Promise<ChatbotServiceRow[]> => {
  const result = await pool.query<ChatbotServiceRow>(
    `SELECT s.name, s.category
     FROM booking_pets_services bps
     JOIN services s ON s.uuid = bps.services_uuid
     WHERE bps.booking_pets_uuid = $1::uuid`,
    [bookingPetId],
  );
  return result.rows;
};
