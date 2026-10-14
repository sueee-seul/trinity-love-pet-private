import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  findStayGuarantees,
  type StayGuaranteeRow,
} from '../repositories/petparent.stay-guarantee.repository.js';
import { setCardProcessorForTests } from '../services/payments/card-processor.factory.js';
import type { CardProcessor } from '../services/payments/card-processor.js';
import { listMyBookings, type MyBookingSummary } from '../services/petparent.booking.js';
import { listMyStays } from '../services/petparent.stays-with-card.js';

vi.mock('../services/petparent.booking.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/petparent.booking.js')>()),
  listMyBookings: vi.fn(),
}));

vi.mock('../repositories/petparent.stay-guarantee.repository.js', () => ({
  findStayGuarantees: vi.fn(),
}));

const stay = (bookingPetId: string): MyBookingSummary => ({
  bookingPetId,
  bookingId: 'booking-1',
  confirmationNumber: 'PB-AAAAAA',
  createdAt: '2026-11-01T01:00:00.000Z',
  pet: { id: 'pet-1', name: 'Biscuit' },
  dropOffAt: '2026-12-11T21:30:00.000Z',
  pickUpAt: '2026-12-15T03:00:00.000Z',
  status: 'approved',
  reviewStatus: 'approved',
  refusalReason: null,
  reviewerName: null,
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
  getReady: null,
});

const row = (overrides: Partial<StayGuaranteeRow>): StayGuaranteeRow => ({
  booking_pets_uuid: 'bp-1',
  check_in_outcome: null,
  reschedule_count: 0,
  terms_version: 'concierge-terms-2026-10-06',
  card_status: 'authorized',
  card_amount: 460,
  card_captured_amount: null,
  card_processor: 'stripe',
  ...overrides,
});

beforeEach(() => {
  setCardProcessorForTests({ name: 'stripe', testMode: false } as CardProcessor);
});

describe('My stays with the card behind each stay', () => {
  it('adds each stay’s card and the date changes its terms still allow', async () => {
    vi.mocked(listMyBookings).mockResolvedValue([stay('bp-1'), stay('bp-2'), stay('bp-3')]);
    vi.mocked(findStayGuarantees).mockResolvedValue([
      row({ reschedule_count: 1, terms_version: 'concierge-terms-2026-10-02' }),
      row({
        booking_pets_uuid: 'bp-2',
        card_status: 'canceled',
        card_captured_amount: 0,
      }),
      row({
        booking_pets_uuid: 'bp-3',
        card_status: null,
        card_amount: null,
        card_processor: null,
      }),
    ]);

    const [held, cancelled, classic] = await listMyStays('owner-1');

    expect(held).toMatchObject({
      // The 2026-10-02 terms allowed one free change, and it was used.
      dateChangesLeft: 0,
      card: {
        status: 'authorized',
        amount: 460,
        capturedAmount: null,
        testMode: false,
        paysAtRequest: true,
      },
    });
    // The current terms set no limit.
    expect(cancelled).toMatchObject({ dateChangesLeft: null, card: { capturedAmount: 0 } });
    expect(classic).toMatchObject({ card: null });
  });

  it('gives a booking with no recorded terms the older one free change', async () => {
    vi.mocked(listMyBookings).mockResolvedValue([stay('bp-1')]);
    vi.mocked(findStayGuarantees).mockResolvedValue([row({ terms_version: '' })]);

    const [older] = await listMyStays('owner-1');
    expect(older?.dateChangesLeft).toBe(1);
    // Held 48 hours ahead and charged at the desk, not at request.
    expect(older?.card?.paysAtRequest).toBe(false);
  });

  it('never presents a test as a real hold', async () => {
    vi.mocked(listMyBookings).mockResolvedValue([stay('bp-1')]);
    vi.mocked(findStayGuarantees).mockResolvedValue([row({ card_processor: 'fake' })]);

    const [fake] = await listMyStays('owner-1');
    expect(fake?.card?.testMode).toBe(true);

    setCardProcessorForTests({ name: 'stripe', testMode: true } as CardProcessor);
    vi.mocked(findStayGuarantees).mockResolvedValue([row({})]);
    const [stripeTest] = await listMyStays('owner-1');
    expect(stripeTest?.card?.testMode).toBe(true);
  });
});
