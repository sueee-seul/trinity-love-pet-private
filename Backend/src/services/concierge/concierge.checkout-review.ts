import type { ConciergeCheckoutStatus } from '../../contracts/concierge.contract.js';
import { findPetNames } from '../../repositories/concierge.repository.js';
import { managerReviewReasons, type ManagerReviewReason } from '../booking.review-rules.js';
import { createTasksForBookingPet } from '../task.fromBooking.service.js';
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
 * Decides, for each pet about to be booked, whether its stay is confirmed now or waits for a
 * manager (booking.review-rules.ts). Called once every pet exists, so new pets have names.
 */
export const decidePetReviews = async (
  quote: SignedQuote,
  petIdByIndex: string[],
): Promise<PetReviewDecision[]> => {
  const names = await findPetNames(petIdByIndex);
  return petIdByIndex.map((petId, index) => {
    const reasons = managerReviewReasons({
      needsMedication: quote.pets[index]?.needsMedication === true,
    });
    return {
      petName: names.get(petId) || UNNAMED_PET,
      reviewStatus: reasons.length === 0 ? 'approved' : 'pending',
      reasons,
    };
  });
};

export const overallStatus = (decisions: PetReviewDecision[]): ConciergeCheckoutStatus => {
  const confirmed = decisions.filter((decision) => decision.reviewStatus === 'approved').length;
  if (confirmed === decisions.length) return 'confirmed';
  return confirmed === 0 ? 'awaiting_manager_approval' : 'partly_confirmed';
};

/**
 * A confirmed stay gets its care plan now, as a manager's approval would give it. A failure is
 * logged and leaves the stay confirmed: staff still see the booking and can add the tasks.
 */
export const planCareForConfirmedPets = async (
  bookingPetIds: string[],
  decisions: PetReviewDecision[],
): Promise<void> => {
  for (const [index, bookingPetId] of bookingPetIds.entries()) {
    if (decisions[index]?.reviewStatus !== 'approved') continue;
    try {
      await createTasksForBookingPet(bookingPetId);
    } catch (taskError: unknown) {
      console.error('Concierge care plan for a confirmed stay failed', {
        name: taskError instanceof Error ? taskError.name : 'unknown',
      });
    }
  }
};
