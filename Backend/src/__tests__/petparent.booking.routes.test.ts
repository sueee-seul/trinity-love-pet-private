import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import petparentBookingRoutes from '../routes/petparent.booking.routes.js';
import { errorHandler } from '../common/middlewares/error.middleware.js';
import { AUTH_COOKIE_NAME, createSessionToken } from '../services/auth.session.js';
import * as bookingRepository from '../repositories/petparent.booking.repository.js';
import * as bookingReadRepository from '../repositories/petparent.booking.read.repository.js';
import * as petFactsRepository from '../repositories/petparent.petFacts.repository.js';
import * as getReadyRepository from '../repositories/petparent.getReady.repository.js';
import type { MyBookingPetRow } from '../repositories/petparent.booking.read.repository.js';

const { findUserByIdMock } = vi.hoisted(() => ({ findUserByIdMock: vi.fn() }));

vi.mock('../config/database.js', () => ({ pool: { query: vi.fn(), connect: vi.fn() } }));
vi.mock('../repositories/auth.repository.js', () => ({
  createPetParentAccount: vi.fn(),
  createGooglePetParentAccount: vi.fn(),
  findUserByCredentials: vi.fn(),
  findUserByEmail: vi.fn(),
  findUserById: findUserByIdMock,
  findUserByUsername: vi.fn(),
}));
vi.mock('../repositories/petparent.booking.read.repository.js', () => ({
  listBookingsForOwner: vi.fn(),
}));
vi.mock('../repositories/petparent.petFacts.repository.js', () => ({
  listPetFactsForOwner: vi.fn(),
}));
// My stays adds each stay's card from this repository; these stays were made without a card.
vi.mock('../repositories/petparent.stay-guarantee.repository.js', () => ({
  findStayGuarantees: vi.fn(async () => []),
}));
vi.mock('../repositories/petparent.getReady.repository.js', () => ({
  listGetReadyFactsForOwner: vi.fn(),
}));
vi.mock('../repositories/petparent.booking.repository.js', () => ({
  listPetsForOwner: vi.fn(),
  listServices: vi.fn(),
  getOwnedPetIds: vi.fn(),
  getServiceCatalogByIds: vi.fn(),
  createBooking: vi.fn(),
}));

const OWNER = {
  id: '00000000-0000-4000-8000-000000000301',
  email: 'owner@example.test',
  username: 'owner.one',
  name: 'Owner One',
  is_employee: false,
  is_pet_owner: true,
  staff_role: null,
};

const OWN_PET_ID = '00000000-0000-4000-8000-000000000401';
const SOMEONE_ELSES_PET_ID = '00000000-0000-4000-8000-000000000402';
const BOOKING_ID = '8f3a2b1c-0000-4000-8000-000000000501';

// What the removed six-step form used to send: raw card fields, and a dates entry for a pet
// that is not in selectedPetIds (the ownership check only looked at selectedPetIds).
const CLASSIC_BOOKING_BODY = {
  selectedPetIds: [OWN_PET_ID],
  dates: [
    {
      petId: SOMEONE_ELSES_PET_ID,
      startDate: '2026-10-12',
      endDate: '2026-10-14',
      dropOffTime: '09:00',
      pickUpTime: '17:00',
    },
  ],
  services: [],
  info: [],
  agreement: {
    agreedToTermsVersionId: 'terms-v3',
    fullName: 'Owner One',
    signatureDataUrl: 'data:image/png;base64,AAAA',
    agreedAt: '2026-09-29T00:00:00.000Z',
  },
  payment: {
    processor: 'card',
    cardholderName: 'Owner One',
    cardNumber: '4242 4242 4242 4242',
    expiry: '12/29',
    cvc: '123',
  },
  status: 'draft',
  confirmationNumber: null,
};

const OWNER_BOOKING_ROW: MyBookingPetRow = {
  bookingPetId: '00000000-0000-4000-8000-000000000601',
  bookingId: BOOKING_ID,
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
  petId: OWN_PET_ID,
  petName: 'Biscuit',
  petSpecies: null,
  petPhotoUrl: null,
  dropOffTime: new Date('2026-10-12T09:00:00.000Z'),
  pickUpTime: new Date('2026-10-14T17:00:00.000Z'),
  reviewStatus: 'pending',
  checkInOutcome: null,
  refusalReason: null,
  reviewerName: null,
  caringInfo: null,
  services: [
    {
      id: '00000000-0000-4000-8000-000000000701',
      name: 'Standard room',
      category: 'boarding_rate',
      quantity: 1,
      priceAtBooking: 45,
      priceUnit: 'per night',
    },
  ],
};

const createApp = (): express.Express => {
  const app = express();
  app.use(express.json());
  app.use('/api/petparent', petparentBookingRoutes);
  app.use(errorHandler);
  return app;
};

const ownerCookie = async (): Promise<string> =>
  `${AUTH_COOKIE_NAME}=${await createSessionToken(OWNER.id)}`;

beforeEach(() => {
  process.env.AUTH_SESSION_SECRET = 'petparent-booking-route-test-secret';
  process.env.AUTH_SESSION_VERSION = '1';
  vi.clearAllMocks();
  findUserByIdMock.mockResolvedValue(OWNER);
  vi.mocked(getReadyRepository.listGetReadyFactsForOwner).mockResolvedValue([]);
});

describe('pet parent booking routes', () => {
  // Router level only: this router no longer has a POST /bookings, so on its own it answers 404.
  // The full app answers differently, see the next test.
  it('has no route for a booking with card details, even from a signed-in owner', async () => {
    const response = await request(createApp())
      .post('/api/petparent/bookings')
      .set('Cookie', await ownerCookie())
      .send(CLASSIC_BOOKING_BODY);

    expect(response.status).toBe(404);
    expect(bookingRepository.getOwnedPetIds).not.toHaveBeenCalled();
    expect(bookingRepository.getServiceCatalogByIds).not.toHaveBeenCalled();
    expect(bookingRepository.createBooking).not.toHaveBeenCalled();
  });

  // In the full app nothing under /api/petparent matches, so the request falls through to the
  // task router on /api, whose employee check answers first (403 for a pet parent, 401 for a
  // guest). The exact 4xx code belongs to that router; what matters here is that the old body
  // never reaches a booking write.
  it('never books through the removed endpoint in the full app', async () => {
    const { app } = await import('../server.js');

    const response = await request(app)
      .post('/api/petparent/bookings')
      .set('Cookie', await ownerCookie())
      .send(CLASSIC_BOOKING_BODY);

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
    expect(bookingRepository.getOwnedPetIds).not.toHaveBeenCalled();
    expect(bookingRepository.getServiceCatalogByIds).not.toHaveBeenCalled();
    expect(bookingRepository.createBooking).not.toHaveBeenCalled();
  });

  it("still lists the signed-in owner's bookings for My stays", async () => {
    vi.mocked(bookingReadRepository.listBookingsForOwner).mockResolvedValue([OWNER_BOOKING_ROW]);

    const response = await request(createApp())
      .get('/api/petparent/bookings')
      .set('Cookie', await ownerCookie());

    expect(response.status).toBe(200);
    expect(bookingReadRepository.listBookingsForOwner).toHaveBeenCalledWith(OWNER.id);
    expect(response.body).toEqual([
      expect.objectContaining({
        bookingId: BOOKING_ID,
        confirmationNumber: 'PB-8F3A2B',
        pet: { id: OWN_PET_ID, name: 'Biscuit' },
        status: 'waiting_for_review',
        reviewStatus: 'pending',
        refusalReason: null,
        reviewerName: null,
        nights: 2,
        serviceType: 'Standard room',
        total: 90,
      }),
    ]);
  });

  it("sends the manager's decision and the refusal reason with each stay", async () => {
    vi.mocked(bookingReadRepository.listBookingsForOwner).mockResolvedValue([
      { ...OWNER_BOOKING_ROW, reviewStatus: 'refused', refusalReason: 'We are full that week.' },
      {
        ...OWNER_BOOKING_ROW,
        bookingPetId: '00000000-0000-4000-8000-000000000602',
        reviewStatus: 'approved',
        refusalReason: 'An old reason the undo left behind',
        dropOffTime: new Date('2026-01-12T09:00:00.000Z'),
        pickUpTime: new Date('2026-01-14T17:00:00.000Z'),
      },
    ]);

    const response = await request(createApp())
      .get('/api/petparent/bookings')
      .set('Cookie', await ownerCookie());

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      expect.objectContaining({
        status: 'refused',
        reviewStatus: 'refused',
        refusalReason: 'We are full that week.',
      }),
      expect.objectContaining({
        status: 'stay_ended',
        reviewStatus: 'approved',
        refusalReason: null,
        reviewerName: null,
      }),
    ]);
  });

  it('sends the Get ready list with an approved stay before drop-off, and with nothing else', async () => {
    const approvedId = '00000000-0000-4000-8000-000000000603';
    const endedId = '00000000-0000-4000-8000-000000000604';
    const ahead = { dropOffTime: new Date(Date.now() + 86_400_000) };
    vi.mocked(bookingReadRepository.listBookingsForOwner).mockResolvedValue([
      { ...OWNER_BOOKING_ROW, ...ahead },
      { ...OWNER_BOOKING_ROW, ...ahead, bookingPetId: approvedId, reviewStatus: 'approved' },
      {
        ...OWNER_BOOKING_ROW,
        bookingPetId: endedId,
        reviewStatus: 'approved',
        dropOffTime: new Date('2026-01-12T09:00:00.000Z'),
        pickUpTime: new Date('2026-01-14T17:00:00.000Z'),
      },
    ]);
    vi.mocked(getReadyRepository.listGetReadyFactsForOwner).mockResolvedValue([
      {
        bookingPetId: approvedId,
        fullyVaccinated: true,
        hasVaccinationCertificate: true,
        petHasDietNotes: false,
        stayHasFeedingRoutine: true,
        petHasActiveMedication: true,
        stayHasMedicationInstructions: false,
        ownerSaidNeedsMedication: false,
        petHasEmergencyContact: false,
        ownerHasEmergencyContact: true,
        petHasVetName: true,
        petHasVetPhone: true,
      },
    ]);

    const response = await request(createApp())
      .get('/api/petparent/bookings')
      .set('Cookie', await ownerCookie());

    expect(response.status).toBe(200);
    expect(getReadyRepository.listGetReadyFactsForOwner).toHaveBeenCalledWith(
      OWNER.id,
      expect.any(Date),
    );
    const byId = new Map(
      (response.body as { bookingPetId: string; getReady: unknown }[]).map((stay) => [
        stay.bookingPetId,
        stay.getReady,
      ]),
    );
    expect(byId.get(OWNER_BOOKING_ROW.bookingPetId)).toBeNull();
    expect(byId.get(endedId)).toBeNull();
    expect(byId.get(approvedId)).toEqual([
      { key: 'vaccination', status: 'completed' },
      { key: 'feeding', status: 'completed' },
      { key: 'medication', status: 'not_started' },
      { key: 'emergency_contact_and_vet', status: 'completed' },
    ]);
  });

  it('still refuses the bookings list without a session', async () => {
    const response = await request(createApp()).get('/api/petparent/bookings');

    expect(response.status).toBe(401);
    expect(bookingReadRepository.listBookingsForOwner).not.toHaveBeenCalled();
    expect(getReadyRepository.listGetReadyFactsForOwner).not.toHaveBeenCalled();
  });

  // Staff read stays through the employee routes; the Get ready facts are the owner's alone.
  it('refuses the bookings list to a staff account', async () => {
    findUserByIdMock.mockResolvedValue({ ...OWNER, is_employee: true });

    const response = await request(createApp())
      .get('/api/petparent/bookings')
      .set('Cookie', await ownerCookie());

    expect(response.status).toBe(403);
    expect(bookingReadRepository.listBookingsForOwner).not.toHaveBeenCalled();
    expect(getReadyRepository.listGetReadyFactsForOwner).not.toHaveBeenCalled();
  });

  it('serves the saved pets with what the account knows, and the service list', async () => {
    vi.mocked(bookingRepository.listPetsForOwner).mockResolvedValue([
      { id: OWN_PET_ID, name: 'Biscuit', species: 'dog' },
    ]);
    vi.mocked(petFactsRepository.listPetFactsForOwner).mockResolvedValue({
      activeMedicationPetIds: new Set([OWN_PET_ID]),
      // An approved stay that ended in January: Biscuit has stayed with us before.
      stays: [
        {
          petId: OWN_PET_ID,
          reviewStatus: 'approved',
          checkInOutcome: null,
          dropOffTime: new Date('2026-01-12T09:00:00.000Z'),
          pickUpTime: new Date('2026-01-14T17:00:00.000Z'),
        },
      ],
    });
    vi.mocked(bookingRepository.listServices).mockResolvedValue([]);
    const cookie = await ownerCookie();

    const pets = await request(createApp()).get('/api/petparent/pets').set('Cookie', cookie);
    const services = await request(createApp())
      .get('/api/petparent/services')
      .set('Cookie', cookie);

    expect(pets.status).toBe(200);
    expect(pets.body).toEqual([
      {
        id: OWN_PET_ID,
        name: 'Biscuit',
        species: 'dog',
        firstTimeBoarding: false,
        needsMedication: true,
      },
    ]);
    expect(petFactsRepository.listPetFactsForOwner).toHaveBeenCalledWith(OWNER.id);
    expect(bookingRepository.listPetsForOwner).toHaveBeenCalledWith(OWNER.id);
    expect(services.status).toBe(200);
    expect(services.body).toEqual([]);
  });
});
