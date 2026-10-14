import { ACCEPTED_QUOTE_TTL_SECONDS } from './concierge.tokens.js';

/**
 * Makes each accepted quote bookable exactly once.
 *
 * An accepted-quote token is valid for an hour, so without this a double click, a mobile retry or
 * a replayed request would create a second booking, payment row and set of pets. The registry is
 * keyed by the token's unique id and kept until the token itself would have expired.
 *
 * In memory, per process, like the verification store: enough for one API instance, and listed
 * with it as needing a shared store before scaling out.
 */

export interface CompletedCheckout {
  confirmationNumber: string;
}

type AcceptanceState =
  { state: 'in_progress' } | { state: 'completed'; checkout: CompletedCheckout };

interface AcceptanceEntry {
  status: AcceptanceState;
  expiresAt: number;
}

export type ClaimResult =
  | { outcome: 'claimed' }
  | { outcome: 'in_progress' }
  | { outcome: 'completed'; checkout: CompletedCheckout };

const RETENTION_MS = ACCEPTED_QUOTE_TTL_SECONDS * 1000;

export class AcceptanceRegistry {
  private readonly entries = new Map<string, AcceptanceEntry>();

  constructor(private readonly now: () => number = (): number => Date.now()) {}

  private sweep(now: number): void {
    for (const [id, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(id);
    }
  }

  /** Claims an acceptance for one checkout attempt, or reports what already happened to it. */
  claim(acceptanceId: string): ClaimResult {
    const now = this.now();
    this.sweep(now);
    const entry = this.entries.get(acceptanceId);
    if (entry?.status.state === 'completed') {
      return { outcome: 'completed', checkout: entry.status.checkout };
    }
    if (entry?.status.state === 'in_progress') {
      return { outcome: 'in_progress' };
    }
    this.entries.set(acceptanceId, {
      status: { state: 'in_progress' },
      expiresAt: now + RETENTION_MS,
    });
    return { outcome: 'claimed' };
  }

  complete(acceptanceId: string, checkout: CompletedCheckout): void {
    this.entries.set(acceptanceId, {
      status: { state: 'completed', checkout },
      expiresAt: this.now() + RETENTION_MS,
    });
  }

  /** A failed attempt releases the claim so the guest can simply try again. */
  release(acceptanceId: string): void {
    this.entries.delete(acceptanceId);
  }
}

export const conciergeAcceptances = new AcceptanceRegistry();
