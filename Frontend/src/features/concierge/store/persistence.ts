import type { DetailsDraft } from '../utils/validateDetails';
import type {
  ConciergeAcceptQuoteResponse,
  ConciergeAssistantMode,
  ConciergeCatalogue,
  ConciergeCheckoutResponse,
  ConciergeCombo,
  ConciergeLocale,
  ConciergeNeedField,
  ConciergeNeeds,
  ConciergeQuote,
  ConciergeQuoteLine,
  ConciergeSelection,
  ConciergeSpecies,
  ConciergeStep,
  ConciergeUiMessage,
} from '../types';

/**
 * Keeps a booking in progress through a reload. Most often that is a phone browser discarding the
 * tab while the guest looks something up in another app.
 *
 * - sessionStorage only: this tab, gone when it closes. Nothing new reaches the server, so
 *   "conversations that don't become a request are not saved" stays true.
 * - Never the guest's name, address, phone numbers or typed signature: those stay in memory.
 * - Signed proofs are kept only while they are still valid; an expired one is dropped on load.
 * - Every access is wrapped: private windows and blocked storage simply mean no resume.
 */

const STORAGE_KEY = 'trinity-concierge-v1';
/** 4: the stay is a selection with combos and a priced quote; a saved `packages` plan is dropped. */
export const SNAPSHOT_VERSION = 4;
/** Older than this and the plan is stale anyway (every price hold has expired). */
export const SNAPSHOT_MAX_AGE_MS = 2 * 60 * 60 * 1000;
/** Mirrors the Backend token lifetimes, minus a margin so a restored proof is not about to lapse. */
export const ACCEPTANCE_USABLE_MS = 55 * 60 * 1000;
export const VERIFICATION_USABLE_MS = 55 * 60 * 1000;

/**
 * The details form without anything that identifies the guest, and without the terms box and the
 * vet consent box: agreeing is done afresh after a reload, never restored for the parent.
 */
export type StoredDetailsDraft = Omit<DetailsDraft, 'contact' | 'termsAccepted' | 'vetConsent'>;

export interface ConciergeSnapshot {
  version: typeof SNAPSHOT_VERSION;
  savedAt: number;
  locale: ConciergeLocale;
  step: ConciergeStep;
  messages: ConciergeUiMessage[];
  needs: ConciergeNeeds;
  missingFields: ConciergeNeedField[];
  combos: ConciergeCombo[];
  catalogue: ConciergeCatalogue | null;
  /** The stay being built, kept even when its price has lapsed so it can be priced again. */
  selection: ConciergeSelection | null;
  stayQuote: ConciergeQuote | null;
  appliedComboId: string | null;
  customised: boolean;
  assistantMode: ConciergeAssistantMode | null;
  accepted: ConciergeAcceptQuoteResponse | null;
  /** The priced stay the acceptance was for; its lines feed the summary and the receipt. */
  agreedQuote: ConciergeQuote | null;
  verifiedEmail: string | null;
  verificationToken: string | null;
  verifiedAt: number | null;
  detailsDraft: StoredDetailsDraft | null;
  checkoutResult: ConciergeCheckoutResponse | null;
  /** What the sent request asked for. */
  booked: BookedStay | null;
  savedPetLinks: Array<string | null>;
  /** The needs the combos were priced for; different needs mean the combos are stale. */
  pricedNeeds: ConciergeNeeds | null;
  /** The needs the guest agreed to; the details and confirmation show these dates. */
  agreedNeeds: ConciergeNeeds | null;
  /** What each linked saved pet is, so a link is dropped when its position changes pet. */
  savedPets: Record<string, SavedPetInfo>;
}

export interface SavedPetInfo {
  name: string;
  species: ConciergeSpecies;
}

/**
 * The lines of the stay a sent request was for, kept for the request receipt after the quote
 * itself is gone. Service names and prices only, nothing that identifies the guest.
 */
export interface BookedStay {
  lines: ConciergeQuoteLine[];
}

const storage = (): Storage | null => {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
};

export const saveSnapshot = (snapshot: ConciergeSnapshot): void => {
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Storage full or blocked: resuming is a convenience, the booking still works.
  }
};

export const clearSnapshot = (): void => {
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
};

/** A snapshot of this version only: the old `packages` shape is treated as no saved plan. */
const isSnapshot = (value: unknown): value is ConciergeSnapshot =>
  !!value &&
  typeof value === 'object' &&
  (value as { version?: unknown }).version === SNAPSHOT_VERSION &&
  typeof (value as { savedAt?: unknown }).savedAt === 'number' &&
  Array.isArray((value as { messages?: unknown }).messages) &&
  Array.isArray((value as { combos?: unknown }).combos) &&
  typeof (value as { needs?: unknown }).needs === 'object';

const quoteFresh = (quote: ConciergeQuote, now: number): boolean =>
  Date.parse(quote.expiresAt) > now;

/** Drops anything expired and settles on a step the remaining state can actually show. */
export const reviveSnapshot = (
  snapshot: ConciergeSnapshot,
  now: number,
): ConciergeSnapshot | null => {
  if (now - snapshot.savedAt > SNAPSHOT_MAX_AGE_MS) return null;

  const accepted =
    snapshot.accepted && now - Date.parse(snapshot.accepted.acceptedAt) < ACCEPTANCE_USABLE_MS
      ? snapshot.accepted
      : null;
  const verificationFresh =
    snapshot.verificationToken !== null &&
    snapshot.verifiedAt !== null &&
    now - snapshot.verifiedAt < VERIFICATION_USABLE_MS;
  // The combos and the priced stay were signed together; once any has lapsed the page fetches
  // fresh ones, and a hand-built selection is priced again then.
  const pricesFresh =
    snapshot.combos.every((combo) => quoteFresh(combo.quote, now)) &&
    (snapshot.stayQuote === null || quoteFresh(snapshot.stayQuote, now));

  let step: ConciergeStep = snapshot.step;
  if (step === 'done' && !snapshot.checkoutResult) step = 'plan';
  if ((step === 'verify' || step === 'details') && !accepted) step = 'plan';

  return {
    ...snapshot,
    step,
    accepted,
    agreedQuote: accepted ? snapshot.agreedQuote : null,
    combos: pricesFresh ? snapshot.combos : [],
    stayQuote: pricesFresh ? snapshot.stayQuote : null,
    appliedComboId: pricesFresh ? snapshot.appliedComboId : null,
    verificationToken: verificationFresh ? snapshot.verificationToken : null,
    verifiedAt: verificationFresh ? snapshot.verifiedAt : null,
    // A new guest's verified email only counts with its proof; a signed-in owner never needs one.
    verifiedEmail: verificationFresh || snapshot.step === 'done' ? snapshot.verifiedEmail : null,
  };
};

export const loadSnapshot = (now: number = Date.now()): ConciergeSnapshot | null => {
  try {
    const raw = storage()?.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isSnapshot(parsed) ? reviveSnapshot(parsed, now) : null;
  } catch {
    return null;
  }
};
