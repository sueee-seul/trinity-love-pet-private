import { z } from 'zod';

/**
 * What staff record at the desk for each pet, and what finishing check-in did with the card.
 * Shared by the manager booking API and the Frontend admin pages.
 */

export const CHECK_IN_OUTCOMES = ['checked_in', 'no_show', 'wagstay_unable'] as const;

/**
 * - checked_in: the pet stays; the full price for it is charged.
 * - no_show: the pet did not come; half is charged (the first night under older terms). A pet
 *   without vaccination proof is checked in and kept apart instead.
 * - wagstay_unable: Wagstay could not take the pet; nothing is charged for it.
 */
export type CheckInOutcome = (typeof CHECK_IN_OUTCOMES)[number];

export const recordArrivalSchema = z.object({ outcome: z.enum(CHECK_IN_OUTCOMES) }).strict();

/** Why a booking is cancelled without a fee: an emergency, a red warning or a sick pet. */
export const exceptionCancelSchema = z
  .object({ reason: z.string().trim().min(3, 'Say why the booking is cancelled').max(500) })
  .strict();

/**
 * - charged: the amount was taken from the hold (or charged at once when there was no hold);
 *   the processor released the rest of the hold.
 * - released: nothing was due, and the whole hold was released.
 * - declined: there was no hold and the card was declined now; take payment at the desk.
 * - card_failed: the hold had already failed before drop-off; take payment at the desk.
 */
export type FinishCheckInResult = 'charged' | 'released' | 'declined' | 'card_failed';

export interface FinishCheckInResponse {
  result: FinishCheckInResult;
  /** What the booking cost after the desk outcomes, in NZD. */
  amount: number;
}
