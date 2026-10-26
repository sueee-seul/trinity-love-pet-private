import type { ConciergeCheckoutStatus } from '../../contracts/concierge.contract.js';
import { findPetNames } from '../../repositories/concierge.repository.js';
import { managerReviewReasons, type ManagerReviewReason } from '../booking.review-rules.js';
import type { SignedQuote } from './concierge.tokens.js';

/** One quoted pet's outcome at checkout, in quote order. */
export interface PetReviewDecision {
  petName: string;
  /** Written to `booking_pets.manager_review_status`: confirmed at once, or for a manager first. */
  reviewStatus: 'approved' | 'pending';
  reasons: ManagerReviewReason[];
}

/** Used only if a pet row has no name, so a notice never reads "for ." */
const UNNAMED_PET = 'your pet';

/**
 * Every pet about to be booked waits for a manager; the reasons flag what to look at
 * (booking.review-rules.ts). Called once every pet exists, so new pets have names.
 */
export const decidePetReviews = async (
  quote: SignedQuote,
  petIdByIndex: string[],
): Promise<PetReviewDecision[]> => {
  const names = await findPetNames(petIdByIndex);
  return petIdByIndex.map((petId, index) => ({
    petName: names.get(petId) || UNNAMED_PET,
    reviewStatus: 'pending',
    reasons: managerReviewReasons({
      needsMedication: quote.pets[index]?.needsMedication === true,
    }),
  }));
};

export const overallStatus = (decisions: PetReviewDecision[]): ConciergeCheckoutStatus => {
  const confirmed = decisions.filter((decision) => decision.reviewStatus === 'approved').length;
  if (confirmed === decisions.length) return 'confirmed';
  return confirmed === 0 ? 'awaiting_manager_approval' : 'partly_confirmed';
};
