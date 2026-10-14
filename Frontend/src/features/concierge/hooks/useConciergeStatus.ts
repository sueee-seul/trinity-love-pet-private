import { useEffect, useState } from 'react';
import type { Service } from '../../pet-parent/types/booking';
import { conciergeApi } from '../api/conciergeApi';
import type {
  AiProcessingDisclosure,
  ConciergeAssistantMode,
  ConciergeBookingPolicy,
  ConciergeCardProcessor,
  ConciergeRatesResponse,
  ConciergeStatusResponse,
} from '../types';

/**
 * What the page needs before the guest starts: how to reach a person, whether a card can be saved
 * (if not, the page says so up front and offers the team instead of a dead end after choosing),
 * the fee rules to state, and the honest "from" price.
 *
 * Each is fetched once per page load and shared, and so is the price list. The card and fee facts
 * stay unknown (null) until read: the page never states fee rules it has not been given, and
 * never calls booking impossible before it knows.
 */

export interface ConciergeStatus {
  /** Reported by the server but no longer used by the page: guests sign in with a password. */
  emailCodes: boolean;
  /** Only a real, configured address; never a placeholder a stranger could own. */
  teamEmail: string | null;
  teamPhone: string | null;
  /** Null until read. A null processor inside means cards cannot be saved. */
  cardPayments: { processor: ConciergeCardProcessor | null; testMode: boolean } | null;
  /**
   * Whether a stay can be booked online at all: a facility capacity and a card processor exist.
   * Assumed true until the status is read, so the page never shows a dead end it cannot prove.
   */
  onlineBooking: boolean;
  policy: ConciergeBookingPolicy | null;
  /**
   * Which assistant answers, once known. The greeting is written from it, so the page never calls
   * the keyword matcher an AI, nor the model a simple helper.
   */
  assistantMode: ConciergeAssistantMode | null;
  /**
   * Where the assistant and voice-to-text run, once read. Null while loading, when the status
   * cannot be read, or from an older server: the privacy notice then makes no claim about it.
   */
  aiProcessing: AiProcessingDisclosure | null;
}

const DEFAULT_STATUS: ConciergeStatus = {
  emailCodes: true,
  teamEmail: null,
  teamPhone: null,
  cardPayments: null,
  onlineBooking: true,
  policy: null,
  assistantMode: null,
  aiProcessing: null,
};

let statusRequest: Promise<ConciergeStatusResponse> | null = null;
let ratesRequest: Promise<ConciergeRatesResponse> | null = null;
let catalogueRequest: Promise<Service[]> | null = null;

const toStatus = (response: ConciergeStatusResponse): ConciergeStatus => ({
  emailCodes: response.emailCodes,
  teamEmail: response.contact.email,
  teamPhone: response.contact.phone,
  cardPayments: response.cardPayments,
  onlineBooking: response.capacityConfigured && response.cardPayments.processor !== null,
  policy: response.policy,
  // An older server says nothing about the assistant; the greeting then stays neutral.
  assistantMode: response.assistantMode ?? null,
  aiProcessing: response.aiProcessing ?? null,
});

/** Test hook: forget the cached answers. */
export const resetConciergeStatusCache = (): void => {
  statusRequest = null;
  ratesRequest = null;
  catalogueRequest = null;
};

export const useConciergeStatus = (): ConciergeStatus => {
  const [status, setStatus] = useState<ConciergeStatus>(DEFAULT_STATUS);
  useEffect(() => {
    let cancelled = false;
    statusRequest ??= conciergeApi.status();
    statusRequest
      .then((response) => {
        if (!cancelled) setStatus(toStatus(response));
      })
      .catch(() => {
        statusRequest = null;
      });
    return (): void => {
      cancelled = true;
    };
  }, []);
  return status;
};

/**
 * The "from" price with its loading state. A page that must say something when the price cannot be
 * read (the landing page keeps its call to action and drops the number) tells "not yet" from
 * "not available"; the /book price line only needs the price itself.
 */
export type ConciergeRatesResult =
  | { state: 'loading' }
  | { state: 'ready'; rates: ConciergeRatesResponse }
  | { state: 'unavailable' };

export const useConciergeRatesResult = (): ConciergeRatesResult => {
  const [result, setResult] = useState<ConciergeRatesResult>({ state: 'loading' });
  useEffect(() => {
    let cancelled = false;
    ratesRequest ??= conciergeApi.rates();
    ratesRequest
      .then((response) => {
        if (!cancelled) setResult({ state: 'ready', rates: response });
      })
      .catch(() => {
        // No "from" price is better than a wrong one; the quote itself still works.
        ratesRequest = null;
        if (!cancelled) setResult({ state: 'unavailable' });
      });
    return (): void => {
      cancelled = true;
    };
  }, []);
  return result;
};

export const useConciergeRates = (): ConciergeRatesResponse | null => {
  const result = useConciergeRatesResult();
  return result.state === 'ready' ? result.rates : null;
};

/** The published price list, for a rate card that is open from the start. */
export type ConciergeCatalogueResult =
  { state: 'loading' } | { state: 'ready'; services: Service[] } | { state: 'unavailable' };

export const useConciergeCatalogue = (): ConciergeCatalogueResult => {
  const [result, setResult] = useState<ConciergeCatalogueResult>({ state: 'loading' });
  useEffect(() => {
    let cancelled = false;
    catalogueRequest ??= conciergeApi.catalogue();
    catalogueRequest
      .then((services) => {
        if (!cancelled) setResult({ state: 'ready', services });
      })
      .catch(() => {
        // Without the list the page shows no item prices at all, never a stale or guessed one.
        catalogueRequest = null;
        if (!cancelled) setResult({ state: 'unavailable' });
      });
    return (): void => {
      cancelled = true;
    };
  }, []);
  return result;
};
