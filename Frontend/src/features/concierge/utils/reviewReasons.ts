import type { ConciergePetNeed, ManagerReviewReason } from '../types';

/**
 * Which of the server's reasons will send this pet's stay to our manager, so the page can say so
 * before the guest sends (Backend booking.review-rules.ts: medication only). The server decides
 * for real at checkout and the receipt shows its answer.
 */
export const predictReviewReasons = (
  petNeed: ConciergePetNeed | undefined,
): ManagerReviewReason[] => (petNeed?.needsMedication === true ? ['medication'] : []);
