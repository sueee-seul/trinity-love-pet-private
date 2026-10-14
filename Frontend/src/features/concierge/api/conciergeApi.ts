// Thin client for the public booking concierge (`/api/concierge`). It reuses the booking flow's
// `request` wrapper, so errors arrive as the same `ApiError` with the server's message, and the
// session cookie rides along for a signed-in owner.
import { request } from '../../pet-parent/api/bookingApi';
import type { Pet, Service } from '../../pet-parent/types/booking';
import type {
  ConciergeAcceptQuoteResponse,
  ConciergeCardSetupRequest,
  ConciergeCardSetupResponse,
  ConciergeChatRequest,
  ConciergeChatResponse,
  ConciergeCheckoutRequest,
  ConciergeCheckoutResponse,
  ConciergeDetailsDraft,
  ConciergeLastStayResponse,
  ConciergePriceRequest,
  ConciergePriceResponse,
  ConciergeRatesResponse,
  ConciergeStatusResponse,
  ConciergeTermsResponse,
} from '../types';

const post = <T>(path: string, body: unknown): Promise<T> =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body) });

export const conciergeApi = {
  /** Public: the honest 'from' price, computed by the same rule as a real quote. */
  rates: (): Promise<ConciergeRatesResponse> => request<ConciergeRatesResponse>('/concierge/rates'),

  /** Public: the published services and prices, for the rate card. */
  catalogue: (): Promise<Service[]> => request<Service[]>('/concierge/catalogue'),

  /** Public: the team's contact details, the card processor and the fee rules to state. */
  status: (): Promise<ConciergeStatusResponse> =>
    request<ConciergeStatusResponse>('/concierge/status'),

  /** Public: every clause of the booking terms, for reading before agreeing. */
  terms: (): Promise<ConciergeTermsResponse> => request<ConciergeTermsResponse>('/concierge/terms'),

  chat: (body: ConciergeChatRequest): Promise<ConciergeChatResponse> =>
    post('/concierge/chat', body),

  /** Prices a stay built in the stay panel; the answer is signed, so it can be accepted as is. */
  priceSelection: (body: ConciergePriceRequest): Promise<ConciergePriceResponse> =>
    post('/concierge/price', body),

  acceptQuote: (quoteToken: string): Promise<ConciergeAcceptQuoteResponse> =>
    post('/concierge/quotes/accept', { quoteToken }),

  cardSetup: (body: ConciergeCardSetupRequest): Promise<ConciergeCardSetupResponse> =>
    post('/concierge/card-setup', body),

  checkout: (body: ConciergeCheckoutRequest): Promise<ConciergeCheckoutResponse> =>
    post('/concierge/checkout', body),

  /**
   * The signed-in owner's saved pets with what the account knows about each (an ended stay,
   * medication on file), so the plan reuses them instead of asking again or creating duplicates.
   */
  myPets: (): Promise<Pet[]> => request<Pet[]>('/petparent/pets'),

  /**
   * The signed-in owner's latest stay (pets and services, never the dates), so the page knows
   * whether to offer "same as last time". A guest gets a 401 and sees no chip.
   */
  fetchLastStay: (): Promise<ConciergeLastStayResponse> =>
    request<ConciergeLastStayResponse>('/concierge/last-stay'),
  /** Reads a spoken or typed description into a draft of the details form. */
  readDetails: (text: string): Promise<{ draft: ConciergeDetailsDraft }> =>
    post('/concierge/details/read', { text }),
};
