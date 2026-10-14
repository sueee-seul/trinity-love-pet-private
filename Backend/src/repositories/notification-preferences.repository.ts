import { pool } from '../config/database.js';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationLocale,
  type NotificationPreferences,
  type NotificationPreferencesUpdate,
} from '../contracts/notification.preferences.contract.js';

/** One row per owner in `notification_preferences`; no row means the defaults. */

type SqlRunner = Pick<typeof pool, 'query'>;

interface PreferencesRow {
  locale: NotificationLocale;
  digest_hour: number;
  quiet_start: number;
  quiet_end: number;
  email_updates: boolean;
}

const toPreferences = (row: PreferencesRow): NotificationPreferences => ({
  locale: row.locale,
  digestHour: row.digest_hour,
  quietStart: row.quiet_start,
  quietEnd: row.quiet_end,
  emailUpdates: row.email_updates,
});

const SELECT = `SELECT locale, digest_hour, quiet_start, quiet_end, email_updates
                  FROM notification_preferences`;

/** The stored row, or null when the parent never saved any preference. */
export const readNotificationPreferences = async (
  ownerId: string,
  runner: SqlRunner = pool,
): Promise<NotificationPreferences | null> => {
  const result = await runner.query<PreferencesRow>(`${SELECT} WHERE pet_owners_uuid = $1::uuid`, [
    ownerId,
  ]);
  const row = result.rows[0];
  return row ? toPreferences(row) : null;
};

/**
 * Writes only the fields the parent changed: a missing field keeps its stored value, or takes the
 * default when the row is new. One statement, so two tabs saving at once cannot lose a field.
 */
export const upsertNotificationPreferences = async (
  ownerId: string,
  update: NotificationPreferencesUpdate,
  runner: SqlRunner = pool,
): Promise<NotificationPreferences> => {
  const defaults = DEFAULT_NOTIFICATION_PREFERENCES;
  const result = await runner.query<PreferencesRow>(
    `INSERT INTO notification_preferences
       (pet_owners_uuid, locale, digest_hour, quiet_start, quiet_end, email_updates)
     VALUES ($1::uuid, COALESCE($2::varchar, $7::varchar), COALESCE($3::smallint, $8::smallint),
             COALESCE($4::smallint, $9::smallint), COALESCE($5::smallint, $10::smallint),
             COALESCE($6::boolean, $11::boolean))
     ON CONFLICT (pet_owners_uuid) DO UPDATE SET
       locale        = COALESCE($2::varchar, notification_preferences.locale),
       digest_hour   = COALESCE($3::smallint, notification_preferences.digest_hour),
       quiet_start   = COALESCE($4::smallint, notification_preferences.quiet_start),
       quiet_end     = COALESCE($5::smallint, notification_preferences.quiet_end),
       email_updates = COALESCE($6::boolean, notification_preferences.email_updates),
       updated_at    = now()
     RETURNING locale, digest_hour, quiet_start, quiet_end, email_updates`,
    [
      ownerId,
      update.locale ?? null,
      update.digestHour ?? null,
      update.quietStart ?? null,
      update.quietEnd ?? null,
      update.emailUpdates ?? null,
      defaults.locale,
      defaults.digestHour,
      defaults.quietStart,
      defaults.quietEnd,
      defaults.emailUpdates,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new Error('notification_preferences upsert returned no row');
  return toPreferences(row);
};
