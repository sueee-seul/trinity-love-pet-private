import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import petparentHomeRoutes from '../routes/petparent.home.routes.js';
import { errorHandler } from '../common/middlewares/error.middleware.js';
import { AUTH_COOKIE_NAME, createSessionToken } from '../services/auth.session.js';
import type { HomeStayRow } from '../repositories/petparent.home.repository.js';

const { findUserByIdMock, homeRepo, bookingRepo, getReadyRepo } = vi.hoisted(() => ({
  findUserByIdMock: vi.fn(),
  homeRepo: { findOwnerFirstName: vi.fn(), listHomeStays: vi.fn() },
  bookingRepo: { listPetsForOwner: vi.fn() },
  getReadyRepo: { listGetReadyFactsForOwner: vi.fn() },
}));

vi.mock('../config/database.js', () => ({ pool: { query: vi.fn(), connect: vi.fn() } }));
vi.mock('../repositories/auth.repository.js', () => ({
  createPetParentAccount: vi.fn(),
  createGooglePetParentAccount: vi.fn(),
  findUserByCredentials: vi.fn(),
  findUserByEmail: vi.fn(),
  findUserById: findUserByIdMock,
  findUserByUsername: vi.fn(),
}));
vi.mock('../repositories/petparent.home.repository.js', () => homeRepo);
vi.mock('../repositories/petparent.booking.repository.js', () => bookingRepo);
vi.mock('../repositories/petparent.getReady.repository.js', () => getReadyRepo);

const OWNER = {
  id: '00000000-0000-4000-8000-000000000301',
  email: 'owner@example.test',
  username: 'owner.one',
  name: 'Owner One',
  is_employee: false,
  is_pet_owner: true,
  staff_role: null,
};
const EMPLOYEE = { ...OWNER, id: '00000000-0000-4000-8000-000000000901', is_employee: true };
const BOOKING_PET_ID = '00000000-0000-4000-8000-000000000601';

// Drop-off one day from the real clock, so the route (which reads the time itself) sees it inside
// the 48 hour window.
const soonStay = (): HomeStayRow => ({
  bookingId: '00000000-0000-4000-8000-000000000501',
  bookingPetId: BOOKING_PET_ID,
  reviewStatus: 'approved',
  checkInOutcome: null,
  refusalReason: null,
  reviewerName: null,
  petId: '00000000-0000-4000-8000-000000000401',
  petName: 'Biscuit',
  petPhotoUrl: null,
  dropOffTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
  pickUpTime: new Date(Date.now() + 72 * 60 * 60 * 1000),
  serviceType: 'Standard room',
  fullyVaccinated: null,
  hasVaccinationCertificate: false,
  vaccinationCertificateUploadedAt: null,
  hasAgreement: true,
  paymentSucceeded: true,
});

const createApp = (): express.Express => {
  const app = express();
  app.use(express.json());
  app.use('/api/petparent', petparentHomeRoutes);
  app.use(errorHandler);
  return app;
};

const cookieFor = async (userId: string): Promise<string> =>
  `${AUTH_COOKIE_NAME}=${await createSessionToken(userId)}`;

beforeEach(() => {
  process.env.AUTH_SESSION_SECRET = 'petparent-home-route-test-secret';
  process.env.AUTH_SESSION_VERSION = '1';
  vi.clearAllMocks();
  homeRepo.findOwnerFirstName.mockResolvedValue('Owner');
  homeRepo.listHomeStays.mockResolvedValue([soonStay()]);
  bookingRepo.listPetsForOwner.mockResolvedValue([]);
  getReadyRepo.listGetReadyFactsForOwner.mockResolvedValue([
    {
      bookingPetId: BOOKING_PET_ID,
      fullyVaccinated: null,
      hasVaccinationCertificate: false,
      petHasDietNotes: true,
      stayHasFeedingRoutine: false,
      petHasActiveMedication: false,
      stayHasMedicationInstructions: false,
      ownerSaidNeedsMedication: false,
      petHasEmergencyContact: false,
      ownerHasEmergencyContact: true,
      petHasVetName: false,
      petHasVetPhone: false,
    },
  ]);
});

describe('GET /api/petparent/home, Get ready', () => {
  it("works out the signed-in owner's Get ready card when the page is read", async () => {
    findUserByIdMock.mockResolvedValue(OWNER);

    const response = await request(createApp())
      .get('/api/petparent/home')
      .set('Cookie', await cookieFor(OWNER.id));

    expect(response.status).toBe(200);
    expect(getReadyRepo.listGetReadyFactsForOwner).toHaveBeenCalledWith(OWNER.id, expect.any(Date));
    expect(homeRepo.listHomeStays).toHaveBeenCalledWith(OWNER.id, false);
    expect(response.body.getReady).toEqual([
      expect.objectContaining({
        bookingPetId: BOOKING_PET_ID,
        petName: 'Biscuit',
        tasks: [
          { key: 'vaccination', status: 'not_started' },
          { key: 'feeding', status: 'completed' },
          { key: 'medication', status: 'completed' },
          { key: 'emergency_contact_and_vet', status: 'not_started' },
        ],
      }),
    ]);
  });

  it('refuses a staff account: staff do not use the pet parent routes', async () => {
    findUserByIdMock.mockResolvedValue(EMPLOYEE);

    const response = await request(createApp())
      .get('/api/petparent/home')
      .set('Cookie', await cookieFor(EMPLOYEE.id));

    expect(response.status).toBe(403);
    expect(getReadyRepo.listGetReadyFactsForOwner).not.toHaveBeenCalled();
  });

  it('refuses a visitor without a session', async () => {
    const response = await request(createApp()).get('/api/petparent/home');

    expect(response.status).toBe(401);
    expect(getReadyRepo.listGetReadyFactsForOwner).not.toHaveBeenCalled();
  });
});
