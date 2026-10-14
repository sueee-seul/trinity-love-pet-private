import { useEffect } from 'react';
import { useLastStayStore } from '../store/lastStay';
import { useSignedInPetOwner } from './useSignedInPetOwner';

/**
 * Reads the signed-in parent's latest stay once for this visit to the booking page (a guest has
 * none), so the chat can offer "same as last time" only when there is a stay to copy.
 */
export const useLastStay = (): void => {
  const signedIn = useSignedInPetOwner();
  const load = useLastStayStore((state) => state.load);
  const clear = useLastStayStore((state) => state.clear);

  useEffect(() => {
    if (!signedIn) return undefined;
    void load();
    // Leaving the page ends the visit: the next one asks again, so a stay booked since shows.
    return clear;
  }, [signedIn, load, clear]);
};
