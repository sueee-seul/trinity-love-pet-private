import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  NotificationPreferences,
  NotificationPreferencesUpdate,
} from '../types/notificationPreferences';
import {
  fetchNotificationPreferences,
  updateNotificationPreferences,
} from './notificationPreferencesApi';

/** What the last change did. 'failed' keeps the change so Try again can send the same one. */
export type NotificationPreferencesSave =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'saved' }
  | { status: 'failed'; update: NotificationPreferencesUpdate };

export type NotificationPreferencesState =
  | { status: 'loading' }
  | { status: 'failed'; retry: () => void }
  | {
      status: 'ready';
      preferences: NotificationPreferences;
      save: NotificationPreferencesSave;
      /** Saves the fields given at once; the control shows the choice while the server answers. */
      change: (update: NotificationPreferencesUpdate) => void;
      /** Sends the change that failed again. */
      retrySave: () => void;
    };

/** The server's answer to one load attempt; the hook is loading until the answer is for the current one. */
type Answer =
  | { attempt: number; status: 'failed' }
  | { attempt: number; status: 'ready'; preferences: NotificationPreferences };

/**
 * Loads the parent's notification preferences and saves each change as it is made. Only the newest
 * save may change the state: two quick changes answer in any order, and the last one sent carries
 * the server's whole record, so an earlier answer landing late would show stale values.
 */
export function useNotificationPreferences(): NotificationPreferencesState {
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [save, setSave] = useState<NotificationPreferencesSave>({ status: 'idle' });
  const latestSaveRef = useRef(0);

  useEffect((): (() => void) => {
    let current = true;
    fetchNotificationPreferences()
      .then((response) => {
        if (current) setAnswer({ attempt, status: 'ready', preferences: response.preferences });
      })
      .catch(() => {
        // The card says the settings did not load and offers Try again; nothing else to tell.
        if (current) setAnswer({ attempt, status: 'failed' });
      });
    return (): void => {
      current = false;
    };
  }, [attempt]);

  const change = useCallback((update: NotificationPreferencesUpdate): void => {
    latestSaveRef.current += 1;
    const requestId = latestSaveRef.current;
    const isLatest = (): boolean => requestId === latestSaveRef.current;
    const withPreferences =
      (preferences: NotificationPreferences) =>
      (state: Answer | null): Answer | null =>
        state?.status === 'ready' ? { ...state, preferences } : state;

    setAnswer((state) =>
      state?.status === 'ready'
        ? { ...state, preferences: { ...state.preferences, ...update } }
        : state,
    );
    setSave({ status: 'saving' });
    updateNotificationPreferences(update)
      .then((response) => {
        if (!isLatest()) return;
        setAnswer(withPreferences(response.preferences));
        setSave({ status: 'saved' });
      })
      .catch(() => {
        // The status line says the change was not saved and offers Try again with the same change.
        if (isLatest()) setSave({ status: 'failed', update });
      });
  }, []);

  if (answer === null || answer.attempt !== attempt) return { status: 'loading' };
  if (answer.status === 'failed') {
    return { status: 'failed', retry: (): void => setAttempt((count) => count + 1) };
  }
  return {
    status: 'ready',
    preferences: answer.preferences,
    save,
    change,
    retrySave: (): void => {
      if (save.status === 'failed') change(save.update);
    },
  };
}
