import { pool } from '../config/database.js';
import type {
  StayChangeRequestDetails,
  StayChangeRequestKind,
  StayChangeRequestStatus,
} from '../contracts/booking.change.contract.js';

// Rows of `stay_change_requests` (20261014_stay_change_requests.sql): a parent's request to change
// a stay under way, waiting for a manager's decision.

export interface StayChangeRequestRow {
  uuid: string;
  bookings_uuid: string;
  booking_pets_uuid: string | null;
  pet_owners_uuid: string;
  kind: StayChangeRequestKind;
  /** Stored without `kind`, which has its own column. */
  details: Record<string, unknown>;
  quoted_amount: string | null;
  status: StayChangeRequestStatus;
  refusal_reason: string | null;
  decided_by_uuid: string | null;
  decided_at: Date | null;
  created_at: Date;
}

/** A row with what the manager's list needs: the owner's name and the booking's pet names. */
export interface ManagerStayChangeRequestRow extends StayChangeRequestRow {
  owner_name: string;
  pet_names: string[];
}

const COLUMNS = `r.uuid::text, r.bookings_uuid::text, r.booking_pets_uuid::text,
  r.pet_owners_uuid::text, r.kind, r.details, r.quoted_amount, r.status, r.refusal_reason,
  r.decided_by_uuid::text, r.decided_at, r.created_at`;

export interface NewStayChangeRequest {
  bookingId: string;
  bookingPetId: string | null;
  ownerId: string;
  details: StayChangeRequestDetails;
  quotedAmount: number | null;
}

export const insertStayChangeRequest = async (
  request: NewStayChangeRequest,
): Promise<StayChangeRequestRow> => {
  const { kind, ...details } = request.details;
  const result = await pool.query<StayChangeRequestRow>(
    `INSERT INTO stay_change_requests AS r
       (bookings_uuid, booking_pets_uuid, pet_owners_uuid, kind, details, quoted_amount)
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5::jsonb, $6)
     RETURNING ${COLUMNS}`,
    [
      request.bookingId,
      request.bookingPetId,
      request.ownerId,
      kind,
      JSON.stringify(details),
      request.quotedAmount,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new Error('Stay change request insert returned no row');
  return row;
};

export const findStayChangeRequest = async (
  requestId: string,
): Promise<StayChangeRequestRow | null> => {
  const result = await pool.query<StayChangeRequestRow>(
    `SELECT ${COLUMNS} FROM stay_change_requests r WHERE r.uuid = $1::uuid`,
    [requestId],
  );
  return result.rows[0] ?? null;
};

/** The parent's own requests, newest first. */
export const listOwnerStayChangeRequests = async (
  ownerId: string,
): Promise<StayChangeRequestRow[]> => {
  const result = await pool.query<StayChangeRequestRow>(
    `SELECT ${COLUMNS} FROM stay_change_requests r
      WHERE r.pet_owners_uuid = $1::uuid
      ORDER BY r.created_at DESC
      LIMIT 100`,
    [ownerId],
  );
  return result.rows;
};

/** The manager's list: waiting requests oldest first, or every request newest first. */
export const listManagerStayChangeRequests = async (
  onlyPending: boolean,
): Promise<ManagerStayChangeRequestRow[]> => {
  const result = await pool.query<ManagerStayChangeRequestRow>(
    `SELECT ${COLUMNS},
            COALESCE(NULLIF(TRIM(CONCAT_WS(' ', po.first_name, po.last_name)), ''), u.display_name, u.username) AS owner_name,
            ARRAY(
              SELECT COALESCE(p.name, bp.pet_name, 'your pet')
                FROM booking_pets bp
                LEFT JOIN pets p ON p.uuid = bp.pet_uuid
               WHERE bp.bookings_uuid = r.bookings_uuid
                 AND (r.booking_pets_uuid IS NULL OR bp.uuid = r.booking_pets_uuid)
               ORDER BY bp.created_at, bp.uuid
            ) AS pet_names
       FROM stay_change_requests r
       JOIN users u ON u.uuid = r.pet_owners_uuid
       LEFT JOIN pet_owners po ON po.users_uuid = r.pet_owners_uuid
      WHERE ($1::boolean = FALSE OR r.status = 'pending')
      ORDER BY CASE WHEN $1::boolean THEN r.created_at END ASC,
               r.created_at DESC
      LIMIT 200`,
    [onlyPending],
  );
  return result.rows;
};

/**
 * Moves a waiting request to its decision. Only a request still waiting moves, so two managers
 * pressing at once decide it once; null means it was already decided or withdrawn.
 */
export const decideStayChangeRequest = async (
  requestId: string,
  decision: {
    status: 'approved' | 'refused' | 'cancelled';
    deciderId: string | null;
    reason?: string;
  },
): Promise<StayChangeRequestRow | null> => {
  const result = await pool.query<StayChangeRequestRow>(
    `UPDATE stay_change_requests AS r
        SET status = $2, decided_by_uuid = $3::uuid, decided_at = now(), refusal_reason = $4
      WHERE r.uuid = $1::uuid AND r.status = 'pending'
      RETURNING ${COLUMNS}`,
    [requestId, decision.status, decision.deciderId, decision.reason ?? null],
  );
  return result.rows[0] ?? null;
};

/** Puts an approval back to waiting when the change could not be made after all. */
export const reopenStayChangeRequest = async (requestId: string): Promise<void> => {
  await pool.query(
    `UPDATE stay_change_requests
        SET status = 'pending', decided_by_uuid = NULL, decided_at = NULL, refusal_reason = NULL
      WHERE uuid = $1::uuid AND status = 'approved'`,
    [requestId],
  );
};

/** The owner of a booking and whether the pet is on it; null when either is missing. */
export const findBookingOwnerForPet = async (
  bookingId: string,
  bookingPetId: string,
): Promise<string | null> => {
  const result = await pool.query<{ owner: string }>(
    `SELECT b.pet_owners_uuid::text AS owner
       FROM bookings b
       JOIN booking_pets bp ON bp.bookings_uuid = b.uuid
      WHERE b.uuid = $1::uuid AND bp.uuid = $2::uuid`,
    [bookingId, bookingPetId],
  );
  return result.rows[0]?.owner ?? null;
};
