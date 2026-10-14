import { PAY_AT_REQUEST_TERMS_VERSION } from '../../contracts/booking.terms.contract.js';
import type {
  GuaranteePayment,
  LockedBooking,
  PetAtTheDesk,
} from '../../repositories/booking.check-in.repository.js';

export const LOCKED_BOOKING_ID = '1a2b3c4d-0000-4000-8000-000000000001';
export const OWNER_ID = '33333333-0000-4000-8000-000000000001';

/** 10:30 on Sat 12 Dec to 16:00 on Tue 15 Dec 2026 in Auckland: three nights. */
export const DROP_OFF_AT = new Date('2026-12-11T21:30:00Z');
export const PICK_UP_AT = new Date('2026-12-15T03:00:00Z');

/** A pet on the booking: $60 a night for three nights plus a $50 flat extra, $230 in all. */
export const lockedPet = (overrides: Partial<PetAtTheDesk> = {}): PetAtTheDesk => ({
  bookingPetsUuid: 'pet-a',
  reviewStatus: 'approved',
  approvedAt: new Date('2026-11-01T01:00:00Z'),
  outcome: null,
  price: 230,
  nightlyRate: 60,
  flatPrice: 50,
  dropOffAt: DROP_OFF_AT,
  pickUpAt: PICK_UP_AT,
  ...overrides,
});

/** A $460 hold for two pets, placed 48 hours before drop-off. */
export const guaranteePayment = (overrides: Partial<GuaranteePayment> = {}): GuaranteePayment => ({
  paymentId: 'payment-1',
  status: 'authorized',
  amount: 460,
  capturedAmount: null,
  paymentIntentId: 'pi_held',
  paymentMethodId: 'pm_saved',
  processor: 'stripe',
  ...overrides,
});

/**
 * Older terms by default: held 48 hours ahead and charged at the desk. A pay-at-request booking
 * agreed to the 2026-10-02 terms unless a test names a version.
 */
export const lockedBooking = (overrides: Partial<LockedBooking> = {}): LockedBooking => {
  const paysAtRequest = overrides.paysAtRequest ?? false;
  return {
    bookingId: LOCKED_BOOKING_ID,
    ownerId: OWNER_ID,
    bookedAt: new Date('2026-11-01T01:00:00Z'),
    paysAtRequest,
    termsVersion: paysAtRequest ? PAY_AT_REQUEST_TERMS_VERSION : '',
    rescheduleCount: 0,
    payment: guaranteePayment(),
    pets: [lockedPet(), lockedPet({ bookingPetsUuid: 'pet-b' })],
    ...overrides,
  };
};

/**
 * A pay-at-request booking (newer terms) whose $460 for two pets was charged when both were
 * confirmed: nothing is settled until the desk or a cancellation.
 */
export const chargedBooking = (overrides: Partial<LockedBooking> = {}): LockedBooking =>
  lockedBooking({
    paysAtRequest: true,
    payment: guaranteePayment({ status: 'succeeded', paymentIntentId: 'pi_charged' }),
    ...overrides,
  });
