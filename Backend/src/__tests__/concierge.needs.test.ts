import { describe, expect, it } from 'vitest';
import {
  createEmptyNeeds,
  mergeNeeds,
  missingNeedFields,
  optionalNeedFields,
  todayInNewZealand,
} from '../services/concierge/concierge.needs.js';
import { readyNeeds, TODAY } from './fixtures/concierge.fixtures.js';

describe('mergeNeeds', () => {
  it('keeps fields a patch leaves out', () => {
    const merged = mergeNeeds(readyNeeds(), { extras: { walks: true } });

    expect(merged.startDate).toBe('2026-10-12');
    expect(merged.extras).toEqual({ walks: true, grooming: false, playtime: false });
  });

  it('grows the pet list with empty pets and describes them by index', () => {
    const merged = mergeNeeds(createEmptyNeeds(), {
      petCount: 2,
      pets: [{ index: 1, species: 'cat' }],
    });

    expect(merged.pets).toEqual([
      { species: null, size: null, needsMedication: null, firstTimeBoarding: null },
      { species: 'cat', size: null, needsMedication: null, firstTimeBoarding: null },
    ]);
  });

  it('caps the pet list and ignores out-of-range pet indexes', () => {
    const merged = mergeNeeds(createEmptyNeeds(), {
      petCount: 9,
      pets: [{ index: 7, species: 'dog' }],
    });

    expect(merged.pets).toHaveLength(4);
    expect(merged.pets.every((pet) => pet.species === null)).toBe(true);
  });

  it('shrinks the pet list when the count goes down', () => {
    const twoPets = mergeNeeds(readyNeeds(), { petCount: 2 });

    expect(mergeNeeds(twoPets, { petCount: 1 }).pets).toHaveLength(1);
  });
});

describe('missingNeedFields', () => {
  it('lists every missing field for an empty conversation', () => {
    expect(missingNeedFields(createEmptyNeeds(), TODAY)).toEqual(['service', 'dates', 'pets']);
  });

  it('is empty once the stay can be quoted', () => {
    expect(missingNeedFields(readyNeeds(), TODAY)).toEqual([]);
  });

  it('does not hold the price back for a dog size, but still lists it as worth asking', () => {
    const needs = readyNeeds({
      pets: [
        { species: 'dog', size: null, needsMedication: null, firstTimeBoarding: null },
        { species: 'cat', size: null, needsMedication: null, firstTimeBoarding: null },
      ],
    });

    expect(missingNeedFields(needs, TODAY)).toEqual([]);
    expect(optionalNeedFields(needs)).toEqual(['size']);
    expect(optionalNeedFields(readyNeeds())).toEqual([]);
  });

  it.each([
    ['a start in the past', '2026-09-20', '2026-09-25'],
    ['an end before the start', '2026-10-15', '2026-10-12'],
    ['a same-day range', '2026-10-12', '2026-10-12'],
    ['a stay longer than sixty nights', '2026-10-02', '2027-01-15'],
  ])('treats %s as missing dates', (_label, startDate, endDate) => {
    expect(missingNeedFields(readyNeeds({ startDate, endDate }), TODAY)).toEqual(['dates']);
  });
});

describe('todayInNewZealand', () => {
  it('uses the New Zealand calendar date, not UTC', () => {
    // 11:30 UTC on 30 September is already 1 October in Auckland (NZDT, UTC+13).
    expect(todayInNewZealand(new Date('2026-09-30T11:30:00Z'))).toBe('2026-10-01');
  });
});
