/**
 * Which pets a manager checks before their stay is confirmed. Every other pet is confirmed the
 * moment the request is saved, once the room check under the booking lock has passed.
 *
 * New Zealand law does not ask for a manager to approve each booking. The Code of Welfare for
 * temporary housing of companion animals asks for checks when the animal is admitted (vaccination
 * proof, isolation when that is unknown), and staff make those at the desk. Medication is the one
 * case the owner keeps for a manager before the day (decided 2026-10-05): a wrong dose is the risk
 * a desk check cannot catch in time. The guest is told on the booking page when this applies.
 */

import type { ManagerReviewReason } from '../contracts/booking.review.contract.js';

export type { ManagerReviewReason } from '../contracts/booking.review.contract.js';

export interface PetReviewFacts {
  /** The guest said the pet takes medication. */
  needsMedication: boolean;
}

/** Why this pet waits for a manager; empty when it is confirmed at once. */
export const managerReviewReasons = (pet: PetReviewFacts): ManagerReviewReason[] =>
  pet.needsMedication ? ['medication'] : [];

/** The words a notice uses for each reason: "takes medication". */
export const REVIEW_REASON_WORDS: Record<ManagerReviewReason, string> = {
  medication: 'takes medication',
};
