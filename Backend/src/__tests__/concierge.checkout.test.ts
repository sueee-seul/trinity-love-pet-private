import { currentAgreementTerms } from '../repositories/booking.agreement.repository.js';
vi.mock('../repositories/booking.agreement.repository.js', () => ({
  currentAgreementTerms: vi.fn(async () => 'terms-uuid'),
  agreementName: vi.fn(async () => 'Ava Mitchell'),
}));
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  conciergeContactSchema,
  type ConciergeCheckoutRequest,
} from '../contracts/concierge.contract.js';
import { checkoutConciergeBooking } from '../services/concierge/concierge.checkout.js';
import { AcceptanceRegistry } from '../services/concierge/concierge.acceptance-registry.js';
import {
  signAcceptedQuote,
  signVerifiedEmail,
  verifyAcceptedQuote,
  type SignedQuote,
} from '../services/concierge/concierge.tokens.js';
import { FakeCardProcessor } from '../services/payments/fake-card-processor.js';
import { setCardProcessorForTests } from '../services/payments/card-processor.factory.js';
import * as bookingRepository from '../repositories/petparent.booking.repository.js';
import * as conciergeRepository from '../repositories/concierge.repository.js';
import * as authRepository from '../repositories/auth.repository.js';
import * as bookingCapacity from '../services/booking.capacity.js';
import { fakeCardSetupFor, TEST_SIGNING_SECRET } from './fixtures/concierge.fixtures.js';
import { OWNER_SAID_NEEDS_MEDICATION_NOTE } from '../common/utils/booking-care-notes.js';
import { notifyBookingPlaced } from '../services/booking.notifications.js';
import { createTasksForBookingPet } from '../services/task.fromBooking.service.js';
import * as checkoutHold from '../services/concierge/concierge.checkout-hold.js';

/** Relative to now: accepted-quote tokens expire after an hour, so a fixed date would rot. */
const ACCEPTED_AT = new Date(Date.now() - 60_000);

vi.mock('../config/database.js', () => ({ pool: { query: vi.fn(), connect: vi.fn() } }));
vi.mock('../repositories/petparent.booking.repository.js', () => ({
  getServiceCatalogByIds: vi.fn(),
  getOwnedPetIds: vi.fn(),
  createBooking: vi.fn(),
  listServices: vi.fn(),
  listPetsForOwner: vi.fn(),
}));
vi.mock('../repositories/concierge.repository.js', async (importOriginal) => {
  const actual = await importOriginal<typeof conciergeRepository>();
  return {
    ...actual,
    createOwnerAndPets: vi.fn(),
    removeCreatedOwnerAndPets: vi.fn(),
    findBookingPetIds: vi.fn(),
    emailHasPasswordAccount: vi.fn(),
    findSavedPetSpecies: vi.fn(),
    findSavedPetDietNotes: vi.fn(async () => new Map()),
    findPetNames: vi.fn(),
  };
});
vi.mock('../services/task.fromBooking.service.js', () => ({
  createTasksForBookingPet: vi.fn(async () => ({ tasks: [] })),
}));
vi.mock('../repositories/auth.repository.js', () => ({ findUserByEmail: vi.fn() }));
vi.mock('../services/booking.notifications.js', () => ({ notifyBookingPlaced: vi.fn() }));
// The hold is placed for real on the fake card; charging a confirmed request locks the booking in
// the database, so that step is replaced here (concierge.checkout-hold.test.ts covers it).
vi.mock('../services/concierge/concierge.checkout-hold.js', async (importOriginal) => {
  const actual = await importOriginal<typeof checkoutHold>();
  return {
    ...actual,
    chargeConfirmedRequest: vi.fn(async () => 'charged'),
    releaseUnusedHold: vi.fn(),
  };
});
vi.mock('../services/booking.capacity.js', async (importOriginal) => {
  const actual = await importOriginal<typeof bookingCapacity>();
  return { ...actual, findFullNights: vi.fn(), assertRoomForStay: vi.fn() };
});

const ROOM_ID = '11111111-1111-4111-8111-000000000002';
const FOOD_ID = '11111111-1111-4111-8111-000000000005';
const OWNER_ID = '00000000-0000-4000-8000-000000000301';
const PET_ID = '00000000-0000-4000-8000-000000000401';
const BOOKING_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

const QUOTED_PET: SignedQuote['pets'][number] = {
  species: 'dog',
  size: 'large',
  needsMedication: false,
  firstTimeBoarding: true,
};

const quote: SignedQuote = {
  name: 'Garden suite and Premium food',
  selection: { pets: [{ roomId: ROOM_ID, foodId: FOOD_ID, addonIds: [] }] },
  startDate: '2026-10-12',
  endDate: '2026-10-15',
  nights: 3,
  pets: [QUOTED_PET],
  lines: [
    { serviceId: ROOM_ID, petIndex: 0, quantity: 1, unitPrice: 60, lineTotal: 180 },
    { serviceId: FOOD_ID, petIndex: 0, quantity: 1, unitPrice: 8, lineTotal: 24 },
  ],
  total: 204,
  currency: 'NZD',
};

/** The same stay for a pet the guest said takes medication, which a manager checks first. */
const medicatedQuote: SignedQuote = { ...quote, pets: [{ ...QUOTED_PET, needsMedication: true }] };

const catalogueAtQuotePrices = new Map([
  [
    ROOM_ID,
    { name: 'Garden suite', price: 60, priceUnit: 'per night', category: 'boarding_rate' as const },
  ],
  [FOOD_ID, { name: 'Premium food', price: 8, priceUnit: 'per day', category: 'food' as const }],
]);

const contact = {
  firstName: 'Ava',
  lastName: 'Mitchell',
  address: '12 Queen Street, Auckland',
  phone: '021 555 0199',
};

/** The fake processor's setup id carries the acceptance it was made for. */
const buildRequest = async (
  overrides: Partial<ConciergeCheckoutRequest> = {},
): Promise<ConciergeCheckoutRequest> => {
  const acceptedQuoteToken =
    overrides.acceptedQuoteToken ?? (await signAcceptedQuote(quote, ACCEPTED_AT));
  return {
    acceptedQuoteToken,
    verificationToken: await signVerifiedEmail('ava@example.test'),
    cardSetupId: await fakeCardSetupFor(acceptedQuoteToken),
    contact,
    pets: [{ newPet: { name: 'Biscuit', breed: 'Labrador' } }],
    stay: { dropOffTime: '09:00', pickUpTime: '17:00' },
    agreement: { termsAccepted: true, vetConsentAccepted: true, termsVersionLabel: 'terms-v3' },
    ...overrides,
  };
};

/** 11 days before drop-off at 9am 12 Oct (NZDT): the hold waits for the reminder job. */
const WELL_AHEAD = new Date('2026-10-01T02:00:00.000Z');
/** 46 hours before drop-off: still no hold at checkout, only after approval. */
const INSIDE_48_HOURS = new Date('2026-10-09T22:00:00.000Z');

describe('checkoutConciergeBooking', () => {
  const originalSecret = process.env.CONCIERGE_SIGNING_SECRET;

  beforeEach(() => {
    process.env.CONCIERGE_SIGNING_SECRET = TEST_SIGNING_SECRET;
    vi.mocked(bookingRepository.getServiceCatalogByIds).mockResolvedValue(catalogueAtQuotePrices);
    vi.mocked(bookingRepository.createBooking).mockResolvedValue({
      bookingId: BOOKING_ID,
      createdAt: '2026-10-01T02:01:00.000Z',
    });
    vi.mocked(conciergeRepository.createOwnerAndPets).mockResolvedValue({
      ownerId: OWNER_ID,
      accountCreated: true,
      petIds: [PET_ID],
    });
    vi.mocked(authRepository.findUserByEmail).mockResolvedValue(null);
    vi.mocked(conciergeRepository.removeCreatedOwnerAndPets).mockResolvedValue(undefined);
    vi.mocked(conciergeRepository.findBookingPetIds).mockResolvedValue([]);
    vi.mocked(conciergeRepository.emailHasPasswordAccount).mockResolvedValue(false);
    vi.mocked(conciergeRepository.findSavedPetSpecies).mockResolvedValue(new Map());
    vi.mocked(conciergeRepository.findPetNames).mockResolvedValue(new Map([[PET_ID, 'Biscuit']]));
    vi.mocked(bookingCapacity.findFullNights).mockResolvedValue([]);
    vi.mocked(bookingCapacity.assertRoomForStay).mockResolvedValue(undefined);
    setCardProcessorForTests(new FakeCardProcessor());
  });

  afterEach(() => {
    process.env.CONCIERGE_SIGNING_SECRET = originalSecret;
    setCardProcessorForTests(undefined);
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('rejects a stale displayed version before creating an account', async () => {
    vi.mocked(currentAgreementTerms).mockRejectedValueOnce(
      Object.assign(new Error('Refresh terms'), { code: 'TERMS_VERSION_CHANGED', statusCode: 409 }),
    );
    await expect(checkoutConciergeBooking(await buildRequest(), {})).rejects.toMatchObject({
      code: 'TERMS_VERSION_CHANGED',
    });
    expect(conciergeRepository.createOwnerAndPets).not.toHaveBeenCalled();
    expect(bookingRepository.createBooking).not.toHaveBeenCalled();
  });

  it('creates an account and records a request at the quoted price, with its price held', async () => {
    const request = await buildRequest({
      acceptedQuoteToken: await signAcceptedQuote(medicatedQuote, ACCEPTED_AT),
    });
    const { acceptanceId } = await verifyAcceptedQuote(request.acceptedQuoteToken);
    const result = await checkoutConciergeBooking(request, {}, { now: () => WELL_AHEAD });

    expect(conciergeRepository.createOwnerAndPets).toHaveBeenCalledWith({
      existingOwnerId: undefined,
      newOwner: { email: 'ava@example.test', ...contact },
      pets: [{ name: 'Biscuit', breed: 'Labrador', species: 'dog' }],
    });
    const booking = vi.mocked(bookingRepository.createBooking).mock.calls[0]?.[0];
    // The full price is held before the request is recorded; a waiting pet is not charged yet.
    expect(booking?.payment).toEqual({
      amount: 204,
      currency: 'NZD',
      processor: 'fake',
      processorPaymentMethodId: `fake_pm_${acceptanceId}`,
      status: 'authorized',
      processorPaymentIntentId: `fake_pi_request-hold-${acceptanceId}`,
    });
    // Our manager has 24 hours to decide.
    expect(result.payment).toEqual({
      status: 'held',
      amount: 204,
      reviewBy: '2026-10-02T02:00:00.000Z',
      testMode: true,
    });
    expect(checkoutHold.chargeConfirmedRequest).not.toHaveBeenCalled();
    // The terms are agreed when the request is sent, after the package was chosen, so the
    // agreement carries the send time rather than the quote's acceptance time.
    expect(booking?.agreement.fullName).toBe('Ava Mitchell');
    expect(booking?.agreement.agreedAt).toEqual(WELL_AHEAD);
    expect(booking?.pets[0]?.info.fullyVaccinated).toBeNull();
    // 9am and 5pm in Auckland (NZDT, UTC+13 in October), whatever the server's own time zone.
    expect(booking?.pets[0]?.dropOffAt.toISOString()).toBe('2026-10-11T20:00:00.000Z');
    expect(booking?.pets[0]?.pickUpAt.toISOString()).toBe('2026-10-15T04:00:00.000Z');
    // A pet on medication waits for a manager: the booking row carries the saved card, the pet is pending.
    expect(booking?.recording).toEqual({ bookingStatus: 'confirmed', petReviewStatus: 'pending' });
    expect(booking?.pets[0]?.reviewStatus).toBe('pending');
    expect(result).toMatchObject({
      status: 'awaiting_manager_approval',
      pets: [{ name: 'Biscuit', status: 'waiting_for_review', reviewReasons: ['medication'] }],
      accountCreated: true,
      total: 204,
      confirmationNumber: 'PB-AAAAAA',
      safetyTasks: ['vaccination_certificate'],
    });
    expect(notifyBookingPlaced).toHaveBeenCalledWith(BOOKING_ID, [
      { name: 'Biscuit', reasons: ['medication'] },
    ]);
    expect(createTasksForBookingPet).not.toHaveBeenCalled();
  });

  it('confirms a new pet without medication at once and gives it a care plan', async () => {
    vi.mocked(conciergeRepository.findBookingPetIds).mockResolvedValue(['booking-pet-1']);

    const result = await checkoutConciergeBooking(
      await buildRequest(),
      {},
      { now: () => WELL_AHEAD },
    );

    const booking = vi.mocked(bookingRepository.createBooking).mock.calls[0]?.[0];
    expect(booking?.pets[0]?.reviewStatus).toBe('approved');
    expect(result).toMatchObject({
      status: 'confirmed',
      pets: [{ name: 'Biscuit', status: 'confirmed', reviewReasons: [] }],
      // Nobody waits for a manager, so the price is charged at once.
      payment: { status: 'charged', amount: 204, reviewBy: null },
    });
    expect(checkoutHold.chargeConfirmedRequest).toHaveBeenCalledWith(BOOKING_ID, expect.anything());
    expect(createTasksForBookingPet).toHaveBeenCalledWith('booking-pet-1');
    expect(notifyBookingPlaced).toHaveBeenCalledWith(BOOKING_ID, [
      { name: 'Biscuit', reasons: [] },
    ]);
    // The care plan exists before the parent is told the stay is confirmed.
    const planned = vi.mocked(createTasksForBookingPet).mock.invocationCallOrder[0] ?? 0;
    const told = vi.mocked(notifyBookingPlaced).mock.invocationCallOrder[0] ?? 0;
    expect(told).toBeGreaterThan(planned);
  });

  it('keeps the booking confirmed when the care plan cannot be made', async () => {
    vi.mocked(conciergeRepository.findBookingPetIds).mockResolvedValue(['booking-pet-1']);
    vi.mocked(createTasksForBookingPet).mockRejectedValueOnce(new Error('tasks down'));
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await checkoutConciergeBooking(
      await buildRequest(),
      {},
      { now: () => WELL_AHEAD },
    );

    expect(result.status).toBe('confirmed');
    expect(notifyBookingPlaced).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain('Biscuit');
    errorLog.mockRestore();
  });

  it('gives our manager 24 hours for a request made two days before drop-off', async () => {
    const result = await checkoutConciergeBooking(
      await buildRequest({
        acceptedQuoteToken: await signAcceptedQuote(medicatedQuote, ACCEPTED_AT),
      }),
      {},
      { now: () => INSIDE_48_HOURS },
    );

    // Drop-off is 46 hours away, so the full 24 hours fit (the drop-off cap is in fee-policy).
    expect(result.payment).toMatchObject({ status: 'held', reviewBy: '2026-10-10T22:00:00.000Z' });
  });

  it('books nothing when the card is declined, and creates no account', async () => {
    const processor = new FakeCardProcessor();
    vi.spyOn(processor, 'placeHold').mockResolvedValue({
      status: 'failed',
      paymentIntentId: 'fake_pi_declined',
      reason: 'declined',
    });

    await expect(
      checkoutConciergeBooking(await buildRequest(), {}, { cardProcessor: processor }),
    ).rejects.toMatchObject({ code: 'CONCIERGE_CARD_DECLINED', statusCode: 402 });
    expect(conciergeRepository.createOwnerAndPets).not.toHaveBeenCalled();
    expect(bookingRepository.createBooking).not.toHaveBeenCalled();
  });

  it('lets the hold go when the request cannot be recorded', async () => {
    vi.mocked(bookingRepository.createBooking).mockRejectedValueOnce(new Error('write failed'));
    const request = await buildRequest();
    const { acceptanceId } = await verifyAcceptedQuote(request.acceptedQuoteToken);

    await expect(checkoutConciergeBooking(request, {})).rejects.toThrow('write failed');
    expect(checkoutHold.releaseUnusedHold).toHaveBeenCalledWith(
      expect.anything(),
      `fake_pi_request-hold-${acceptanceId}`,
    );
  });

  it('refuses a card saved for a different booking', async () => {
    await expect(
      checkoutConciergeBooking(
        await buildRequest({ cardSetupId: 'fake_seti_another-booking' }),
        {},
      ),
    ).rejects.toMatchObject({ code: 'CONCIERGE_CARD_MISMATCH', statusCode: 409 });
    expect(conciergeRepository.createOwnerAndPets).not.toHaveBeenCalled();
  });

  it('refuses to book when card payments are not set up', async () => {
    setCardProcessorForTests(null);

    await expect(checkoutConciergeBooking(await buildRequest(), {})).rejects.toMatchObject({
      code: 'CONCIERGE_PAYMENTS_NOT_CONFIGURED',
      statusCode: 503,
    });
    expect(conciergeRepository.createOwnerAndPets).not.toHaveBeenCalled();
  });

  it('refuses a full night before creating an account', async () => {
    vi.mocked(bookingCapacity.findFullNights).mockResolvedValue(['2026-10-13']);

    await expect(checkoutConciergeBooking(await buildRequest(), {})).rejects.toMatchObject({
      code: 'CONCIERGE_FULLY_BOOKED',
      statusCode: 409,
      details: [{ night: '2026-10-13' }],
    });
    expect(bookingCapacity.findFullNights).toHaveBeenCalledWith({
      startDate: '2026-10-12',
      endDate: '2026-10-15',
      petCount: 1,
    });
    expect(conciergeRepository.createOwnerAndPets).not.toHaveBeenCalled();
    expect(bookingRepository.createBooking).not.toHaveBeenCalled();
  });

  it('checks capacity again inside the booking transaction', async () => {
    await checkoutConciergeBooking(await buildRequest(), {});

    const booking = vi.mocked(bookingRepository.createBooking).mock.calls[0]?.[0];
    const transactionClient = { query: vi.fn() };
    await booking?.beforeWrite?.(transactionClient as never);
    expect(bookingCapacity.assertRoomForStay).toHaveBeenCalledWith(transactionClient, {
      startDate: '2026-10-12',
      endDate: '2026-10-15',
      petCount: 1,
    });
  });

  it('removes the new account when the last place goes during checkout', async () => {
    vi.mocked(bookingRepository.createBooking).mockRejectedValueOnce(
      bookingCapacity.fullyBookedError(['2026-10-12']),
    );

    await expect(checkoutConciergeBooking(await buildRequest(), {})).rejects.toMatchObject({
      code: 'CONCIERGE_FULLY_BOOKED',
    });
    expect(conciergeRepository.removeCreatedOwnerAndPets).toHaveBeenCalledWith({
      ownerId: OWNER_ID,
      accountCreated: true,
      petIds: [PET_ID],
    });
  });

  it('books at the agreed price even if the catalogue price has changed since', async () => {
    vi.mocked(bookingRepository.getServiceCatalogByIds).mockResolvedValue(
      new Map([
        [
          ROOM_ID,
          { name: 'Garden suite', price: 65, priceUnit: 'per night', category: 'boarding_rate' },
        ],
        [FOOD_ID, { name: 'Premium food', price: 8, priceUnit: 'per day', category: 'food' }],
      ]),
    );

    const result = await checkoutConciergeBooking(await buildRequest(), {});

    const booking = vi.mocked(bookingRepository.createBooking).mock.calls[0]?.[0];
    expect(result.total).toBe(204);
    expect(booking?.payment.amount).toBe(204);
    expect(booking?.pets[0]?.services.map((service) => service.priceAtBooking)).toEqual([60, 8]);
  });

  it('refuses a quote whose service is no longer offered', async () => {
    vi.mocked(bookingRepository.getServiceCatalogByIds).mockResolvedValue(
      new Map([
        [FOOD_ID, { name: 'Premium food', price: 8, priceUnit: 'per day', category: 'food' }],
      ]),
    );

    await expect(checkoutConciergeBooking(await buildRequest(), {})).rejects.toMatchObject({
      code: 'CONCIERGE_QUOTE_STALE',
    });
    expect(bookingRepository.createBooking).not.toHaveBeenCalled();
  });

  it('returns each booked pet row so the confirmation can link its safety tasks', async () => {
    vi.mocked(conciergeRepository.findBookingPetIds).mockResolvedValue(['booking-pet-1']);

    const result = await checkoutConciergeBooking(await buildRequest(), {});

    expect(result.bookingPetIds).toEqual(['booking-pet-1']);
  });

  it('still confirms the booking when the pet rows cannot be read back', async () => {
    vi.mocked(conciergeRepository.findBookingPetIds).mockRejectedValue(new Error('read failed'));
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await checkoutConciergeBooking(await buildRequest(), {});

    expect(result.bookingPetIds).toEqual([]);
    expect(result.confirmationNumber).toBe('PB-AAAAAA');
    errorLog.mockRestore();
  });

  it('requires a verified email when the guest is not signed in', async () => {
    const request = await buildRequest();
    delete request.verificationToken;

    await expect(checkoutConciergeBooking(request, {})).rejects.toMatchObject({
      code: 'CONCIERGE_EMAIL_UNVERIFIED',
    });
  });

  it('requires one pet entry per quoted pet', async () => {
    const request = await buildRequest({
      pets: [{ newPet: { name: 'Biscuit' } }, { newPet: { name: 'Scout' } }],
    });

    await expect(checkoutConciergeBooking(request, {})).rejects.toMatchObject({
      code: 'CONCIERGE_PET_COUNT_MISMATCH',
    });
  });

  it('refuses a saved pet that belongs to someone else', async () => {
    vi.mocked(bookingRepository.getOwnedPetIds).mockResolvedValue(new Set());
    const request = await buildRequest({ pets: [{ existingPetId: PET_ID }] });

    await expect(
      checkoutConciergeBooking(request, { signedInOwnerId: OWNER_ID }),
    ).rejects.toMatchObject({ code: 'CONCIERGE_PET_NOT_OWNED' });
  });

  it('refuses a staff email', async () => {
    vi.mocked(authRepository.findUserByEmail).mockResolvedValue({
      id: OWNER_ID,
      email: 'ava@example.test',
      username: 'ava',
      name: 'Ava',
      is_employee: true,
      is_pet_owner: false,
      staff_role: 'staff',
      is_temporary_password: false,
    });

    await expect(checkoutConciergeBooking(await buildRequest(), {})).rejects.toMatchObject({
      code: 'CONCIERGE_STAFF_EMAIL',
    });
  });

  it('books a signed-in owner without creating an account', async () => {
    vi.mocked(bookingRepository.getOwnedPetIds).mockResolvedValue(new Set([PET_ID]));
    vi.mocked(conciergeRepository.createOwnerAndPets).mockResolvedValue({
      ownerId: OWNER_ID,
      accountCreated: false,
      petIds: [],
    });
    const request = await buildRequest({ pets: [{ existingPetId: PET_ID }] });
    delete request.contact;
    delete request.verificationToken;

    const result = await checkoutConciergeBooking(request, { signedInOwnerId: OWNER_ID });

    expect(result.accountCreated).toBe(false);
    expect(vi.mocked(bookingRepository.createBooking).mock.calls[0]?.[0].pets[0]?.petId).toBe(
      PET_ID,
    );
  });

  it('books an accepted quote only once', async () => {
    const acceptances = new AcceptanceRegistry();
    const request = await buildRequest();

    await checkoutConciergeBooking(request, {}, { acceptances });
    await expect(checkoutConciergeBooking(request, {}, { acceptances })).rejects.toMatchObject({
      code: 'CONCIERGE_ALREADY_SUBMITTED',
      message: expect.stringContaining('PB-AAAAAA'),
    });
    expect(bookingRepository.createBooking).toHaveBeenCalledTimes(1);
  });

  it('lets the guest retry after a failed attempt and cleans up what it created', async () => {
    const acceptances = new AcceptanceRegistry();
    const request = await buildRequest();
    vi.mocked(bookingRepository.createBooking).mockRejectedValueOnce(new Error('db down'));

    await expect(checkoutConciergeBooking(request, {}, { acceptances })).rejects.toThrow('db down');
    expect(conciergeRepository.removeCreatedOwnerAndPets).toHaveBeenCalledWith({
      ownerId: OWNER_ID,
      accountCreated: true,
      petIds: [PET_ID],
    });

    await expect(checkoutConciergeBooking(request, {}, { acceptances })).resolves.toMatchObject({
      confirmationNumber: 'PB-AAAAAA',
    });
  });

  it('refuses the same saved pet twice in one booking', async () => {
    const twoPetQuote: SignedQuote = { ...quote, pets: [QUOTED_PET, QUOTED_PET] };
    const request = await buildRequest({
      acceptedQuoteToken: await signAcceptedQuote(twoPetQuote, ACCEPTED_AT),
      pets: [{ existingPetId: PET_ID }, { existingPetId: PET_ID }],
    });

    await expect(
      checkoutConciergeBooking(request, { signedInOwnerId: OWNER_ID }),
    ).rejects.toMatchObject({
      code: 'CONCIERGE_PET_DUPLICATED',
    });
  });

  it('only accepts phone numbers that can be dialled', () => {
    expect(conciergeContactSchema.safeParse({ ...contact, phone: '12345' }).success).toBe(false);
    expect(conciergeContactSchema.safeParse(contact).success).toBe(true);
  });

  it('accepts an optional emergency contact and lets the home address be left out', () => {
    const withoutAddress = { firstName: 'Ava', lastName: 'Mitchell', phone: '021 555 0199' };
    const parsed = conciergeContactSchema.safeParse({
      ...withoutAddress,
      emergencyContactNumber: '021 555 0101',
    });

    expect(parsed.success).toBe(true);
    // A provided optional number is preserved after validation.
    expect(parsed.data).toEqual({ ...withoutAddress, emergencyContactNumber: '021 555 0101' });
    expect(conciergeContactSchema.safeParse({ ...withoutAddress, address: '12' }).success).toBe(
      false,
    );
  });
});

describe('checkoutConciergeBooking safeguards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CONCIERGE_SIGNING_SECRET = TEST_SIGNING_SECRET;
    vi.mocked(bookingRepository.getServiceCatalogByIds).mockResolvedValue(catalogueAtQuotePrices);
    vi.mocked(bookingRepository.createBooking).mockResolvedValue({
      bookingId: BOOKING_ID,
      createdAt: '2026-10-01T02:01:00.000Z',
    });
    vi.mocked(conciergeRepository.createOwnerAndPets).mockResolvedValue({
      ownerId: OWNER_ID,
      accountCreated: true,
      petIds: [PET_ID],
    });
    vi.mocked(conciergeRepository.findBookingPetIds).mockResolvedValue([]);
    vi.mocked(conciergeRepository.emailHasPasswordAccount).mockResolvedValue(false);
    vi.mocked(conciergeRepository.findSavedPetSpecies).mockResolvedValue(new Map());
    vi.mocked(authRepository.findUserByEmail).mockResolvedValue(null);
    vi.mocked(bookingCapacity.findFullNights).mockResolvedValue([]);
    vi.mocked(bookingCapacity.assertRoomForStay).mockResolvedValue(undefined);
    setCardProcessorForTests(new FakeCardProcessor());
  });

  afterEach(() => {
    setCardProcessorForTests(undefined);
  });

  it('passes the quoted size and medication to staff in fields they already read', async () => {
    const medicated: SignedQuote = {
      ...quote,
      pets: [{ ...QUOTED_PET, needsMedication: true }],
    };
    await checkoutConciergeBooking(
      await buildRequest({ acceptedQuoteToken: await signAcceptedQuote(medicated, ACCEPTED_AT) }),
      {},
    );

    const info = vi.mocked(bookingRepository.createBooking).mock.calls[0]?.[0].pets[0]?.info;
    // The shared note, so the "Get ready" list can tell it apart from real instructions.
    expect(info?.medInstruction).toBe(OWNER_SAID_NEEDS_MEDICATION_NOTE);
    expect(info?.others).toMatch(/Size \(told to the booking assistant\): large/);
  });

  it('refuses a saved pet that is clearly not the kind of pet that was priced', async () => {
    vi.mocked(bookingRepository.getOwnedPetIds).mockResolvedValue(new Set([PET_ID]));
    vi.mocked(conciergeRepository.findSavedPetSpecies).mockResolvedValue(
      new Map([[PET_ID, 'Cat']]),
    );
    const request = await buildRequest({ pets: [{ existingPetId: PET_ID }] });
    delete request.contact;

    await expect(
      checkoutConciergeBooking(request, { signedInOwnerId: OWNER_ID }),
    ).rejects.toMatchObject({ code: 'CONCIERGE_PET_SPECIES_MISMATCH' });
    expect(bookingRepository.createBooking).not.toHaveBeenCalled();
  });

  it('never books a verified email onto an existing account that has a password', async () => {
    vi.mocked(authRepository.findUserByEmail).mockResolvedValue({
      id: OWNER_ID,
      username: 'owner',
      email: 'owner@example.test',
      phone: null,
      is_employee: false,
      is_pet_owner: true,
      created_at: '2026-01-01T00:00:00.000Z',
    } as never);
    vi.mocked(conciergeRepository.emailHasPasswordAccount).mockResolvedValue(true);

    await expect(checkoutConciergeBooking(await buildRequest(), {})).rejects.toMatchObject({
      code: 'CONCIERGE_PASSWORD_ACCOUNT',
    });
  });
});
