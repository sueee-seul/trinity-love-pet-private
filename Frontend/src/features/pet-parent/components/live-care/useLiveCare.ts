import { useCallback, useEffect, useRef, useState } from 'react';
import type { LiveCareData } from '../../types/liveCare';
import { fetchLiveCare } from '../../api/liveCareApi';
import { ApiError } from '../../api/bookingApi';
import { usePortalLocale } from '../../i18n/portalLocale';
import {
  buildLiveCareEventsUrl,
  subscribeToLiveCareServerEvents,
} from '../../../../shared/events/liveCareServerEvents';

// How often the "Last updated" label ages while the page stays open.
const LAST_UPDATED_TICK_MS = 30_000;

/** A failed load, kept as thrown so the page words it in the parent's language when it shows. */
export interface LiveCareLoadError {
  cause: unknown;
}

export interface LiveCareState {
  data: LiveCareData | null;
  selectedDate: string | undefined;
  loading: boolean;
  notFound: boolean;
  error: LiveCareLoadError | null;
  secondsSinceUpdate: number;
  selectDate: (date: string) => void;
  retry: () => void;
}

/**
 * Loads one stay's live care, keeps the chosen day, and re-fetches that day whenever the server
 * says a task or photo changed. `bookingPetId` undefined lets the server pick the stay: the one in
 * progress now, else the soonest upcoming one, else the most recent past one.
 *
 * Only the newest request may change the state. The pet switcher makes quick switching easy, and
 * without this a slow answer for the pet just left could land last and replace the pet chosen.
 */
export function useLiveCare(bookingPetId: string | undefined): LiveCareState {
  const [data, setData] = useState<LiveCareData | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<LiveCareLoadError | null>(null);
  const [secondsSinceUpdate, setSecondsSinceUpdate] = useState(0);
  // The stay the loading, error and not found flags describe.
  const [flagsFor, setFlagsFor] = useState(bookingPetId);

  const selectedDateRef = useRef(selectedDate);
  const latestRequestRef = useRef(0);
  useEffect((): void => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);

  const load = useCallback(
    (date: string | undefined): void => {
      latestRequestRef.current += 1;
      const requestId = latestRequestRef.current;
      const isLatest = (): boolean => requestId === latestRequestRef.current;

      setFlagsFor(bookingPetId);
      setLoading(true);
      setError(null);
      setNotFound(false);
      fetchLiveCare(bookingPetId, date)
        .then((result) => {
          if (!isLatest()) return;
          setData(result);
          setSelectedDate(result.selectedDate);
          selectedDateRef.current = result.selectedDate;
          setSecondsSinceUpdate(0);
        })
        .catch((err: unknown) => {
          if (!isLatest()) return;
          if (err instanceof ApiError && err.status === 404) {
            setNotFound(true);
          } else {
            setError({ cause: err });
          }
        })
        .finally(() => {
          if (isLatest()) setLoading(false);
        });
    },
    [bookingPetId],
  );

  useEffect((): void => {
    // A new stay opens on the server's default day, so a retry or a live update that comes before
    // its first answer must not ask for the day picked on the stay before it.
    selectedDateRef.current = undefined;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(undefined);
    // Re-run only when the stay itself changes. Day changes go through
    // selectDate below so switching days doesn't reset back to the
    // server's default date.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingPetId]);

  useEffect((): (() => void) => {
    const timer = setInterval(
      () => setSecondsSinceUpdate((seconds) => seconds + LAST_UPDATED_TICK_MS / 1000),
      LAST_UPDATED_TICK_MS,
    );
    return (): void => clearInterval(timer);
  }, []);

  // Staff notes come translated only for a Chinese reader, so a language switch asks again.
  const locale = usePortalLocale();
  const loadedInLocale = useRef(locale);
  useEffect((): void => {
    if (loadedInLocale.current === locale) return;
    loadedInLocale.current = locale;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(selectedDateRef.current);
  }, [locale, load]);

  // Live updates: whenever a task or photo changes for this pet, the server
  // pings this stream and we silently re-fetch the day currently on screen.
  useEffect((): (() => void) | undefined => {
    if (!data?.bookingPetId) return undefined;
    const url = buildLiveCareEventsUrl(data.bookingPetId);
    return subscribeToLiveCareServerEvents(url, () => load(selectedDateRef.current));
  }, [data?.bookingPetId, load]);

  const selectDate = (date: string): void => {
    setSelectedDate(date);
    load(date);
  };

  const retry = (): void => load(selectedDateRef.current);

  // Between a new stay being chosen and the effect above asking for it, the flags still describe
  // the stay before. The new one is loading, so the page never flashes the old stay's error.
  const isNewStay = flagsFor !== bookingPetId;

  return {
    data,
    selectedDate,
    loading: loading || isNewStay,
    notFound: notFound && !isNewStay,
    error: isNewStay ? null : error,
    secondsSinceUpdate,
    selectDate,
    retry,
  };
}
