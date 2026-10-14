import { useState } from 'react';
import { conciergeApi } from '../api/conciergeApi';
import { CONCIERGE_COPY } from '../copy';
import { sameNeeds, selectRepricing, useConciergeStore } from '../store/conciergeStore';
import type { ConciergeAcceptQuoteResponse, ConciergeNeeds, ConciergeQuote } from '../types';
import { describeConciergeError } from '../utils/conciergeErrors';

interface AgreeOptions {
  /** Stay on the plan screen: "book it for me" confirms there, in the chat column. */
  stayOnPlan?: boolean;
}

interface AgreeToStay {
  agree: (options?: AgreeOptions) => Promise<boolean>;
  agreeing: boolean;
  error: string | null;
}

/**
 * "Continue with this stay": the server signs the priced stay with the time of the click, which
 * is the record that the guest accepted that exact price. The booking terms are agreed later,
 * once, on the details step, where a first-time guest also makes their account. Nobody signs in
 * first.
 *
 * The agreement only counts for the plan it was priced for: if the needs changed while the
 * request was on its way, it is thrown away and the guest agrees to the updated price instead.
 * An expired price hold is renewed silently when the same stay costs the same; a different total
 * is shown in the panel and the guest decides again, never silently.
 */
export const useAgreeToStay = (): AgreeToStay => {
  const [agreeing, setAgreeing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const acceptIfUnchanged = (
    acceptance: ConciergeAcceptQuoteResponse,
    quote: ConciergeQuote,
    pricedFor: ConciergeNeeds,
    options?: AgreeOptions,
  ): boolean => {
    const store = useConciergeStore.getState();
    if (!sameNeeds(store.needs, pricedFor) || store.refreshPending) {
      setError(CONCIERGE_COPY[store.locale].packages.changedWhileAgreeing);
      return false;
    }
    store.setAccepted(acceptance, {
      // Nobody signs in first: a guest makes their account on the details step.
      skipVerify: true,
      quote,
      keepStep: options?.stayOnPlan === true,
    });
    return true;
  };

  const agree = async (options?: AgreeOptions): Promise<boolean> => {
    const store = useConciergeStore.getState();
    const copy = CONCIERGE_COPY[store.locale];
    const chosen = store.stayQuote;
    if (!chosen) {
      setError(copy.packages.choosePrompt);
      return false;
    }
    if (selectRepricing(store)) return false;
    const pricedFor = store.needs;
    setAgreeing(true);
    setError(null);
    try {
      return acceptIfUnchanged(
        await conciergeApi.acceptQuote(chosen.quoteToken),
        chosen,
        pricedFor,
        options,
      );
    } catch (failure: unknown) {
      const problem = describeConciergeError(failure, copy);
      if (problem.code !== 'CONCIERGE_TOKEN_INVALID') {
        setError(problem.message);
        return false;
      }
      // The hold lapsed: the same stay is priced again and accepted if it still costs the same.
      const fresh = await useConciergeStore.getState().repriceStay();
      if (!fresh) {
        setError(copy.errors.quoteStale);
        return false;
      }
      if (fresh.total !== chosen.total) {
        useConciergeStore.getState().announce((words) => words.errors.quoteExpired);
        return false;
      }
      try {
        const renewedFor = useConciergeStore.getState().needs;
        return acceptIfUnchanged(
          await conciergeApi.acceptQuote(fresh.quoteToken),
          fresh,
          renewedFor,
          options,
        );
      } catch (retryFailure: unknown) {
        setError(describeConciergeError(retryFailure, copy).message);
        return false;
      }
    } finally {
      setAgreeing(false);
    }
  };

  return { agree, agreeing, error };
};
