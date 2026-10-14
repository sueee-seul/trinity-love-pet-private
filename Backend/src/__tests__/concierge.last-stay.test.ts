import { describe, expect, it } from 'vitest';
import type { MyBookingPetRow } from '../repositories/petparent.booking.read.repository.js';
import type { BookingServiceRecord } from '../repositories/petparent.booking.repository.js';
import {
  readLastStay,
  wantsLastStay,
  type LastStayDependencies,
} from '../services/concierge/concierge.last-stay.js';
import { CATALOGUE } from './fixtures/concierge.fixtures.js';

const idOf = (name: string): string => {
  const service = CATALOGUE.find((entry) => entry.name === name);
  if (!service) throw new Error(`Fixture service ${name} is missing`);
  return service.id;
};

const serviceRow = (name: string, id = idOf(name)): MyBookingPetRow['services'][number] => {
  const known = CATALOGUE.find((entry) => entry.id === id);
  return {
    id,
    name,
    category: known?.category ?? 'addon',
    quantity: 1,
    priceAtBooking: known?.price ?? 0,
    priceUnit: known?.priceUnit ?? null,
  };
};

const row = (overrides: Partial<MyBookingPetRow>): MyBookingPetRow => ({
  bookingPetId: 'bp-1',
  bookingId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1',
  createdAt: new Date('2026-09-01T00:00:00Z'),
  petId: '00000000-0000-4000-8000-000000000401',
  petName: 'Luna',
  petSpecies: 'Cat',
  petPhotoUrl: null,
  dropOffTime: new Date('2026-09-10T21:00:00Z'),
  pickUpTime: new Date('2026-09-13T05:00:00Z'),
  reviewStatus: 'approved',
  checkInOutcome: null,
  refusalReason: null,
  reviewerName: null,
  caringInfo: null,
  services: [serviceRow('Cosy room'), serviceRow('House food')],
  ...overrides,
});

describe('wantsLastStay', () => {
  it('hears the request in both languages and not an ordinary sentence', () => {
    for (const text of [
      'Same as last time please',
      'the same as my last booking',
      'like last time',
      '和上次一样',
      '就照上次那样订',
    ]) {
      expect(wantsLastStay(text)).toBe(true);
    }
    for (const text of ['Last time was great', 'When was my last stay?', '上次的发票']) {
      expect(wantsLastStay(text)).toBe(false);
    }
  });
});

describe('readLastStay', () => {
  const deps = (rows: MyBookingPetRow[]): LastStayDependencies => ({
    listBookings: async (): Promise<MyBookingPetRow[]> => rows,
    loadCatalogue: async (): Promise<BookingServiceRecord[]> => CATALOGUE,
  });

  it('returns null for a parent with no dated stay', async () => {
    expect(await readLastStay('owner', deps([]))).toBeNull();
    expect(
      await readLastStay('owner', deps([row({ dropOffTime: null, pickUpTime: null })])),
    ).toBeNull();
  });

  it('copies the pets and services of the latest booking, never its dates', async () => {
    const older = row({});
    const newer = row({
      bookingPetId: 'bp-2',
      bookingId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee2',
      createdAt: new Date('2026-10-01T00:00:00Z'),
      petName: 'Max',
      petSpecies: 'dog',
      dropOffTime: new Date('2026-10-11T21:00:00Z'),
      pickUpTime: new Date('2026-10-14T05:00:00Z'),
      services: [
        serviceRow('Garden suite'),
        serviceRow('Premium food'),
        serviceRow('Daily walk'),
        serviceRow('Medication administration'),
      ],
    });

    const lastStay = await readLastStay('owner', deps([older, newer]));

    expect(lastStay?.confirmationNumber).toMatch(/^PB-/);
    // Drop-off on the 12th in New Zealand (the 11th at 21:00 UTC), pick-up on the 14th.
    expect(lastStay?.startDate).toBe('2026-10-12');
    expect(lastStay?.endDate).toBe('2026-10-14');
    expect(lastStay?.needs).toEqual({
      service: 'boarding',
      startDate: null,
      endDate: null,
      pets: [
        {
          name: 'Max',
          species: 'dog',
          size: null,
          needsMedication: true,
          firstTimeBoarding: false,
        },
      ],
      extras: { walks: true, grooming: false, playtime: false },
      notes: '',
    });
    expect(lastStay?.selection).toEqual({
      pets: [
        {
          roomId: idOf('Garden suite'),
          foodId: idOf('Premium food'),
          addonIds: [idOf('Daily walk'), idOf('Medication administration')],
        },
      ],
    });
    expect(lastStay?.savedPetIds).toEqual(['00000000-0000-4000-8000-000000000401']);
  });

  it('keeps every pet of a multi-pet booking and maps an unknown species to other', async () => {
    const luna = row({});
    const rex = row({
      bookingPetId: 'bp-3',
      petId: null,
      petName: 'Rex',
      petSpecies: 'rabbit',
      services: [serviceRow('Royal suite'), serviceRow('House food')],
    });

    const lastStay = await readLastStay('owner', deps([luna, rex]));

    expect(lastStay?.needs.pets.map((pet) => [pet.name, pet.species])).toEqual([
      ['Luna', 'cat'],
      ['Rex', 'other'],
    ]);
    expect(lastStay?.savedPetIds).toEqual(['00000000-0000-4000-8000-000000000401', null]);
  });

  it('falls back to the cheapest room and drops a retired add-on', async () => {
    const retiredRoom = '11111111-1111-4111-8111-000000000099';
    const retiredAddon = '11111111-1111-4111-8111-000000000098';
    const stay = row({
      services: [
        serviceRow('Old room', retiredRoom),
        serviceRow('House food'),
        serviceRow('Old spa', retiredAddon),
      ],
    });

    const lastStay = await readLastStay('owner', deps([stay]));

    expect(lastStay?.selection.pets[0]).toEqual({
      roomId: idOf('Cosy room'),
      foodId: idOf('House food'),
      addonIds: [],
    });
  });
});
