import { useEffect, useRef } from 'react';
import type { DetailsField } from '../copy';
import { useConciergeStore } from '../store/conciergeStore';
import { useQuickConfirmStore } from '../store/quickConfirm';
import { validateDetails } from '../utils/validateDetails';
import { useConciergeCheckout } from './useConciergeCheckout';

/** The two boxes of the full form; the confirmation gives both, so they are never "missing". */
const GIVEN_BY_CONFIRMING: ReadonlySet<string> = new Set(['termsAccepted', 'vetConsent']);

interface QuickConfirm {
  /** What the full form would still ask for; empty when one press can send the booking. */
  missing: DetailsField[];
  busy: boolean;
  /** Why the last press did not book, in the page language. */
  failure: string | null;
  confirm: () => Promise<void>;
}

/**
 * One press sends the request for the stay the assistant set up, with both agreements given,
 * exactly as the full form sends them after its two boxes are ticked. Nothing is paid online. A
 * "confirm" typed in the chat presses the same button.
 */
export const useQuickConfirm = (): QuickConfirm => {
  const draft = useConciergeStore((state) => state.detailsDraft);
  const initDetailsDraft = useConciergeStore((state) => state.initDetailsDraft);
  const savedPetLinks = useConciergeStore((state) => state.savedPetLinks);
  const chatConfirmations = useQuickConfirmStore((state) => state.chatConfirmations);
  const checkout = useConciergeCheckout();

  useEffect(() => {
    initDetailsDraft();
  }, [initDetailsDraft, savedPetLinks]);

  const errors = draft ? validateDetails(draft, checkout.needsContact) : {};
  const missing = Array.from(
    new Set(
      Object.entries(errors)
        .filter(([key]) => !GIVEN_BY_CONFIRMING.has(key))
        .map(([, field]) => field)
        .filter((field): field is DetailsField => !!field),
    ),
  );
  const busy = checkout.submitting;

  const confirm = async (): Promise<void> => {
    if (!draft || busy || missing.length > 0) return;
    await checkout.submit({ ...draft, termsAccepted: true, vetConsent: true });
  };

  // Each new "confirm" typed in the chat presses the button once; the count seen at mount is old.
  const seenConfirmations = useRef(chatConfirmations);
  const confirmRef = useRef(confirm);
  // Declared first, so the press below always uses this render's draft.
  useEffect(() => {
    confirmRef.current = confirm;
  });
  useEffect(() => {
    if (chatConfirmations === seenConfirmations.current) return;
    seenConfirmations.current = chatConfirmations;
    void confirmRef.current();
  }, [chatConfirmations]);

  return {
    missing,
    busy,
    failure: checkout.error,
    confirm,
  };
};
