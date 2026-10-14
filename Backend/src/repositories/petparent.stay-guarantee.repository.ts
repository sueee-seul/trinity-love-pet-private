import { pool } from '../config/database.js';
import type { CheckInOutcome } from '../contracts/booking.check-in.contract.js';
import { TERMS_VERSION_LABEL_SQL } from './booking.agreement.repository.js';
import {
  CARD_GUARANTEE_PROCESSORS,
  cardGuaranteeJoin,
  type CardGuaranteeStatus,
} from './booking.check-in.repository.js';

/**
 * What My stays needs beyond the stay itself, per booking pet: how the arrival went, the date
 * changes made, the terms the booking agreed to, and the saved card behind the booking.
 */

export interface StayGuaranteeRow {
  booking_pets_uuid: string;
  check_in_outcome: CheckInOutcome | null;
  reschedule_count: number;
  /** '' when the booking has no recorded agreement. */
  terms_version: string;
  card_status: CardGuaranteeStatus | null;
  card_amount: number | null;
  card_captured_amount: number | null;
  card_processor: string | null;
}

export const findStayGuarantees = async (petOwnersUuid: string): Promise<StayGuaranteeRow[]> => {
  const result = await pool.query<StayGuaranteeRow>(
    `SELECT bp.uuid::text AS booking_pets_uuid,
            bp.check_in_outcome,
            b.reschedule_count::int AS reschedule_count,
            COALESCE(${TERMS_VERSION_LABEL_SQL}, '') AS terms_version,
            guarantee.status AS card_status,
            guarantee.amount::float8 AS card_amount,
            guarantee.captured_amount::float8 AS card_captured_amount,
            guarantee.processor AS card_processor
       FROM booking_pets bp
       JOIN bookings b ON b.uuid = bp.bookings_uuid
       LEFT JOIN bookings_agreements ba ON ba.bookings_uuid = b.uuid
       LEFT JOIN terms_versions tv ON tv.uuid = ba.terms_versions_uuid
       ${cardGuaranteeJoin('$2')}
      -- Owned through the booking: a deleted pet's past stays still belong to this parent.
      WHERE b.pet_owners_uuid = $1::uuid AND b.status IN ('paid', 'confirmed')`,
    [petOwnersUuid, CARD_GUARANTEE_PROCESSORS],
  );
  return result.rows;
};
