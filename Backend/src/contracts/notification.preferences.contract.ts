import { z } from 'zod';

/**
 * How a pet parent wants to hear from us. Mirrored by
 * Frontend/src/features/pet-parent/types/notificationPreferences.ts.
 *
 * - `locale`: the language the daily update, the arrival note, the stay report and their emails
 *   are written in. The chat and the pages follow the browser's choice; this is for what we send.
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

/** What every parent had before preferences existed: English, 5 pm, quiet 10 pm to 7 am, email on. */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  locale: 'en',
  digestHour: 17,
  quietStart: 22,
  quietEnd: 7,
  emailUpdates: true,
};

const hourSchema = z.number().int().min(0).max(23);

export const notificationPreferencesUpdateSchema = z
  .object({
    locale: z.enum(NOTIFICATION_LOCALES).optional(),
    digestHour: hourSchema.optional(),
    quietStart: hourSchema.optional(),
    quietEnd: hourSchema.optional(),
    emailUpdates: z.boolean().optional(),
  })
  .strict()
  .refine((update) => Object.values(update).some((value) => value !== undefined), {
    message: 'Nothing to change',
  });

export type NotificationPreferencesUpdate = z.infer<typeof notificationPreferencesUpdateSchema>;

export interface NotificationPreferencesResponse {
  preferences: NotificationPreferences;
  /** False until the parent saves something: the defaults are then only a guess at their wishes. */
  saved: boolean;
}
