vi.mock('../repositories/booking.agreement.repository.js', () => ({
  currentAgreementTerms: vi.fn(async () => 'terms-uuid'),
  agreementName: vi.fn(async () => 'Ava Mitchell'),
}));
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConciergeCheckoutRequest } from '../contracts/concierge.contract.js';
import { checkoutConciergeBooking } from '../services/concierge/concierge.checkout.js';
import { signAcceptedQuote, type SignedQuote } from '../services/concierge/concierge.tokens.js';
import * as bookingRepository from '../repositories/petparent.booking.repository.js';
import * as conciergeRepository from '../repositories/concierge.repository.js';
import { fakeCardSetupFor, TEST_SIGNING_SECRET } from './fixtures/concierge.fixtures.js';
import * as bookingCapacity from '../services/booking.capacity.js';
import { FakeCardProcessor } from '../services/payments/fake-card-processor.js';
import { setCardProcessorForTests } from '../services/payments/card-processor.factory.js';

/**
 * The booking page links a pet typed in the chat to the saved pet with the same name and kind,
 * and sends its id. Checkout must book that saved pet itself: never a second copy of it, and
 * never removed when a failed attempt cleans up after itself.
 */

vi.mock('../config/database.js', () => ({ pool: { query: vi.fn(), connect: vi.fn() } }));
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
}));
vi.mock('../repositories/auth.repository.js', () => ({ findUserByEmail: vi.fn() }));
vi.mock('../services/booking.capacity.js', async (importOriginal) => ({
  ...(await importOriginal<typeof bookingCapacity>()),
  findFullNights: vi.fn(async () => []),
  assertRoomForStay: vi.fn(async () => undefined),
}));

const ROOM_ID = '11111111-1111-4111-8111-000000000002';
const OWNER_ID = '00000000-0000-4000-8000-000000000301';
const SAVED_MAX_ID = '00000000-0000-4000-8000-000000000401';
const NEW_LUNA_ID = '00000000-0000-4000-8000-000000000402';

const quote: SignedQuote = {
  name: 'Garden suite',
  selection: {
    pets: [
      { roomId: ROOM_ID, foodId: '11111111-1111-4111-8111-000000000004', addonIds: [] },
      { roomId: ROOM_ID, foodId: '11111111-1111-4111-8111-000000000004', addonIds: [] },
    ],
  },
  startDate: '2026-10-12',
  endDate: '2026-10-15',
  nights: 3,
  pets: [
    { species: 'dog', size: 'large', needsMedication: true, firstTimeBoarding: false },
    { species: 'cat', size: null, needsMedication: null, firstTimeBoarding: null },
  ],
  lines: [
    { serviceId: ROOM_ID, petIndex: 0, quantity: 1, unitPrice: 60, lineTotal: 180 },
    { serviceId: ROOM_ID, petIndex: 1, quantity: 1, unitPrice: 60, lineTotal: 180 },
  ],
  total: 360,
  currency: 'NZD',
};

/** A signed-in owner: no contact details, no email proof, Max by id and Luna described. */
const savedMaxAndNewLuna = async (): Promise<ConciergeCheckoutRequest> => {
  const acceptedQuoteToken = await signAcceptedQuote(quote, new Date(Date.now() - 60_000));
  return {
    acceptedQuoteToken,
    cardSetupId: await fakeCardSetupFor(acceptedQuoteToken),
    pets: [{ existingPetId: SAVED_MAX_ID }, { newPet: { name: 'Luna' } }],
    stay: { dropOffTime: '09:00', pickUpTime: '17:00' },
    agreement: { termsAccepted: true, vetConsentAccepted: true, termsVersionLabel: 'terms-v3' },
  };
};

describe('checkout with a saved pet', () => {
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
    vi.mocked(bookingRepository.getOwnedPetIds).mockResolvedValue(new Set([SAVED_MAX_ID]));
    vi.mocked(bookingRepository.createBooking).mockResolvedValue({
      bookingId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      createdAt: '2026-10-01T02:01:00.000Z',
    });
    vi.mocked(conciergeRepository.createOwnerAndPets).mockResolvedValue({
      ownerId: OWNER_ID,
      accountCreated: false,
      petIds: [NEW_LUNA_ID],
    });
    vi.mocked(conciergeRepository.removeCreatedOwnerAndPets).mockResolvedValue(undefined);
    vi.mocked(conciergeRepository.findBookingPetIds).mockResolvedValue([]);
    vi.mocked(conciergeRepository.findSavedPetSpecies).mockResolvedValue(
      new Map([[SAVED_MAX_ID, 'Dog']]),
    );
  });

  it('books the saved pet by its id and creates only the pet that is new', async () => {
    await checkoutConciergeBooking(await savedMaxAndNewLuna(), { signedInOwnerId: OWNER_ID });

    expect(conciergeRepository.createOwnerAndPets).toHaveBeenCalledWith({
      existingOwnerId: OWNER_ID,
      newOwner: undefined,
      pets: [{ name: 'Luna', species: 'cat' }],
    });
    const booking = vi.mocked(bookingRepository.createBooking).mock.calls[0]?.[0];
    expect(booking?.pets.map((pet) => pet.petId)).toEqual([SAVED_MAX_ID, NEW_LUNA_ID]);
    // What the account knew about Max reaches staff with the saved pet, not with a copy of it.
    expect(booking?.pets[0]?.info.firstTimeBoarding).toBe(false);
    expect(booking?.pets[0]?.info.medInstruction).toMatch(/needs medication/);
  });

  it('never removes the saved pet when a failed attempt cleans up', async () => {
    vi.mocked(bookingRepository.createBooking).mockRejectedValueOnce(new Error('db down'));

    await expect(
      checkoutConciergeBooking(await savedMaxAndNewLuna(), { signedInOwnerId: OWNER_ID }),
    ).rejects.toThrow('db down');

    expect(conciergeRepository.removeCreatedOwnerAndPets).toHaveBeenCalledWith({
      ownerId: OWNER_ID,
      accountCreated: false,
      petIds: [NEW_LUNA_ID],
    });
  });
});
