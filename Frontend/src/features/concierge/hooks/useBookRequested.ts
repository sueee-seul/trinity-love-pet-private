import { useEffect, useRef } from 'react';
import { selectRepricing, useConciergeStore } from '../store/conciergeStore';
import { useQuickConfirmStore } from '../store/quickConfirm';
import type { ConciergePlan } from '../types';
import { recommendedCombo } from '../utils/staySelection';
import { useSignedInPetOwner } from './useSignedInPetOwner';

interface BookRequestedInput {
  /** Booking online is off (no card processor): the stay is shown and the plan goes to the team. */
  handoff: boolean;
  agree: (options?: { stayOnPlan?: boolean }) => Promise<boolean>;
  agreeing: boolean;
}

/**
 * "Book it for me": the assistant's hand-off applies the recommended stay and agrees to its price,
 * once per plan, and opens the one-step booking card. A signed-in parent confirms it in the chat
 * column with one press or a typed "confirm"; a guest signs in first and confirms after. Nothing is
 * booked until they do. When booking online is off, the stay is opened for the guest to send to
 * the team from the panel instead.
 */
export const useBookRequested = ({ handoff, agree, agreeing }: BookRequestedInput): void => {
  const plan = useConciergeStore((state) => state.plan);
  const combos = useConciergeStore((state) => state.combos);
  const repricing = useConciergeStore(selectRepricing);
  const applyCombo = useConciergeStore((state) => state.applyCombo);
  const openStayPanel = useConciergeStore((state) => state.openStayPanel);
  const openQuickConfirm = useQuickConfirmStore((state) => state.openFor);
  const signedIn = useSignedInPetOwner();
  const handledPlan = useRef<ConciergePlan | null>(null);

  useEffect(() => {
    if (!plan?.bookRequested || handledPlan.current === plan) return;
    if (agreeing || repricing) return;
    const recommended = recommendedCombo(combos, plan);
    if (!recommended) return;
    handledPlan.current = plan;
    applyCombo(recommended.id);
    if (handoff) {
      openStayPanel('combos');
      return;
    }
    openQuickConfirm(plan);
    void agree({ stayOnPlan: signedIn });
  }, [
    plan,
    combos,
    handoff,
    agreeing,
    repricing,
    applyCombo,
    openStayPanel,
    agree,
    openQuickConfirm,
    signedIn,
  ]);
};
