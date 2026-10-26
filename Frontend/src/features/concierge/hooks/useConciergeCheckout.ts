import { useState } from 'react';
import { conciergeApi } from '../api/conciergeApi';
import { CONCIERGE_COPY, type LocalisedText } from '../copy';
import { useConciergeStore } from '../store/conciergeStore';
import type { ConciergeCheckoutPet, ConciergeCheckoutRequest } from '../types';
import { describeConciergeError } from '../utils/conciergeErrors';
import {
  formKeyForServerField,
  type DetailsContactDraft,
  type DetailsDraft,
  type DetailsErrors,
  type DetailsPetDraft,
} from '../utils/validateDetails';
import { refreshSession, useSignedInPetOwner } from './useSignedInPetOwner';

export const TERMS_VERSION_LABEL = 'concierge-terms-2026-10-14';

export type CheckoutOutcome = 'sent' | 'needs_sign_in' | 'back_to_options' | 'failed';

/** The server no longer knows who is sending: the session lapsed since the page was opened. */
const SIGN_IN_AGAIN_CODES = new Set([
  'CONCIERGE_EMAIL_UNVERIFIED',
  'CONCIERGE_EMAIL_TAKEN',
  'CONCIERGE_CONTACT_REQUIRED',
  'CONCIERGE_PASSWORD_ACCOUNT',
  // The email a first-time guest typed already has an account: its own sign-in books on it.
  'CONCIERGE_ACCOUNT_EXISTS',
]);

interface ConciergeCheckout {
  needsContact: boolean;
  submitting: boolean;
  error: string | null;
  /** The server's reason for the last failure, for recovery links. */
  errorCode: string | null;
  /** The last failure means the session lapsed: signing in again, in place, is the way on. */
  needsSignIn: boolean;
  /** Fields the server refused, by form key, so each gets its own message. */
  serverFieldErrors: DetailsErrors;
  /** Set when this request was already sent: its reference, for the guest to keep. */
  alreadySentReference: string | null;
  submit: (draft: DetailsDraft) => Promise<CheckoutOutcome>;
}

const CONTACT_FIELDS: ReadonlySet<string> = new Set<keyof DetailsContactDraft>([
  'email',
  'password',
  'firstName',
  'lastName',
  'address',
  'phone',
  'emergencyContactNumber',
]);

const toCheckoutPet = (choice: DetailsPetDraft): ConciergeCheckoutPet =>
  choice.existingPetId
    ? { existingPetId: choice.existingPetId }
    : {
        newPet: {
          name: choice.name.trim(),
          ...(choice.breed.trim() ? { breed: choice.breed.trim() } : {}),
        },
      };

interface RequestContext {
  acceptedQuoteToken: string;
  verificationToken: string | null;
  needsContact: boolean;
}

const buildRequest = (draft: DetailsDraft, context: RequestContext): ConciergeCheckoutRequest => {
  const address = draft.contact.address.trim();
  return {
    acceptedQuoteToken: context.acceptedQuoteToken,
    ...(context.verificationToken ? { verificationToken: context.verificationToken } : {}),
    ...(context.needsContact
      ? {
          // No sign-in and no email code: the account is made with the booking.
          newAccount: { email: draft.contact.email.trim(), password: draft.contact.password },
          contact: {
            firstName: draft.contact.firstName.trim(),
            lastName: draft.contact.lastName.trim(),
            ...(address ? { address } : {}),
            phone: draft.contact.phone.trim(),
            ...(draft.contact.emergencyContactNumber?.trim()
              ? { emergencyContactNumber: draft.contact.emergencyContactNumber.trim() }
              : {}),
          },
        }
      : {}),
    pets: draft.pets.map(toCheckoutPet),
    stay: { dropOffTime: draft.dropOffTime, pickUpTime: draft.pickUpTime },
    // Sent only after send() checked both boxes (below); the server refuses either one missing.
    agreement: {
      termsAccepted: true,
      vetConsentAccepted: true,
      termsVersionLabel: TERMS_VERSION_LABEL,
    },
    ...(draft.careNotes.trim() ? { careNotes: draft.careNotes.trim() } : {}),
  };
};

/** Server field paths to this form's error keys; only fields the form actually shows. */
const serverFieldErrorsFor = (fields: string[]): DetailsErrors => {
  const errors: DetailsErrors = {};
  for (const field of fields) {
    const key = formKeyForServerField(field);
    if (key === 'termsAccepted') errors.termsAccepted = 'termsAccepted';
    else if (key === 'vetConsent') errors.vetConsent = 'vetConsent';
    else if (key?.endsWith('.breed')) errors[key] = 'breedTooLong';
    else if (key?.startsWith('pets.')) errors[key] = 'petName';
    else if (key === 'dropOffTime' || key === 'pickUpTime') errors[key] = key;
    else if (key && CONTACT_FIELDS.has(key)) errors[key] = key as keyof DetailsContactDraft;
  }
  return errors;
};

/**
 * Sends the booking request. Nothing is paid online: the request waits for our manager. A new
 * guest supplies contact details (their account is created from them); a signed-in owner's pets
 * linked to their saved pets are sent by id, so none is added twice.
 *
 * Nothing the guest typed is lost on a failure. An expired agreement is renewed in place when the
 * price is unchanged and the request is sent again; a lapsed session asks the parent to sign in
 * again on the same screen; a changed price or a full night goes back to the options.
 */
export const useConciergeCheckout = (): ConciergeCheckout => {
  const locale = useConciergeStore((state) => state.locale);
  const signedIn = useSignedInPetOwner();
  const [submitting, setSubmitting] = useState(false);
  // Kept as found, so the words follow a language switch (see LocalisedText).
  const [failure, setFailure] = useState<{ text: LocalisedText } | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [serverFieldErrors, setServerFieldErrors] = useState<DetailsErrors>({});
  const [alreadySentReference, setAlreadySentReference] = useState<string | null>(null);

  /** Prices the agreed stay again and re-agrees if it still costs exactly the same. */
  const renewAgreement = async (): Promise<boolean> => {
    const store = useConciergeStore.getState();
    const agreed = store.accepted;
    if (!agreed) return false;
    const fresh = await store.repriceStay();
    if (!fresh || fresh.total !== agreed.total || fresh.name !== agreed.name) return false;
    useConciergeStore.getState().setAccepted(await conciergeApi.acceptQuote(fresh.quoteToken), {
      keepStep: true,
      quote: fresh,
    });
    return true;
  };

  const send = async (draft: DetailsDraft): Promise<void> => {
    const { accepted, verificationToken } = useConciergeStore.getState();
    if (!accepted) throw new Error('No agreed stay to send');
    // The request tells the server both boxes were ticked, so it is only sent once they are.
    if (!draft.termsAccepted) throw new Error('The booking terms were not agreed');
    if (!draft.vetConsent) throw new Error('Emergency vet consent was not given');
    const result = await conciergeApi.checkout(
      buildRequest(draft, {
        acceptedQuoteToken: accepted.acceptedQuoteToken,
        verificationToken,
        needsContact: !signedIn,
      }),
    );
    // The booking exists now: show the confirmation first, whatever happens next.
    useConciergeStore.getState().setCheckoutResult(result);
    // The server signed a new guest in; tell the rest of the app. A failure here only delays
    // that, it never turns a sent booking into an error.
    await refreshSession().catch(() => undefined);
  };

  const fail = (
    text: LocalisedText,
    code: string | null,
    outcome: CheckoutOutcome,
  ): CheckoutOutcome => {
    setFailure({ text });
    setErrorCode(code);
    return outcome;
  };

  const submit = async (draft: DetailsDraft): Promise<CheckoutOutcome> => {
    const copy = CONCIERGE_COPY[locale];
    setSubmitting(true);
    setFailure(null);
    setErrorCode(null);
    setNeedsSignIn(false);
    setServerFieldErrors({});
    setAlreadySentReference(null);
    try {
      await send(draft);
      return 'sent';
    } catch (failure: unknown) {
      const problem = describeConciergeError(failure, copy);
      const agreementExpired =
        problem.code === 'CONCIERGE_TOKEN_INVALID' &&
        (problem.token === 'accepted_quote' || problem.token === 'quote');
      if (agreementExpired) {
        // A renewal that cannot even be tried (the server is unreachable) is treated like a price
        // that changed: the guest goes back to the options, which say why.
        const renewed = await renewAgreement().catch(() => false);
        if (renewed) {
          try {
            await send(draft);
            return 'sent';
          } catch (retryFailure: unknown) {
            return fail(
              (words) => describeConciergeError(retryFailure, words).message,
              describeConciergeError(retryFailure, copy).code,
              'failed',
            );
          }
        }
        const store = useConciergeStore.getState();
        // A changed price has already been announced on the card; otherwise say why.
        if (!store.priceNotice) store.announce((words) => words.errors.quoteStale);
        store.backToOptions();
        return 'back_to_options';
      }
      const sessionLapsed =
        (problem.code === 'CONCIERGE_TOKEN_INVALID' && problem.token === 'verified_email') ||
        (problem.code !== null && SIGN_IN_AGAIN_CODES.has(problem.code));
      if (sessionLapsed) {
        setNeedsSignIn(true);
        // A first-time guest whose email already has an account is told so, not that a sign-in
        // expired: they never signed in.
        const message: LocalisedText =
          problem.code === 'CONCIERGE_ACCOUNT_EXISTS'
            ? (words) => describeConciergeError(failure, words).message
            : (words) => words.errors.signInAgain;
        return fail(message, problem.code, 'needs_sign_in');
      }
      if (problem.code === 'CONCIERGE_FULLY_BOOKED') {
        // The last place went while the guest was typing: back to the plan, where a fresh
        // pricing shows which nights are full.
        const store = useConciergeStore.getState();
        store.announce((words) => describeConciergeError(failure, words).message);
        store.backToOptions();
        void store.refreshQuotes();
        return 'back_to_options';
      }
      if (problem.code === 'CONCIERGE_ALREADY_SUBMITTED') {
        setAlreadySentReference(problem.confirmationNumber);
      }
      if (problem.code === 'VALIDATION_FAILED') {
        setServerFieldErrors(serverFieldErrorsFor(problem.fields));
      }
      return fail(
        (words) => describeConciergeError(failure, words).message,
        problem.code,
        'failed',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return {
    needsContact: !signedIn,
    submitting,
    error: failure ? failure.text(CONCIERGE_COPY[locale]) : null,
    errorCode,
    needsSignIn,
    serverFieldErrors,
    alreadySentReference,
    submit,
  };
};
