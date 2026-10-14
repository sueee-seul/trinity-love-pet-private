/**
 * How a pet parent wants to hear from us. Mirrors
 * Backend/src/contracts/notification.preferences.contract.ts, which is read and written at
 * /api/parent/profile/notification-preferences (see profile/notificationPreferencesApi.ts).
 *
 * - `locale`: the language the daily update, the arrival note, the stay report and their emails
 *   are written in. The pages follow the site language; this is for what we send.
 * - `digestHour`: the Auckland hour the day's update arrives (0 to 23).
 * - `quietStart`, `quietEnd`: Auckland hours between which nothing but a safety notice is sent.
 *   Equal values mean no quiet hours; a start after the end crosses midnight.
 * - `emailUpdates`: whether the updates are also emailed. The bell always has them.
 */

export const NOTIFICATION_LOCALES = ['en', 'zh'] as const;
export type NotificationLocale = (typeof NOTIFICATION_LOCALES)[number];

export interface NotificationPreferences {
  locale: NotificationLocale;
  digestHour: number;
  quietStart: number;
  quietEnd: number;
  emailUpdates: boolean;
}

/** Any subset of the preferences; the server wants at least one field and refuses an unknown one. */
export type NotificationPreferencesUpdate = Partial<NotificationPreferences>;

export interface NotificationPreferencesResponse {
  preferences: NotificationPreferences;
  /** False until the parent saves something: the defaults are then only a guess at their wishes. */
  saved: boolean;
}

/** What every parent had before preferences existed: English, 5 pm, quiet 10 pm to 7 am, email on. */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  locale: 'en',
  digestHour: 17,
  quietStart: 22,
  quietEnd: 7,
  emailUpdates: true,
};
