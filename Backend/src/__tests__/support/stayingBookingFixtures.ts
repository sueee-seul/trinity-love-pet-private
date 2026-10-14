import type { LockedBooking } from '../../repositories/booking.check-in.repository.js';
import type { BookingChargeRow } from '../../repositories/booking.charges.repository.js';
import { chargedBooking, guaranteePayment, lockedPet } from './lockedBookingFixtures.js';

/**
 * Biscuit and Mochi are in the facility: both checked in on Sat 12 Dec 2026 at 10:30 Auckland,
 * booked to leave Tue 15 Dec at 16:00, $60 a night each plus a $50 flat extra, and the desk has
 * finished check-in ($460 kept on the charged payment).
 */

/** Sun 13 Dec 2026, 11:00 in Auckland: the second day of the stay. */
export const DURING_STAY = new Date('2026-12-12T22:00:00Z');

export const stayingBooking = (overrides: Partial<LockedBooking> = {}): LockedBooking =>
  chargedBooking({
    payment: guaranteePayment({
      status: 'succeeded',
      paymentIntentId: 'pi_charged',
      capturedAmount: 460,
    }),
    pets: [
      lockedPet({ outcome: 'checked_in' }),
      lockedPet({ bookingPetsUuid: 'pet-b', outcome: 'checked_in' }),
    ],
    ...overrides,
  });

export const ledgerCharge = (overrides: Partial<BookingChargeRow> = {}): BookingChargeRow => ({
  uuid: 'charge-1',
  bookingPetsUuid: null,
  kind: 'extension',
  servicesUuid: null,
  serviceDate: null,
  quantity: null,
  description: 'Stay extended to 2026-12-16: 1 night at the booked rates',
  amount: 120,
  processor: 'stripe',
  paymentIntentId: 'pi_ext',
  idempotencyKey: 'extend-x-2026-12-16-1',
  createdAt: new Date('2026-12-12T23:00:00Z'),
  ...overrides,
});
