import { pool } from '../config/database.js';
import type { ManagerReviewStatus } from '../contracts/stay-status.contract.js';

// A "stay" is one `booking_pets` row, the same identity
// `parent.profile.repository.ts` uses for `Stay.id`. All day boundaries are
// read out in Pacific/Auckland, matching task.read.repository.ts /
// task.assignment.repository.ts.

export interface StayCandidateRow {
  bookingPetId: string;
  petUuid: string;
  dropOffTime: Date | null;
  pickUpTime: Date | null;
  reviewStatus: ManagerReviewStatus;
}

interface StayCandidateSqlRow {
  booking_pet_id: string;
  pet_uuid: string;
  drop_off_time: Date | null;
  pick_up_time: Date | null;
  review_status: ManagerReviewStatus;
}

// Every non-draft stay belonging to one of this owner's pets, used to pick
// "the" stay to show when no bookingPetId is given. The service keeps only the
// ones the manager approved.
export const findStayCandidatesForOwner = async (
  petOwnersUuid: string,
): Promise<StayCandidateRow[]> => {
  const result = await pool.query<StayCandidateSqlRow>(
    `SELECT bp.uuid::text AS booking_pet_id, bp.pet_uuid::text AS pet_uuid,
            bp.drop_off_time, bp.pick_up_time, bp.manager_review_status AS review_status
     FROM booking_pets bp
     JOIN bookings b ON b.uuid = bp.bookings_uuid
     JOIN pets p ON p.uuid = bp.pet_uuid
     WHERE p.pet_owners_uuid = $1::uuid AND b.status <> 'draft'`,
    [petOwnersUuid],
  );
  return result.rows.map((row) => ({
    bookingPetId: row.booking_pet_id,
    petUuid: row.pet_uuid,
    dropOffTime: row.drop_off_time,
    pickUpTime: row.pick_up_time,
    reviewStatus: row.review_status,
  }));
};

export interface StayRecord {
  bookingPetId: string;
  petOwnersUuid: string;
  petId: string;
  petName: string;
  petPhotoUrl: string | null;
  dropOffTime: Date | null;
  pickUpTime: Date | null;
  dropOffDate: string | null;
  pickUpDate: string | null;
  reviewStatus: ManagerReviewStatus;
}

interface StaySqlRow {
  booking_pet_id: string;
  pet_owners_uuid: string;
  pet_id: string;
  pet_name: string;
  pet_photo_url: string | null;
  drop_off_time: Date | null;
  pick_up_time: Date | null;
  drop_off_date: string | null;
  pick_up_date: string | null;
  review_status: ManagerReviewStatus;
}

// One stay by id, joined out to its owner/pet. It is used both to check
// ownership and to render the hero card. Draft bookings (never paid) have
// no live care to show, and the service turns away any stay the manager has
// not approved.
export const findStayById = async (bookingPetId: string): Promise<StayRecord | null> => {
  const result = await pool.query<StaySqlRow>(
    `SELECT bp.uuid::text AS booking_pet_id,
            p.pet_owners_uuid::text AS pet_owners_uuid,
            p.uuid::text AS pet_id,
            p.name AS pet_name,
            p.image_url AS pet_photo_url,
            bp.drop_off_time,
            bp.pick_up_time,
            to_char(bp.drop_off_time AT TIME ZONE 'Pacific/Auckland', 'YYYY-MM-DD') AS drop_off_date,
            to_char(bp.pick_up_time AT TIME ZONE 'Pacific/Auckland', 'YYYY-MM-DD') AS pick_up_date,
            bp.manager_review_status AS review_status
     FROM booking_pets bp
     JOIN bookings b ON b.uuid = bp.bookings_uuid
     JOIN pets p ON p.uuid = bp.pet_uuid
     WHERE bp.uuid = $1::uuid AND b.status <> 'draft'`,
    [bookingPetId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    bookingPetId: row.booking_pet_id,
    petOwnersUuid: row.pet_owners_uuid,
    petId: row.pet_id,
    petName: row.pet_name,
    petPhotoUrl: row.pet_photo_url,
    dropOffTime: row.drop_off_time,
    pickUpTime: row.pick_up_time,
    dropOffDate: row.drop_off_date,
    pickUpDate: row.pick_up_date,
    reviewStatus: row.review_status,
  };
};

export interface RosterRecord {
  sitterName: string | null;
  facilityName: string | null;
}

interface RosterSqlRow {
  sitter_name: string | null;
  facility_name: string | null;
}

// Who's rostered onto this pet, preferring the selected day's assignment,
// falling back to the most recent one. Same join shape as
// parent.profile.repository.ts's STAY_SELECT roster lookup.
export const findRosterForDate = async (
  petUuid: string,
  selectedDate: string,
): Promise<RosterRecord> => {
  const result = await pool.query<RosterSqlRow>(
    `SELECT COALESCE(u.display_name, u.username) AS sitter_name, f.name AS facility_name
     FROM employee_assignments ea
     JOIN employees e ON e.users_uuid = ea.employees_uuid
     JOIN users u ON u.uuid = ea.employees_uuid
     LEFT JOIN facilities f ON f.uuid = e.facility_uuid
     WHERE ea.pet_uuid = $1::uuid
     ORDER BY (ea.assignment_date = $2::date) DESC, ea.assignment_date DESC
     LIMIT 1`,
    [petUuid, selectedDate],
  );
  const row = result.rows[0];
  return { sitterName: row?.sitter_name ?? null, facilityName: row?.facility_name ?? null };
};

// Today's calendar date in the facility's timezone, used to default the day
// selector, matching the `NOW() AT TIME ZONE 'Pacific/Auckland'` convention
// task.read.repository.ts uses for "today".
export const getTodayInAuckland = async (): Promise<string> => {
  const result = await pool.query<{ today: string }>(
    `SELECT to_char(NOW() AT TIME ZONE 'Pacific/Auckland', 'YYYY-MM-DD') AS today`,
  );
  const today = result.rows[0]?.today;
  if (!today) throw new Error('Failed to resolve current date');
  return today;
};

export interface DayTaskPhotoRow {
  photo_url: string;
  caption: string | null;
}

export interface DayTaskRow {
  id: string;
  title: string;
  status: string;
  scheduled_at: Date;
  description: string | null;
  photos: DayTaskPhotoRow[];
}

// tasks + media_logs for one pet's one calendar day, bounded by the stay's
// own drop-off/pick-up window so an adjacent stay's tasks on a shared
// boundary day never leak in. This matches task.read.repository.ts's taskSelect
// shape, trimmed to only the columns live care actually renders.
export const findDayTasks = async (
  petUuid: string,
  dropOffTime: Date | null,
  pickUpTime: Date | null,
  selectedDate: string,
): Promise<DayTaskRow[]> => {
  const result = await pool.query<DayTaskRow>(
    `SELECT t.uuid::text AS id, t.title, t.status, t.scheduled_at, t.description,
            (SELECT COALESCE(
               json_agg(
                 json_build_object('photo_url', m.photo_url, 'caption', m.caption)
                 ORDER BY m.created_at
               ),
               '[]'::json
             )
             FROM media_logs m WHERE m.tasks_uuid = t.uuid) AS photos
     FROM tasks t
     WHERE t.pet_uuid = $1::uuid
       AND t.status <> 'cancelled'
       AND t.scheduled_at IS NOT NULL
       AND ($2::timestamptz IS NULL OR t.scheduled_at >= $2::timestamptz)
       AND ($3::timestamptz IS NULL OR t.scheduled_at <= $3::timestamptz)
       AND (t.scheduled_at AT TIME ZONE 'UTC')::date = $4::date
     ORDER BY t.scheduled_at`,
    [petUuid, dropOffTime, pickUpTime, selectedDate],
  );
  return result.rows;
};
