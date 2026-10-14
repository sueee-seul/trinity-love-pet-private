import { beforeEach, describe, expect, it, vi } from 'vitest';

const homeRepo = vi.hoisted(() => ({
  findOwnerFirstName: vi.fn(),
  listHomeStays: vi.fn(),
}));
const bookingRepo = vi.hoisted(() => ({ listPetsForOwner: vi.fn() }));
const getReadyRepo = vi.hoisted(() => ({ listGetReadyFactsForOwner: vi.fn() }));

vi.mock('../repositories/petparent.home.repository.js', () => homeRepo);
vi.mock('../repositories/petparent.booking.repository.js', () => bookingRepo);
vi.mock('../repositories/petparent.getReady.repository.js', () => getReadyRepo);
vi.mock('../config/database.js', () => ({ pool: { query: vi.fn() } }));

import { buildHome, getHome } from '../services/petparent.home.js';
import type { HomeStayRow } from '../repositories/petparent.home.repository.js';
import type { GetReadyFactRow } from '../repositories/petparent.getReady.repository.js';

const NOW = new Date(2026, 8, 7, 10, 0);

const pets = [
  { id: 'pet-max', name: 'Max', species: 'dog' as const, breed: 'Labrador', age: 4 },
  { id: 'pet-luna', name: 'Luna', species: 'cat' as const, age: 2, imageUrl: 'https://img/luna' },
];

const stay = (overrides: Partial<HomeStayRow>): HomeStayRow => ({
  bookingId: 'booking-1',
  bookingPetId: 'bp-max',
  reviewStatus: 'approved',
  checkInOutcome: null,
  refusalReason: null,
  reviewerName: null,
  petId: 'pet-max',
  petName: 'Max',
  petPhotoUrl: null,
  dropOffTime: new Date(2026, 8, 12, 9, 0),
  pickUpTime: new Date(2026, 8, 16, 9, 0),
  serviceType: 'Overnight boarding',
  fullyVaccinated: true,
  hasVaccinationCertificate: true,
  vaccinationCertificateUploadedAt: new Date(2026, 8, 2, 12, 0),
  hasAgreement: true,
  paymentSucceeded: true,
  ...overrides,
});

const past = (overrides: Partial<HomeStayRow> = {}): HomeStayRow =>
  stay({
    bookingId: 'booking-old',
    bookingPetId: 'bp-old',
    dropOffTime: new Date(2026, 7, 1, 9, 0),
    pickUpTime: new Date(2026, 7, 4, 9, 0),
    ...overrides,
  });

const build = (input: Partial<Parameters<typeof buildHome>[0]>): ReturnType<typeof buildHome> =>
  buildHome({
    firstName: 'Phuong',
    pets,
    stays: [],
    getReadyFacts: new Map(),
    now: NOW,
    ...input,
  });

const HOUR_MS = 60 * 60 * 1000;

const readyFacts = (bookingPetId: string): GetReadyFactRow => ({
  bookingPetId,
  fullyVaccinated: true,
  hasVaccinationCertificate: true,
  petHasDietNotes: true,
  stayHasFeedingRoutine: false,
  petHasActiveMedication: false,
  stayHasMedicationInstructions: false,
  ownerSaidNeedsMedication: false,
  petHasEmergencyContact: false,
  ownerHasEmergencyContact: true,
  petHasVetName: false,
  petHasVetPhone: false,
});

describe('buildHome', () => {
  it('state A: no pets', () => {
    const home = build({ pets: [] });
    expect(home).toMatchObject({ state: 'A', pets: [], upcomingStays: [] });
  });

  it('state B1: pets, no stays', () => {
    expect(build({}).state).toBe('B1');
  });

  it('state B2: only past stays', () => {
    const older = past({ bookingPetId: 'bp-older', pickUpTime: new Date(2026, 5, 4) });
    const home = build({ stays: [older, past()] });
    expect(home.state).toBe('B2');
    expect(home.hasPastStays).toBe(true);
  });

  it('state C1: upcoming stay, no past, with days to go and a checklist', () => {
    const home = build({ stays: [stay({})] });
    expect(home.state).toBe('C1');
    expect(home.upcomingStays).toHaveLength(1);
    expect(home.upcomingStays[0]).toMatchObject({
      bookingId: 'booking-1',
      status: 'approved',
      nights: 4,
      daysToGo: 5,
      serviceType: 'Overnight boarding',
      pets: [{ bookingPetId: 'bp-max', petId: 'pet-max', name: 'Max' }],
    });
    expect(home.upcomingStays[0]?.confirmationNumber).toMatch(/^PB-/);
    expect(home.upcomingStays[0]?.checklist.map((i) => i.key)).toEqual([
      'agreement',
      'payment',
      'vaccination',
      'admission',
    ]);
  });

  it('state C2: upcoming plus past', () => {
    expect(build({ stays: [past(), stay({})] }).state).toBe('C2');
  });

  it('lists every active booking, soonest drop-off first', () => {
    const later = stay({
      bookingId: 'booking-2',
      bookingPetId: 'bp-later',
      dropOffTime: new Date(2026, 9, 1),
      pickUpTime: new Date(2026, 9, 3),
    });
    const home = build({ stays: [later, stay({})] });
    expect(home.upcomingStays.map((s) => s.bookingId)).toEqual(['booking-1', 'booking-2']);
  });

  it('groups a multi-pet booking into one hero and reports vaccination per pet', () => {
    const luna = stay({
      bookingPetId: 'bp-luna',
      petId: 'pet-luna',
      petName: 'Luna',
      fullyVaccinated: false,
      hasVaccinationCertificate: false,
      vaccinationCertificateUploadedAt: null,
    });
    const max = stay({});
    const home = build({ stays: [max, luna] });
    expect(home.upcomingStays).toHaveLength(1);
    expect(home.upcomingStays[0]?.pets.map((p) => p.name)).toEqual(['Max', 'Luna']);
    expect(home.upcomingStays[0]?.checklist[2]).toMatchObject({
      status: 'outstanding',
      bookingPetIds: ['bp-luna'],
    });
  });

  it('keeps vaccination outstanding for a pet marked vaccinated with no certificate for this stay', () => {
    const home = build({
      stays: [stay({ hasVaccinationCertificate: false, vaccinationCertificateUploadedAt: null })],
    });
    expect(home.upcomingStays[0]?.checklist[2]).toMatchObject({
      key: 'vaccination',
      status: 'outstanding',
      tappable: true,
      bookingPetIds: ['bp-max'],
    });
  });

  it('marks vaccination done once every pet on the booking has a certificate uploaded', () => {
    const home = build({ stays: [stay({})] });
    expect(home.upcomingStays[0]?.checklist[2]).toMatchObject({
      key: 'vaccination',
      status: 'done',
      tappable: false,
    });
  });

  it('a stay under way is neither upcoming nor past, and is listed as current', () => {
    const active = stay({
      dropOffTime: new Date(2026, 8, 6, 9, 0),
      pickUpTime: new Date(2026, 8, 9, 9, 0),
    });
    const home = build({ stays: [active] });
    expect(home).toMatchObject({ state: 'B1', upcomingStays: [], hasPastStays: false });
    expect(home.currentStays).toEqual([
      {
        bookingId: 'booking-1',
        confirmationNumber: expect.any(String),
        dropOffAt: new Date(2026, 8, 6, 9, 0).toISOString(),
        pickUpAt: new Date(2026, 8, 9, 9, 0).toISOString(),
        nights: 3,
        serviceType: 'Overnight boarding',
        pets: [{ bookingPetId: 'bp-max', petId: 'pet-max', name: 'Max' }],
        daysUntilPickUp: 2,
      },
    ]);
  });

  it('groups the pets of one booking under way, soonest pick-up first', () => {
    const underWay = { dropOffTime: new Date(2026, 8, 6, 9, 0) };
    const home = build({
      stays: [
        stay({ ...underWay, bookingId: 'booking-late', pickUpTime: new Date(2026, 8, 12, 9, 0) }),
        stay({ ...underWay, pickUpTime: new Date(2026, 8, 9, 9, 0) }),
        stay({
          ...underWay,
          pickUpTime: new Date(2026, 8, 9, 9, 0),
          bookingPetId: 'bp-luna',
          petId: 'pet-luna',
          petName: 'Luna',
        }),
      ],
    });
    expect(home.currentStays.map((current) => current.bookingId)).toEqual([
      'booking-1',
      'booking-late',
    ]);
    expect(home.currentStays[0]?.pets.map((pet) => pet.name)).toEqual(['Max', 'Luna']);
  });

  it('has no current stays when nothing is under way', () => {
    expect(build({ stays: [stay({}), past()] }).currentStays).toEqual([]);
  });

  it('keeps a pending request upcoming and says it is waiting for review', () => {
    const home = build({ stays: [stay({ reviewStatus: 'pending' })] });
    expect(home.state).toBe('C1');
    expect(home.upcomingStays[0]?.status).toBe('waiting_for_review');
    expect(home.needsAttention).toEqual([]);
  });

  it('waits for review until the manager approved every pet on the booking', () => {
    const luna = stay({
      bookingPetId: 'bp-luna',
      petId: 'pet-luna',
      petName: 'Luna',
      reviewStatus: 'pending',
    });
    const home = build({ stays: [stay({}), luna] });
    expect(home.upcomingStays).toHaveLength(1);
    expect(home.upcomingStays[0]?.status).toBe('waiting_for_review');
  });

  it('never lets a pending request whose dates have come stay, end or count as past', () => {
    const underWayDates = {
      dropOffTime: new Date(2026, 8, 6, 9, 0),
      pickUpTime: new Date(2026, 8, 9, 9, 0),
    };
    const endedDates = { dropOffTime: new Date(2026, 7, 1), pickUpTime: new Date(2026, 7, 4) };
    const home = build({
      stays: [
        stay({ ...underWayDates, reviewStatus: 'pending' }),
        past({ ...endedDates, reviewStatus: 'pending' }),
      ],
    });
    expect(home).toMatchObject({
      state: 'B1',
      upcomingStays: [],
      currentStays: [],
      hasPastStays: false,
    });
  });

  it('asks for other dates when a future request is refused, with the reason and who said it', () => {
    const refused = stay({
      bookingId: 'booking-refused',
      bookingPetId: 'bp-refused',
      reviewStatus: 'refused',
      refusalReason: 'We are full that week.',
      reviewerName: 'Mere Walker',
    });
    const home = build({ stays: [refused] });
    expect(home).toMatchObject({ state: 'B1', upcomingStays: [], currentStays: [] });
    expect(home.needsAttention).toEqual([
      {
        bookingPetId: 'bp-refused',
        bookingId: 'booking-refused',
        petName: 'Max',
        dropOffAt: new Date(2026, 8, 12, 9, 0).toISOString(),
        pickUpAt: new Date(2026, 8, 16, 9, 0).toISOString(),
        refusalReason: 'We are full that week.',
        // The manager is the parent's contact, so the parent reads their first name only.
        reviewerName: 'Mere',
      },
    ]);
  });

  it('keeps a refused pet off its booking hero while the approved pet stays on it', () => {
    const luna = stay({
      bookingPetId: 'bp-luna',
      petId: 'pet-luna',
      petName: 'Luna',
      reviewStatus: 'refused',
      refusalReason: 'Cats are full.',
    });
    const home = build({ stays: [stay({}), luna] });
    expect(home.upcomingStays[0]?.pets.map((pet) => pet.name)).toEqual(['Max']);
    expect(home.upcomingStays[0]?.status).toBe('approved');
    expect(home.needsAttention.map((request) => request.petName)).toEqual(['Luna']);
  });

  it('drops a refused request once its drop-off has passed', () => {
    const home = build({ stays: [past({ reviewStatus: 'refused', refusalReason: 'Full.' })] });
    expect(home.needsAttention).toEqual([]);
    expect(home.hasPastStays).toBe(false);
  });

  it('shows a cancelled stay nowhere on Home', () => {
    const underWay = {
      dropOffTime: new Date(2026, 8, 6, 9, 0),
      pickUpTime: new Date(2026, 8, 9, 9, 0),
    };
    const home = build({
      stays: [
        stay({ reviewStatus: 'cancelled' }),
        stay({ ...underWay, bookingPetId: 'bp-now', reviewStatus: 'cancelled' }),
        past({ reviewStatus: 'cancelled' }),
      ],
    });
    expect(home).toMatchObject({
      state: 'B1',
      upcomingStays: [],
      currentStays: [],
      needsAttention: [],
      hasPastStays: false,
    });
  });

  it('shows the Get ready card from exactly 48 hours before drop-off, not a moment sooner', () => {
    const atWindow = stay({ dropOffTime: new Date(NOW.getTime() + 48 * HOUR_MS) });
    const justBefore = stay({ dropOffTime: new Date(NOW.getTime() + 48 * HOUR_MS + 1) });
    const getReadyFacts = new Map([['bp-max', readyFacts('bp-max')]]);

    const inWindow = build({ stays: [atWindow], getReadyFacts }).getReady;
    expect(inWindow.map((card) => card.bookingPetId)).toEqual(['bp-max']);
    expect(inWindow[0]?.tasks.map((task) => task.status)).toEqual([
      'completed',
      'completed',
      'completed',
      'not_started',
    ]);
    expect(build({ stays: [justBefore], getReadyFacts }).getReady).toEqual([]);
  });

  it('shows the Get ready card only for an approved pet', () => {
    const soon = { dropOffTime: new Date(NOW.getTime() + 2 * HOUR_MS) };
    const luna = stay({
      ...soon,
      bookingPetId: 'bp-luna',
      petName: 'Luna',
      reviewStatus: 'pending',
    });
    const getReadyFacts = new Map([
      ['bp-max', readyFacts('bp-max')],
      ['bp-luna', readyFacts('bp-luna')],
    ]);

    const home = build({ stays: [stay(soon), luna], getReadyFacts });

    expect(home.getReady.map((card) => card.petName)).toEqual(['Max']);
    expect(home.upcomingStays[0]?.pets.map((pet) => pet.name)).toEqual(['Max', 'Luna']);
  });

  it('maps pets to the homepage shape', () => {
    expect(build({}).pets).toEqual([
      { id: 'pet-max', name: 'Max', species: 'dog', breed: 'Labrador', ageYears: 4 },
      { id: 'pet-luna', name: 'Luna', species: 'cat', ageYears: 2, photoUrl: 'https://img/luna' },
    ]);
  });
});

describe('getHome', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    homeRepo.findOwnerFirstName.mockResolvedValue('Phuong');
    bookingRepo.listPetsForOwner.mockResolvedValue(pets);
  });

  it('composes the owner, pets and stays into the homepage response', async () => {
    homeRepo.listHomeStays.mockResolvedValue([stay({})]);
    getReadyRepo.listGetReadyFactsForOwner.mockResolvedValue([]);
    const home = await getHome('owner-1', NOW);
    expect(home.owner).toEqual({ firstName: 'Phuong' });
    expect(home.upcomingStays).toHaveLength(1);
    expect(home.getReady).toEqual([]);
  });

  it("reads the Get ready facts for the signed-in owner's stays at the same moment", async () => {
    homeRepo.listHomeStays.mockResolvedValue([
      stay({ dropOffTime: new Date(NOW.getTime() + 20 * HOUR_MS) }),
    ]);
    getReadyRepo.listGetReadyFactsForOwner.mockResolvedValue([readyFacts('bp-max')]);

    const home = await getHome('owner-1', NOW);

    expect(getReadyRepo.listGetReadyFactsForOwner).toHaveBeenCalledWith('owner-1', NOW);
    expect(home.getReady).toHaveLength(1);
  });
});
