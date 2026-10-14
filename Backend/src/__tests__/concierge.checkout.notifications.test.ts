vi.mock('../repositories/booking.agreement.repository.js', () => ({
  currentAgreementTerms: vi.fn(async () => 'terms-uuid'),
  agreementName: vi.fn(async () => 'Ava Mitchell'),
}));
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConciergeCheckoutRequest } from '../contracts/concierge.contract.js';
import { checkoutConciergeBooking } from '../services/concierge/concierge.checkout.js';
import { signAcceptedQuote, type SignedQuote } from '../services/concierge/concierge.tokens.js';
import { notifyBookingPlaced } from '../services/booking.notifications.js';
import * as bookingRepository from '../repositories/petparent.booking.repository.js';
import * as conciergeRepository from '../repositories/concierge.repository.js';
import { fakeCardSetupFor, TEST_SIGNING_SECRET } from './fixtures/concierge.fixtures.js';
import * as bookingCapacity from '../services/booking.capacity.js';
import { FakeCardProcessor } from '../services/payments/fake-card-processor.js';
import { setCardProcessorForTests } from '../services/payments/card-processor.factory.js';

/**
 * Checkout tells the parent their request arrived and the managers that one is waiting, once the
 * booking is saved and never before. What each notice says is tested in booking.notifications.
 */

vi.mock('../config/database.js', () => ({ pool: { query: vi.fn(), connect: vi.fn() } }));
vi.mock('../services/booking.notifications.js', () => ({ notifyBookingPlaced: vi.fn() }));
vi.mock('../repositories/petparent.booking.repository.js', () => ({
  getServiceCatalogByIds: vi.fn(),
  getOwnedPetIds: vi.fn(),
  createBooking: vi.fn(),
}));
vi.mock('../repositories/concierge.repository.js', async (importOriginal) => ({
  ...(await importOriginal<typeof conciergeRepository>()),
  createOwnerAndPets: vi.fn(),
  removeCreatedOwnerAndPets: vi.fn(),
  findBookingPetIds: vi.fn(),
  findPetNames: vi.fn(async () => new Map()),
  findSavedPetSpecies: vi.fn(),
  findSavedPetDietNotes: vi.fn(async () => new Map()),
}));
vi.mock('../repositories/auth.repository.js', () => ({ findUserByEmail: vi.fn() }));
vi.mock('../services/booking.capacity.js', async (importOriginal) => ({
  ...(await importOriginal<typeof bookingCapacity>()),
  findFullNights: vi.fn(async () => []),
  assertRoomForStay: vi.fn(async () => undefined),
}));

const ROOM_ID = '11111111-1111-4111-8111-000000000002';
const OWNER_ID = '00000000-0000-4000-8000-000000000301';
const PET_ID = '00000000-0000-4000-8000-000000000401';
const BOOKING_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

const quote: SignedQuote = {
  name: 'Garden suite',
  selection: {
    pets: [{ roomId: ROOM_ID, foodId: '11111111-1111-4111-8111-000000000004', addonIds: [] }],
  },
  startDate: '2026-10-12',
  endDate: '2026-10-15',
  nights: 3,
  pets: [{ species: 'dog', size: 'large', needsMedication: false, firstTimeBoarding: null }],
  lines: [{ serviceId: ROOM_ID, petIndex: 0, quantity: 1, unitPrice: 60, lineTotal: 180 }],
  total: 180,
  currency: 'NZD',
};

/** A signed-in owner booking one new pet. */
const signedInRequest = async (): Promise<ConciergeCheckoutRequest> => {
  const acceptedQuoteToken = await signAcceptedQuote(quote, new Date(Date.now() - 60_000));
  return {
    acceptedQuoteToken,
    cardSetupId: await fakeCardSetupFor(acceptedQuoteToken),
    pets: [{ newPet: { name: 'Max' } }],
    stay: { dropOffTime: '09:00', pickUpTime: '17:00' },
    agreement: { termsAccepted: true, vetConsentAccepted: true, termsVersionLabel: 'terms-v3' },
  };
};

describe('checkout notices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CONCIERGE_SIGNING_SECRET = TEST_SIGNING_SECRET;
    setCardProcessorForTests(new FakeCardProcessor());
    vi.mocked(bookingRepository.getServiceCatalogByIds).mockResolvedValue(
      new Map([
        [
          ROOM_ID,
          { name: 'Garden suite', price: 60, priceUnit: 'per night', category: 'boarding_rate' },
        ],
      ]),
    );
    vi.mocked(bookingRepository.getOwnedPetIds).mockResolvedValue(new Set());
    vi.mocked(bookingRepository.createBooking).mockResolvedValue({
      bookingId: BOOKING_ID,
      createdAt: '2026-10-01T02:01:00.000Z',
    });
    vi.mocked(conciergeRepository.createOwnerAndPets).mockResolvedValue({
      ownerId: OWNER_ID,
      accountCreated: false,
      petIds: [PET_ID],
    });
    vi.mocked(conciergeRepository.removeCreatedOwnerAndPets).mockResolvedValue(undefined);
    vi.mocked(conciergeRepository.findBookingPetIds).mockResolvedValue([]);
    vi.mocked(conciergeRepository.findSavedPetSpecies).mockResolvedValue(new Map());
  });

  it('tells the parent and the managers about the request once it is saved', async () => {
    const result = await checkoutConciergeBooking(await signedInRequest(), {
      signedInOwnerId: OWNER_ID,
    });

    // A pet without medication is confirmed at once; the notices go either way.
    expect(result.status).toBe('confirmed');
    expect(notifyBookingPlaced).toHaveBeenCalledTimes(1);
    expect(notifyBookingPlaced).toHaveBeenCalledWith(BOOKING_ID, expect.any(Array));
    const saved = vi.mocked(bookingRepository.createBooking).mock.invocationCallOrder[0] ?? 0;
    const notified = vi.mocked(notifyBookingPlaced).mock.invocationCallOrder[0] ?? 0;
    expect(notified).toBeGreaterThan(saved);
  });

  it('sends no notice when the booking was not saved', async () => {
    vi.mocked(bookingRepository.createBooking).mockRejectedValueOnce(new Error('db down'));

    await expect(
      checkoutConciergeBooking(await signedInRequest(), { signedInOwnerId: OWNER_ID }),
    ).rejects.toThrow('db down');

    expect(notifyBookingPlaced).not.toHaveBeenCalled();
  });
});
