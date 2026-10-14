import { useCallback, useEffect, useState } from 'react';
import { conciergeApi } from '../api/conciergeApi';
import { CONCIERGE_COPY, type LocalisedText } from '../copy';
import { selectHasFreshVerification, useConciergeStore } from '../store/conciergeStore';
import type { ConciergeCardSetupResponse } from '../types';
import { describeConciergeError } from '../utils/conciergeErrors';
import { useSignedInPetOwner } from './useSignedInPetOwner';

/**
 * The card setup behind the card form on the details step.
 *
 * A setup is asked for once the guest has agreed and proved who they are (a session, or a fresh
 * email check). The server ties each setup to one agreement, so a new agreement asks for a new
 * setup; a renewed email check does not, and the card form stays on screen with what was typed.
 * `reload` asks for a new one, e.g. after a card was declined.
 */

export type CardGuaranteeState =
  | { status: 'waiting' }
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'error'; text: LocalisedText }
  | { status: 'ready'; setup: ConciergeCardSetupResponse };

export interface CardGuarantee {
  state: CardGuaranteeState;
  reload: () => void;
}

const WAITING: CardGuaranteeState = { status: 'waiting' };
const LOADING: CardGuaranteeState = { status: 'loading' };

/**
 * `guestEmail`: a first-time guest's email once it is complete, so their card is saved for the
 * account the booking will make; null until then, and for a signed-in parent.
 */
export const useCardGuarantee = (guestEmail: string | null = null): CardGuarantee => {
  const acceptedQuoteToken = useConciergeStore((state) => state.accepted?.acceptedQuoteToken);
  const verificationToken = useConciergeStore((state) => state.verificationToken);
  const freshVerification = useConciergeStore(selectHasFreshVerification);
  const signedIn = useSignedInPetOwner();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; state: CardGuaranteeState } | null>(null);

  // Only a fresh check: an old token would be refused, and the page asks for a new check anyway.
  const asGuest = !signedIn && !freshVerification ? guestEmail : null;
  const canAsk = signedIn || freshVerification || asGuest !== null;
  const key = acceptedQuoteToken ? `${acceptedQuoteToken}|${asGuest ?? ''}|${attempt}` : null;

  useEffect(() => {
    if (!key || !acceptedQuoteToken || !canAsk) return undefined;
    let cancelled = false;
    conciergeApi
      .cardSetup({
        acceptedQuoteToken,
        ...(!signedIn && verificationToken ? { verificationToken } : {}),
        ...(asGuest ? { guestEmail: asGuest } : {}),
      })
      .then((setup) => {
        if (!cancelled) setResult({ key, state: { status: 'ready', setup } });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const problem = describeConciergeError(
          error,
          CONCIERGE_COPY[useConciergeStore.getState().locale],
        );
        setResult({
          key,
          state:
            problem.code === 'CONCIERGE_PAYMENTS_NOT_CONFIGURED'
              ? { status: 'unavailable' }
              : {
                  status: 'error',
                  text: (words): string => describeConciergeError(error, words).message,
                },
        });
      });
    return (): void => {
      cancelled = true;
    };
    // A renewed email check asks again; the server hands back the same setup for the same
    // agreement and email, so the card form is not rebuilt.
  }, [key, acceptedQuoteToken, canAsk, signedIn, verificationToken, asGuest]);

  const reload = useCallback((): void => setAttempt((count) => count + 1), []);
  const answered = result && result.key === key ? result.state : null;
  const state = answered ?? (key && canAsk ? LOADING : WAITING);
  return { state, reload };
};
