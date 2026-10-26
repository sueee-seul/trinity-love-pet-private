/**
 * What a manager should know about a pet when deciding its request. Every request waits for a
 * manager (owner decision 2026-10-14: nothing is booked or paid online; the manager approves or
 * refuses each pet, and payment happens at the desk after the arrival health check). The reasons
 * here are extra flags on top of that, so the manager sees why a request needs a closer look.
 */

import type { ManagerReviewReason } from '../contracts/booking.review.contract.js';

export type { ManagerReviewReason } from '../contracts/booking.review.contract.js';

export interface PetReviewFacts {
  /** The guest said the pet takes medication. */
  needsMedication: boolean;
}

/** What the manager should look at for this pet; empty when nothing stands out. */
export const managerReviewReasons = (pet: PetReviewFacts): ManagerReviewReason[] =>
  pet.needsMedication ? ['medication'] : [];

/** The words a notice uses for each reason: "takes medication". */
export const REVIEW_REASON_WORDS: Record<ManagerReviewReason, string> = {
  medication: 'takes medication',
};
