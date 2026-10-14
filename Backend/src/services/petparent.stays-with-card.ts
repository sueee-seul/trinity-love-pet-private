import type { CheckInOutcome } from '../contracts/booking.check-in.contract.js';
import { PAY_AT_REQUEST_TERMS_VERSION } from '../contracts/booking.terms.contract.js';
import type { CardGuaranteeStatus } from '../repositories/booking.check-in.repository.js';
import {
  findStayGuarantees,
  type StayGuaranteeRow,
} from '../repositories/petparent.stay-guarantee.repository.js';
import { dateChangeLimitFor } from './booking.fee-policy.js';
import { getCardProcessor } from './payments/card-processor.factory.js';
import { listMyBookings, type MyBookingSummary } from './petparent.booking.js';

/**
 * My stays: each stay with what the guest needs to manage it. How the arrival went, how many date
 * changes its terms still allow, and what the saved card is doing (never presented as a real hold
 * when it is a test). Whether the stay is still on, and what the manager decided, is the summary's
 * own `status`.
 */

export interface StayCard {
  status: CardGuaranteeStatus;
  amount: number;
  /** What check-in or a cancellation took (0: released in full); null until then. */
  capturedAmount: number | null;
  testMode: boolean;
  /** Agreed to the pay-at-request terms: held when sent, charged once every pet is decided. */
  paysAtRequest: boolean;
}

export interface MyStay extends MyBookingSummary {
  checkInOutcome: CheckInOutcome | null;
  /** Date changes the guest can still make; null when the terms set no limit. */
  dateChangesLeft: number | null;
  /** Null for a booking made without a saved card. */
  card: StayCard | null;
}

const dateChangesLeftFor = (row: StayGuaranteeRow | undefined): number | null => {
  const limit = dateChangeLimitFor(row?.terms_version ?? '');
  return limit === null ? null : Math.max(0, limit - (row?.reschedule_count ?? 0));
};

const cardOf = (row: StayGuaranteeRow | undefined, stripeTestMode: boolean): StayCard | null =>
  row?.card_status && row.card_amount !== null
    ? {
        status: row.card_status,
        amount: row.card_amount,
        capturedAmount: row.card_captured_amount,
        testMode: row.card_processor === 'fake' || stripeTestMode,
        // Labels are dated, so a later version sorts after the first pay-at-request one.
        paysAtRequest: row.terms_version >= PAY_AT_REQUEST_TERMS_VERSION,
      }
    : null;

export const listMyStays = async (petOwnersUuid: string): Promise<MyStay[]> => {
  const [stays, guarantees] = await Promise.all([
    listMyBookings(petOwnersUuid),
    findStayGuarantees(petOwnersUuid),
  ]);
  const processor = getCardProcessor();
  const stripeTestMode = processor?.name === 'stripe' && processor.testMode;
  const byPet = new Map(guarantees.map((row) => [row.booking_pets_uuid, row]));
  return stays.map((stay) => {
    const row = byPet.get(stay.bookingPetId);
    return {
      ...stay,
      checkInOutcome: row?.check_in_outcome ?? null,
      dateChangesLeft: dateChangesLeftFor(row),
      card: cardOf(row, stripeTestMode),
    };
  });
};
