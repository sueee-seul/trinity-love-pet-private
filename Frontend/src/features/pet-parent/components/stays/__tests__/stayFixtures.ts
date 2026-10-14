import type { PetStay } from '../../../types/stays';

/**
 * Biscuit's approved stay from 10:30 on Sat 12 Dec to 16:00 on Tue 15 Dec 2026 (Auckland), made
 * with a saved card whose $460 hold covers Biscuit and Mochi.
 */
export const bookedStay = (overrides: Partial<PetStay> = {}): PetStay => ({
  bookingPetId: 'bp-biscuit',
  bookingId: 'booking-1',
  confirmationNumber: 'PB-AAAAAA',
  createdAt: '2026-11-01T01:00:00.000Z',
  pet: { id: 'pet-biscuit', name: 'Biscuit' },
  dropOffAt: '2026-12-11T21:30:00.000Z',
  pickUpAt: '2026-12-15T03:00:00.000Z',
  nights: 3,
  serviceType: 'Garden suite',
  services: [],
  caringInfo: {
    feedingRoutine: '',
    medInstruction: '',
    firstTimeBoarding: null,
    crateTrained: null,
    socialAllow: null,
    fullyVaccinated: null,
    behaveNHealth: '',
    others: '',
  },
  total: 230,
  status: 'approved',
  reviewStatus: 'approved',
  refusalReason: null,
  reviewerName: null,
  getReady: null,
  checkInOutcome: null,
  dateChangesLeft: null,
  card: {
    status: 'authorized',
    amount: 460,
    capturedAmount: null,
    testMode: true,
    paysAtRequest: false,
  },
  ...overrides,
});
