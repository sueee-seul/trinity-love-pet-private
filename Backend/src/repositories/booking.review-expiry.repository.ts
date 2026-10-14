import { pool } from '../config/database.js';
import {
  PAY_AT_REQUEST_TERMS_VERSION,
  TERMS_VERSION_LABEL_SQL,
} from './booking.agreement.repository.js';

/**
 * What the review job reads: requests still waiting for our manager near or past their deadline,
 * and pay-at-request bookings whose hold was never charged after the last decision (the processor
 * could not be reached then). Older bookings, made before pay at request, have no 24-hour window,
 * so a request nobody decided waits until its drop-off and is then released like any other.
 */

export interface WaitingRequest {
  bookingId: string;
  /**
   * Pay at request: 24 hours after the request, or the earliest waiting drop-off if sooner. Older
   * terms: the earliest waiting drop-off.
   */
  deadline: Date;
  /** Names of the pets still waiting, in booking order. */
  petNames: string[];
}

const PAY_AT_REQUEST_BOOKINGS = `
  SELECT b.uuid AS booking_id, b.created_at
    FROM bookings b
    JOIN bookings_agreements ba ON ba.bookings_uuid = b.uuid
    JOIN terms_versions tv ON tv.uuid = ba.terms_versions_uuid
   WHERE ${TERMS_VERSION_LABEL_SQL} >= $1`;

/** Requests whose deadline is at most `withinHours` away (or already past). */
export const findWaitingRequests = async (
  now: Date,
  reviewWindowHours: number,
  withinHours: number,
): Promise<WaitingRequest[]> => {
  const result = await pool.query<{ booking_id: string; deadline: Date; pet_names: string[] }>(
    `WITH waiting AS (
       SELECT b.uuid AS booking_id,
              CASE WHEN COALESCE(${TERMS_VERSION_LABEL_SQL}, '') >= $1
                   THEN LEAST(b.created_at + make_interval(hours => $2::int), MIN(bp.drop_off_time))
                   ELSE MIN(bp.drop_off_time)
              END AS deadline,
              -- A pet whose profile was deleted keeps the name it was booked under.
              array_agg(COALESCE(pet.name, bp.pet_name) ORDER BY bp.created_at, bp.uuid)
                AS pet_names
         FROM bookings b
         JOIN booking_pets bp ON bp.bookings_uuid = b.uuid
         LEFT JOIN pets pet ON pet.uuid = bp.pet_uuid
         LEFT JOIN bookings_agreements ba ON ba.bookings_uuid = b.uuid
         LEFT JOIN terms_versions tv ON tv.uuid = ba.terms_versions_uuid
        WHERE bp.manager_review_status = 'pending'
          AND b.status IN ('paid', 'confirmed')
        GROUP BY b.uuid, b.created_at, tv.content
     )
     SELECT booking_id::text, deadline, pet_names
       FROM waiting
      WHERE deadline <= $3::timestamptz + make_interval(hours => $4::int)
      ORDER BY deadline`,
    [PAY_AT_REQUEST_TERMS_VERSION, reviewWindowHours, now, withinHours],
  );
  return result.rows.map((row) => ({
    bookingId: row.booking_id,
    deadline: row.deadline,
    petNames: row.pet_names,
  }));
};

/** Decided requests whose full-price hold still stands uncharged. */
export const findUnchargedDecidedRequests = async (): Promise<string[]> => {
  const result = await pool.query<{ booking_id: string }>(
    `WITH pay_at_request AS (${PAY_AT_REQUEST_BOOKINGS})
     SELECT p.booking_id::text
       FROM pay_at_request p
       JOIN booking_payments pay ON pay.bookings_uuid = p.booking_id
      WHERE pay.status = 'authorized'
        AND NOT EXISTS (
          SELECT 1 FROM booking_pets bp
           WHERE bp.bookings_uuid = p.booking_id AND bp.manager_review_status = 'pending'
        )`,
    [PAY_AT_REQUEST_TERMS_VERSION],
  );
  return result.rows.map((row) => row.booking_id);
};
