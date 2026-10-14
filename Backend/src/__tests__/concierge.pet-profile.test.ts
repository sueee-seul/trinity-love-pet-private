import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { pool } from '../config/database.js';
import {
  fillPetProfilesFromBooking,
  profileFillFrom,
} from '../services/concierge/concierge.pet-profile.js';
import type { PetIntakeDraft } from '../services/pet.intake.service.js';

vi.mock('../config/database.js', () => ({ pool: { query: vi.fn(), connect: vi.fn() } }));
// The real reader calls a model; these tests hand it the reader's answer instead.
vi.mock('../services/pet.intake.service.js', () => ({ extractPetDetails: vi.fn() }));

const OWNER_ID = '00000000-0000-4000-8000-000000000301';
const BISCUIT = { petId: '00000000-0000-4000-8000-000000000401', name: 'Biscuit', species: 'dog' };
const MOCHI = { petId: '00000000-0000-4000-8000-000000000402', name: 'Mochi', species: 'cat' };

type Reader = (description: string) => Promise<{ draft: Partial<PetIntakeDraft> }>;

/** A reader that answers with this draft, whatever it is asked. */
const readerSaid = (draft: Partial<PetIntakeDraft>): Mock<Reader> =>
  vi.fn<Reader>(async () => ({ draft }));

const updateParams = (): unknown[] => {
  const call = vi.mocked(pool.query).mock.calls[0];
  if (!call) throw new Error('No update');
  return call[1] as unknown[];
};

describe('pet profiles filled from the booking', () => {
  beforeEach(() => {
    vi.mocked(pool.query).mockResolvedValue({ rows: [] } as never);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('fills a new pet’s empty fields from what the guest said, for that owner’s pet only', async () => {
    const read = readerSaid({
      breed: 'Golden Retriever',
      weightKg: 31.456,
      sex: 'male',
      desexed: true,
      dietNotes: 'Two cups of kibble, morning and night',
      allergies: ['chicken', 'beef'],
      behaviourNotes: 'Shy with big dogs at first',
      medications: [
        {
          name: 'Apoquel',
          strength: '16mg',
          dose: 1,
          unit: 'tablet',
          route: 'ORAL',
          schedule: ['morning'],
          withFood: true,
          instructions: 'with breakfast',
          prescribedBy: null,
        },
      ],
    });

    await fillPetProfilesFromBooking(OWNER_ID, [BISCUIT], 'Biscuit is a golden retriever…', read);

    const [sql] = vi.mocked(pool.query).mock.calls[0] as unknown as [string];
    // Only empty fields: what the parent or staff wrote is never replaced.
    expect(sql).toContain('breed = COALESCE(breed, $3)');
    expect(sql).toContain('WHERE uuid = $2::uuid AND pet_owners_uuid = $1::uuid');
    expect(updateParams()).toEqual([
      OWNER_ID,
      BISCUIT.petId,
      'Golden Retriever',
      31.46,
      null,
      true,
      true,
      'Two cups of kibble, morning and night',
      'chicken, beef',
      'Shy with big dogs at first',
      'Medication (from the booking): Apoquel, 16mg, 1 tablet, morning, with breakfast',
      null,
      null,
      null,
    ]);
  });

  it('keeps each pet to its own details when the notes cover several', async () => {
    const read = readerSaid({});

    await fillPetProfilesFromBooking(
      OWNER_ID,
      [BISCUIT, MOCHI],
      'Biscuit eats kibble, Mochi is shy',
      read,
    );

    expect(read).toHaveBeenCalledTimes(2);
    expect(read.mock.calls[1]?.[0]).toContain('Only take details that are about Mochi.');
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  it('reads nothing when the guest gave no notes', async () => {
    const read = readerSaid({});

    await fillPetProfilesFromBooking(OWNER_ID, [BISCUIT], '   ', read);

    expect(read).not.toHaveBeenCalled();
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('never fails the booking when the reader fails, and logs no words or names', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const read = vi.fn(async () => {
      throw new Error('model down');
    });

    await expect(
      fillPetProfilesFromBooking(OWNER_ID, [BISCUIT], 'Biscuit hates baths', read),
    ).resolves.toBeUndefined();

    expect(pool.query).not.toHaveBeenCalled();
    expect(JSON.stringify(error.mock.calls)).not.toContain('Biscuit');
  });

  it('drops values that do not fit the profile instead of guessing', () => {
    expect(
      profileFillFrom({
        breed: 'x'.repeat(101),
        weightKg: 900,
        birthDate: '2999-01-01',
        desexed: false,
      }),
    ).toMatchObject({ breed: null, weightKg: null, birthDate: null, desexed: false });
    expect(profileFillFrom({ birthDate: '2020-02-30' }).birthDate).toBeNull();
    expect(profileFillFrom({ birthDate: '2020-02-03', sex: 'female' })).toMatchObject({
      birthDate: '2020-02-03',
      male: false,
    });
  });
});
