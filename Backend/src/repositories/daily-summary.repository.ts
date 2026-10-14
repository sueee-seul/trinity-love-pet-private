import { pool } from '../config/database.js';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationLocale,
} from '../contracts/notification.preferences.contract.js';
import type { SqlRunner } from './booking.capacity.repository.js';

/** The stored daily updates and stay reports (`daily_summaries`). */

export type SummaryKind = 'daily' | 'stay_report' | 'arrival';

export interface StayingPetForSummary {
  bookingPetsUuid: string;
  bookingId: string;
  ownerId: string;
  petUuid: string;
  petName: string;
  dropOffAt: Date;
  pickUpAt: Date;
  /** When the desk recorded the arrival; null for a stay checked in before that was recorded. */
  checkInRecordedAt: Date | null;
  /** The owner's notification preferences, or the defaults when they never set any. */
  locale: NotificationLocale;
  digestHour: number;
  quietStart: number;
  quietEnd: number;
  emailUpdates: boolean;
}

/**
 * Every pet in the facility right now: checked in, not yet picked up, on a confirmed booking. A
 * pet whose pick-up is earlier today is included until that time, so its last day still gets a
 * report when the job runs after it has gone home the same evening.
 */
export const listStayingPets = async (
  now: Date,
  runner: SqlRunner = pool,
): Promise<StayingPetForSummary[]> => {
  const result = await runner.query<{
    booking_pets_uuid: string;
    booking_id: string;
    owner_id: string;
    pet_uuid: string;
    pet_name: string;
    drop_off_time: Date;
    pick_up_time: Date;
    check_in_recorded_at: Date | null;
    locale: NotificationLocale;
    digest_hour: number;
    quiet_start: number;
    quiet_end: number;
    email_updates: boolean;
  }>(
    `SELECT bp.uuid::text AS booking_pets_uuid, b.uuid::text AS booking_id,
            b.pet_owners_uuid::text AS owner_id, bp.pet_uuid::text AS pet_uuid,
            COALESCE(p.name, bp.pet_name, 'your pet') AS pet_name,
            bp.drop_off_time, bp.pick_up_time, bp.check_in_recorded_at,
            COALESCE(np.locale, $2) AS locale,
            COALESCE(np.digest_hour, $3)::int AS digest_hour,
            COALESCE(np.quiet_start, $4)::int AS quiet_start,
            COALESCE(np.quiet_end, $5)::int AS quiet_end,
            COALESCE(np.email_updates, $6) AS email_updates
       FROM booking_pets bp
       JOIN bookings b ON b.uuid = bp.bookings_uuid
       LEFT JOIN pets p ON p.uuid = bp.pet_uuid
       LEFT JOIN notification_preferences np ON np.pet_owners_uuid = b.pet_owners_uuid
      WHERE bp.check_in_outcome = 'checked_in'
        AND bp.manager_review_status = 'approved'
        AND bp.drop_off_time <= $1::timestamptz
        AND (bp.pick_up_time AT TIME ZONE 'Pacific/Auckland')::date
              >= ($1::timestamptz AT TIME ZONE 'Pacific/Auckland')::date
      ORDER BY bp.drop_off_time`,
    [
      now,
      DEFAULT_NOTIFICATION_PREFERENCES.locale,
      DEFAULT_NOTIFICATION_PREFERENCES.digestHour,
      DEFAULT_NOTIFICATION_PREFERENCES.quietStart,
      DEFAULT_NOTIFICATION_PREFERENCES.quietEnd,
      DEFAULT_NOTIFICATION_PREFERENCES.emailUpdates,
    ],
  );
  return result.rows.map((row) => ({
    bookingPetsUuid: row.booking_pets_uuid,
    bookingId: row.booking_id,
    ownerId: row.owner_id,
    petUuid: row.pet_uuid,
    petName: row.pet_name,
    dropOffAt: row.drop_off_time,
    pickUpAt: row.pick_up_time,
    checkInRecordedAt: row.check_in_recorded_at,
    locale: row.locale,
    digestHour: row.digest_hour,
    quietStart: row.quiet_start,
    quietEnd: row.quiet_end,
    emailUpdates: row.email_updates,
  }));
};

export interface StoredSummary {
  id: string;
  bookingPetId: string;
  date: string;
  kind: SummaryKind;
  body: string;
  /** The language the body was written in: the owner's preference at the time. */
  locale: NotificationLocale;
  photoPath: string | null;
  facts: Record<string, unknown>;
  generatedAt: Date;
}

interface SummarySqlRow {
  id: string;
  booking_pets_uuid: string;
  summary_date: string;
  kind: SummaryKind;
  body: string;
  locale: NotificationLocale;
  photo_path: string | null;
  facts: Record<string, unknown>;
  generated_at: Date;
}

const toStored = (row: SummarySqlRow): StoredSummary => ({
  id: row.id,
  bookingPetId: row.booking_pets_uuid,
  date: row.summary_date,
  kind: row.kind,
  body: row.body,
  locale: row.locale,
  photoPath: row.photo_path,
  facts: row.facts,
  generatedAt: row.generated_at,
});

const SUMMARY_SELECT = `
  SELECT uuid::text AS id, booking_pets_uuid::text AS booking_pets_uuid,
         to_char(summary_date, 'YYYY-MM-DD') AS summary_date, kind, body, locale, photo_path, facts,
         generated_at
    FROM daily_summaries`;

export const hasSummary = async (
  bookingPetsUuid: string,
  date: string,
  kind: SummaryKind,
  runner: SqlRunner = pool,
): Promise<boolean> => {
  const result = await runner.query(
    `SELECT 1 FROM daily_summaries
      WHERE booking_pets_uuid = $1::uuid AND summary_date = $2::date AND kind = $3`,
    [bookingPetsUuid, date, kind],
  );
  return (result.rowCount ?? result.rows.length) > 0;
};

export interface NewSummary {
  bookingPetsUuid: string;
  date: string;
  kind: SummaryKind;
  body: string;
  locale: NotificationLocale;
  photoPath: string | null;
  facts: Record<string, unknown>;
}

/** Writes the summary once; a second write for the same day and kind is a no-op. */
export const insertSummary = async (
  summary: NewSummary,
  runner: SqlRunner = pool,
): Promise<StoredSummary | null> => {
  const result = await runner.query<SummarySqlRow>(
    `INSERT INTO daily_summaries
       (booking_pets_uuid, summary_date, kind, body, locale, photo_path, facts)
     VALUES ($1::uuid, $2::date, $3, $4, $5, $6, $7::jsonb)
     ON CONFLICT (booking_pets_uuid, summary_date, kind) DO NOTHING
     RETURNING uuid::text AS id, booking_pets_uuid::text AS booking_pets_uuid,
               to_char(summary_date, 'YYYY-MM-DD') AS summary_date, kind, body, locale, photo_path,
               facts, generated_at`,
    [
      summary.bookingPetsUuid,
      summary.date,
      summary.kind,
      summary.body,
      summary.locale,
      summary.photoPath,
      JSON.stringify(summary.facts),
    ],
  );
  const row = result.rows[0];
  return row ? toStored(row) : null;
};

/** Newest first: the stay report, then each day's update. */
export const listSummariesForStay = async (
  bookingPetsUuid: string,
  runner: SqlRunner = pool,
): Promise<StoredSummary[]> => {
  const result = await runner.query<SummarySqlRow>(
    `${SUMMARY_SELECT}
      WHERE booking_pets_uuid = $1::uuid
      ORDER BY summary_date DESC, kind DESC`,
    [bookingPetsUuid],
  );
  return result.rows.map(toStored);
};

export interface StayDayCounts {
  day: string;
  feedsDone: number;
  feedsPlanned: number;
  walks: number;
  play: number;
  photos: number;
}

/**
 * Completed care per Auckland day of the stay, for the "how the stay went" report. Titles follow
 * the booking generation (task.fromBooking.mapping.ts) and the add-on tasks.
 */
export const countCareByDay = async (
  petUuid: string,
  dropOffAt: Date,
  pickUpAt: Date,
  runner: SqlRunner = pool,
): Promise<StayDayCounts[]> => {
  const result = await runner.query<{
    day: string;
    feeds_done: number;
    feeds_planned: number;
    walks: number;
    play: number;
    photos: number;
  }>(
    `WITH days AS (
       SELECT t.title, t.status, (t.scheduled_at AT TIME ZONE 'UTC')::date AS day_date
         FROM tasks t
        WHERE t.pet_uuid = $1::uuid
          AND t.task_type = 'pet'
          AND t.status <> 'cancelled'
          AND (t.scheduled_at AT TIME ZONE 'UTC')::date
                BETWEEN ($2::timestamptz AT TIME ZONE 'Pacific/Auckland')::date
                    AND ($3::timestamptz AT TIME ZONE 'Pacific/Auckland')::date
     )
     SELECT to_char(d.day_date, 'YYYY-MM-DD') AS day,
            count(*) FILTER (WHERE d.title ILIKE 'Feeding%' AND d.status = 'completed')::int AS feeds_done,
            count(*) FILTER (WHERE d.title ILIKE 'Feeding%')::int AS feeds_planned,
            count(*) FILTER (WHERE d.title ILIKE '%walk%' AND d.status = 'completed')::int AS walks,
            count(*) FILTER (WHERE d.title ILIKE '%play%' AND d.status = 'completed')::int AS play,
            (SELECT count(*) FROM media_logs m JOIN tasks tt ON tt.uuid = m.tasks_uuid
              WHERE tt.pet_uuid = $1::uuid
                AND (tt.scheduled_at AT TIME ZONE 'UTC')::date = d.day_date)::int AS photos
       FROM days d
      GROUP BY d.day_date
      ORDER BY d.day_date`,
    [petUuid, dropOffAt, pickUpAt],
  );
  return result.rows.map((row) => ({
    day: row.day,
    feedsDone: row.feeds_done,
    feedsPlanned: row.feeds_planned,
    walks: row.walks,
    play: row.play,
    photos: row.photos,
  }));
};
