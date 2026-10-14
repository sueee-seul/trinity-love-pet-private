import { useEffect, useRef, useState } from 'react';
import { fetchStaySummaries } from '../../api/staySummariesApi';
import type { StaySummary } from '../../types/liveCare';

/** A failed load. `message` is the error's own text; null when it carried none. */
export interface StaySummariesLoadError {
  message: string | null;
}

interface Loaded {
  /** The stay and attempt this answer is for. */
  key: string;
  summaries: StaySummary[] | null;
  error: StaySummariesLoadError | null;
}

export interface StaySummariesState {
  /** The updates last received, newest first; null until the first answer. */
  summaries: StaySummary[] | null;
  /** True until the stay asked for has answered. */
  loading: boolean;
  error: StaySummariesLoadError | null;
  retry: () => void;
}

const keyOf = (bookingPetId: string, attempt: number): string => `${bookingPetId}|${attempt}`;

/**
 * Loads the daily updates and stay report of one stay. `refreshOn` is any value whose change
 * means the stay's records may have moved on (Live care passes the day's care, which arrives
 * afresh whenever staff tick a task): the list is then fetched again, quietly, so an update that
 * has just been written shows without a reload.
 *
 * Only the newest request may change the state, since a slow answer for the stay just left could
 * otherwise land last and replace the stay picked.
 */
export function useStaySummaries(bookingPetId: string, refreshOn?: unknown): StaySummariesState {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [attempt, setAttempt] = useState(0);
  const latestRequestRef = useRef(0);
  const key = keyOf(bookingPetId, attempt);

  useEffect((): void => {
    latestRequestRef.current += 1;
    const requestId = latestRequestRef.current;
    const isLatest = (): boolean => requestId === latestRequestRef.current;

    fetchStaySummaries(bookingPetId)
      .then((summaries) => {
        if (isLatest()) setLoaded({ key, summaries, error: null });
      })
      .catch((err: unknown) => {
        if (!isLatest()) return;
        setLoaded({
          key,
          summaries: null,
          error: { message: err instanceof Error ? err.message : null },
        });
      });
    // `refreshOn` is a dependency on purpose: a new answer for the day means an update may exist.
  }, [bookingPetId, key, refreshOn]);

  return {
    summaries: loaded?.summaries ?? null,
    loading: loaded === null || loaded.key !== key,
    error: loaded !== null && loaded.key === key ? loaded.error : null,
    retry: (): void => setAttempt((count) => count + 1),
  };
}
