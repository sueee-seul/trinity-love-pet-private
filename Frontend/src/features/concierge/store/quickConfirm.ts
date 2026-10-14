import { create } from 'zustand';
import type { ConciergePlan } from '../types';
import { useConciergeStore } from './conciergeStore';

/**
 * "Book it for me" ends in one confirmation instead of the full form. The card belongs to the plan
 * that asked for it: a newer plan, going back to the options or a sent booking closes it, so an old
 * request can never be confirmed by a later "confirm".
 */
interface QuickConfirmState {
  /** The plan whose "book it for me" opened the card; null when no card is open. */
  plan: ConciergePlan | null;
  /** Counts "confirm" replies typed in the chat; the card confirms on each new one. */
  chatConfirmations: number;
  openFor: (plan: ConciergePlan) => void;
  close: () => void;
  confirmFromChat: () => void;
}

export const useQuickConfirmStore = create<QuickConfirmState>((set) => ({
  plan: null,
  chatConfirmations: 0,
  openFor: (plan): void => set({ plan }),
  close: (): void => set({ plan: null }),
  confirmFromChat: (): void => set((state) => ({ chatConfirmations: state.chatConfirmations + 1 })),
}));

/** The card is open for the current plan and its price is agreed; anything else hides it. */
export const useQuickConfirmOpen = (): boolean => {
  const quickPlan = useQuickConfirmStore((state) => state.plan);
  const plan = useConciergeStore((state) => state.plan);
  const agreed = useConciergeStore((state) => state.accepted !== null);
  return quickPlan !== null && quickPlan === plan && agreed;
};
