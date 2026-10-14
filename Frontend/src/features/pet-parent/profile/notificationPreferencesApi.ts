import { API_BASE_URL } from '../../../shared/api';
import {
  NOTIFICATION_LOCALES,
  type NotificationPreferencesResponse,
  type NotificationPreferencesUpdate,
} from '../types/notificationPreferences';
import { ParentProfileApiError, isRecord, jsonInit, messageFrom } from './parentProfileApi';

/**
 * A pet parent's own notification preferences:
 *
 *   GET /api/parent/profile/notification-preferences
 *   PUT /api/parent/profile/notification-preferences   body: any subset of the fields
 *
 * Both answer `{ preferences, saved }`. Whose preferences they are comes from the session cookie;
 * the client never names the parent. A value the server refuses answers 400 with its reason.
 */

const PREFERENCES_URL = `${API_BASE_URL}/parent/profile/notification-preferences`;

const isHour = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 23;

const isPreferencesResponse = (payload: unknown): payload is NotificationPreferencesResponse =>
  isRecord(payload) &&
  typeof payload.saved === 'boolean' &&
  isRecord(payload.preferences) &&
  (NOTIFICATION_LOCALES as readonly unknown[]).includes(payload.preferences.locale) &&
  isHour(payload.preferences.digestHour) &&
  isHour(payload.preferences.quietStart) &&
  isHour(payload.preferences.quietEnd) &&
  typeof payload.preferences.emailUpdates === 'boolean';

const parsePreferences = async (
  response: Response,
  fallback: string,
): Promise<NotificationPreferencesResponse> => {
  if (!response.ok) {
    throw new ParentProfileApiError(await messageFrom(response, fallback), response.status);
  }
  const payload: unknown = await response.json();
  if (!isPreferencesResponse(payload)) {
    throw new ParentProfileApiError('The server sent notification settings it could not read', 500);
  }
  return payload;
};

export const fetchNotificationPreferences = async (): Promise<NotificationPreferencesResponse> => {
  const response = await fetch(PREFERENCES_URL, { credentials: 'include' });
  return parsePreferences(response, 'Could not load your notification settings');
};

/** Saves the fields given and leaves the rest as they are. */
export const updateNotificationPreferences = async (
  update: NotificationPreferencesUpdate,
): Promise<NotificationPreferencesResponse> => {
  const response = await fetch(PREFERENCES_URL, jsonInit('PUT', update));
  return parsePreferences(response, 'Could not save your notification settings');
};
