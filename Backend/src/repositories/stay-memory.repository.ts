import { pool } from '../config/database.js';
import type { NotificationLocale } from '../contracts/notification.preferences.contract.js';

/** Rows of `stay_memory_notes`: one note per pet per Auckland day of a stay. */

type SqlRunner = Pick<typeof pool, 'query'>;

export interface StayMemoryFacts {
  dayNumber: number;
  feedsDone: number;
  feedsPlanned: number;
  walks: number;
  play: number;
  dosesGiven: number;
  dosesPlanned: number;
  dosesNotGiven: number;
  photos: number;
  /** How many days in a row, this one included, the pet ate less than planned. */
  appetiteDownStreak: number;
  /** Days in a row with fewer walks and play sessions than the day before (stretch goal 2). */
  activityDownStreak?: number;
  /** Today's recorded weight, and the first one recorded this stay, in kilograms. */
  weightKg?: number | null;
  baselineWeightKg?: number | null;
  /** Whether the weight has already moved past the watch mark this stay (flagged once). */
  weightFlagged?: boolean;
}

export interface StoredMemoryNote {
  id: string;
  bookingPetId: string;
  date: string;
  locale: NotificationLocale;
  body: string;
  facts: StayMemoryFacts;
  generatedAt: Date;
}

interface NoteSqlRow {
  id: string;
  booking_pets_uuid: string;
  note_date: string;
  locale: NotificationLocale;
  body: string;
  facts: StayMemoryFacts;
  generated_at: Date;
}

const toStored = (row: NoteSqlRow): StoredMemoryNote => ({
  id: row.id,
  bookingPetId: row.booking_pets_uuid,
  date: row.note_date,
  locale: row.locale,
  body: row.body,
  facts: row.facts,
  generatedAt: row.generated_at,
});

const SELECT = `
  SELECT uuid::text AS id, booking_pets_uuid::text AS booking_pets_uuid,
         to_char(note_date, 'YYYY-MM-DD') AS note_date, locale, body, facts, generated_at
    FROM stay_memory_notes`;

export interface NewMemoryNote {
  bookingPetsUuid: string;
  date: string;
  locale: NotificationLocale;
  body: string;
  facts: StayMemoryFacts;
}

/** Writes the day's note once; a second write for the same day is a no-op. */
export const insertMemoryNote = async (
  note: NewMemoryNote,
  runner: SqlRunner = pool,
): Promise<StoredMemoryNote | null> => {
  const result = await runner.query<NoteSqlRow>(
    `INSERT INTO stay_memory_notes (booking_pets_uuid, note_date, locale, body, facts)
     VALUES ($1::uuid, $2::date, $3, $4, $5::jsonb)
     ON CONFLICT (booking_pets_uuid, note_date) DO NOTHING
     RETURNING uuid::text AS id, booking_pets_uuid::text AS booking_pets_uuid,
               to_char(note_date, 'YYYY-MM-DD') AS note_date, locale, body, facts, generated_at`,
    [note.bookingPetsUuid, note.date, note.locale, note.body, JSON.stringify(note.facts)],
  );
  const row = result.rows[0];
  return row ? toStored(row) : null;
};

/** The newest notes first, at most `limit`. */
export const listMemoryNotes = async (
  bookingPetsUuid: string,
  limit: number,
  runner: SqlRunner = pool,
): Promise<StoredMemoryNote[]> => {
  const result = await runner.query<NoteSqlRow>(
    `${SELECT} WHERE booking_pets_uuid = $1::uuid ORDER BY note_date DESC LIMIT $2::int`,
    [bookingPetsUuid, limit],
  );
  return result.rows.map(toStored);
};
