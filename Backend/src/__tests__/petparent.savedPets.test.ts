import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as bookingRepository from '../repositories/petparent.booking.repository.js';
import * as petFactsRepository from '../repositories/petparent.petFacts.repository.js';
import { getPetsForOwner, savedPetFacts } from '../services/petparent.booking.js';

vi.mock('../config/database.js', () => ({ pool: { query: vi.fn(), connect: vi.fn() } }));
vi.mock('../repositories/petparent.booking.repository.js', () => ({ listPetsForOwner: vi.fn() }));
vi.mock('../repositories/petparent.petFacts.repository.js', () => ({
  listPetFactsForOwner: vi.fn(),
}));

const OWNER_ID = '00000000-0000-4000-8000-000000000301';
const MAX_ID = '00000000-0000-4000-8000-000000000401';
const LUNA_ID = '00000000-0000-4000-8000-000000000402';
const NOW = new Date('2026-09-29T00:00:00.000Z');

type StayRow = petFactsRepository.OwnerPetStayRow;

/** A stay of Max, ended a month before NOW unless the test moves it. */
const stay = (overrides: Partial<StayRow>): StayRow => ({
  petId: MAX_ID,
  reviewStatus: 'approved',
  checkInOutcome: null,
  dropOffTime: new Date('2026-08-10T21:00:00.000Z'),
  pickUpTime: new Date('2026-08-14T05:00:00.000Z'),
  ...overrides,
});

const factsWith = (
  stays: StayRow[],
  medicated: string[] = [],
): petFactsRepository.OwnerPetFactRows => ({
  activeMedicationPetIds: new Set(medicated),
  stays,
});

describe('savedPetFacts', () => {
  it('knows a pet is not new once a stay our manager approved has ended', () => {
    expect(savedPetFacts(MAX_ID, factsWith([stay({})]), NOW).firstTimeBoarding).toBe(false);
  });

  it.each([
    ['still waiting for review', stay({ reviewStatus: 'pending' })],
    ['refused', stay({ reviewStatus: 'refused' })],
    ['cancelled', stay({ reviewStatus: 'cancelled' })],
    [
      'approved but not started yet',
      stay({
        dropOffTime: new Date('2026-10-12T20:00:00.000Z'),
        pickUpTime: new Date('2026-10-15T04:00:00.000Z'),
      }),
    ],
    [
      'approved and under way',
      stay({
        dropOffTime: new Date('2026-09-27T20:00:00.000Z'),
        pickUpTime: new Date('2026-10-02T04:00:00.000Z'),
      }),
    ],
    ['of another pet', stay({ petId: LUNA_ID })],
  ])('never guesses from a stay that is %s', (_label, row) => {
    expect(savedPetFacts(MAX_ID, factsWith([row]), NOW).firstTimeBoarding).toBeNull();
  });

  it('says medication only when staff keep an active one on file, and never says no', () => {
    const facts = factsWith([], [MAX_ID]);

    expect(savedPetFacts(MAX_ID, facts, NOW).needsMedication).toBe(true);
    expect(savedPetFacts(LUNA_ID, facts, NOW).needsMedication).toBeNull();
  });
});

describe('getPetsForOwner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends each saved pet with the facts the account already holds', async () => {
    vi.mocked(bookingRepository.listPetsForOwner).mockResolvedValue([
      { id: MAX_ID, name: 'Max', species: 'dog', breed: 'Labrador' },
      { id: LUNA_ID, name: 'Luna', species: 'cat' },
    ]);
    vi.mocked(petFactsRepository.listPetFactsForOwner).mockResolvedValue(
      factsWith([stay({})], [MAX_ID]),
    );

    const pets = await getPetsForOwner(OWNER_ID, NOW);

    expect(petFactsRepository.listPetFactsForOwner).toHaveBeenCalledWith(OWNER_ID);
    expect(pets).toEqual([
      {
        id: MAX_ID,
        name: 'Max',
        species: 'dog',
        breed: 'Labrador',
        firstTimeBoarding: false,
        needsMedication: true,
      },
      { id: LUNA_ID, name: 'Luna', species: 'cat', firstTimeBoarding: null, needsMedication: null },
    ]);
  });
});
