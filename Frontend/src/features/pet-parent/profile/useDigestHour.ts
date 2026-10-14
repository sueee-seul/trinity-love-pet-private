import { useEffect, useState } from 'react';
import { fetchNotificationPreferences } from './notificationPreferencesApi';

/** The facility's default update hour (docs/daily-updates.md), until the parent's own is known. */
export const DEFAULT_DIGEST_HOUR = 17;

/**
 * The hour the parent chose for the day's update on My account, read once; the default until the
 * answer lands and when it fails, so a page never waits on it. Used by the Live care waiting line,
 * which says when today's update comes.
 */
export function useDigestHour(): number {
  const [hour, setHour] = useState(DEFAULT_DIGEST_HOUR);

  useEffect((): (() => void) => {
    let current = true;
    fetchNotificationPreferences()
      .then((response) => {
        if (current) setHour(response.preferences.digestHour);
      })
      .catch(() => {
        // The default hour stands; My account says when the settings themselves fail to load.
      });
    return (): void => {
      current = false;
    };
  }, []);

  return hour;
}
