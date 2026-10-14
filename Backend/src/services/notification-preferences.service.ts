import { newZealandHourOf } from '../common/utils/new-zealand-time.js';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
  type NotificationPreferencesResponse,
  type NotificationPreferencesUpdate,
} from '../contracts/notification.preferences.contract.js';
import {
  readNotificationPreferences,
  upsertNotificationPreferences,
} from '../repositories/notification-preferences.repository.js';

/**
 * A parent's notification preferences, and the one rule every proactive notice obeys: nothing but
 * a safety notice inside the parent's quiet hours. The daily update ignores quiet hours because the
 * parent chose its hour themselves.
 */

export const preferencesForOwner = async (
  ownerId: string,
): Promise<NotificationPreferencesResponse> => {
  const stored = await readNotificationPreferences(ownerId);
  return stored
    ? { preferences: stored, saved: true }
    : { preferences: { ...DEFAULT_NOTIFICATION_PREFERENCES }, saved: false };
};

export const updatePreferencesForOwner = async (
  ownerId: string,
  update: NotificationPreferencesUpdate,
): Promise<NotificationPreferencesResponse> => ({
  preferences: await upsertNotificationPreferences(ownerId, update),
  saved: true,
});

/**
 * Whether `now` falls inside the quiet hours, on the Auckland clock. 22 to 7 crosses midnight and
 * covers 22:00 to 06:59; 13 to 15 covers 13:00 to 14:59; equal hours mean no quiet time at all.
 */
export const isQuietHour = (
  preferences: Pick<NotificationPreferences, 'quietStart' | 'quietEnd'>,
  now: Date,
): boolean => {
  const { quietStart, quietEnd } = preferences;
  if (quietStart === quietEnd) return false;
  const hour = newZealandHourOf(now);
  return quietStart < quietEnd
    ? hour >= quietStart && hour < quietEnd
    : hour >= quietStart || hour < quietEnd;
};
