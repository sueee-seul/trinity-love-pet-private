import { useEffect, useState } from 'react';
import type { PetStay } from '../../types/stays';
import { fetchMyBookings } from '../../api/bookingApi';

export interface MyStaysState {
  /** Empty until the stays load, and after a failed load. */
  stays: PetStay[];
  status: 'loading' | 'loaded' | 'failed';
}

/**
 * The parent's stays, for choosing the stay when the link names none, for the pet switcher and
 * for the exact pick-up time of the stay on screen. All three are extras on top of the live care
 * response: if this request fails, the page still shows a stay (the server's choice), just without
 * the switcher and with the day-level phase from the live care response.
 */
export function useMyStays(): MyStaysState {
  const [state, setState] = useState<MyStaysState>({ stays: [], status: 'loading' });

  useEffect((): (() => void) => {
    let cancelled = false;
    fetchMyBookings().then(
      (stays) => {
        if (!cancelled) setState({ stays, status: 'loaded' });
      },
      (err: unknown) => {
        // Not shown to the parent, for the reason above, but kept visible to whoever debugs it.
        console.warn('Live care could not load the parent stays.', err);
        if (!cancelled) setState({ stays: [], status: 'failed' });
      },
    );
    return (): void => {
      cancelled = true;
    };
  }, []);

  return state;
}
