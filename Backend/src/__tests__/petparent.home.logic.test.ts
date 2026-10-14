import { describe, expect, it } from 'vitest';
import {
  buildChecklist,
  daysToGo,
  resolveHomeState,
  vaccinationStatusOf,
} from '../services/petparent.home.logic.js';

describe('resolveHomeState', () => {
  it.each([
    [{ petCount: 0, hasUpcomingStay: false, hasPastStays: false }, 'A'],
    [{ petCount: 0, hasUpcomingStay: true, hasPastStays: true }, 'A'],
    [{ petCount: 2, hasUpcomingStay: false, hasPastStays: false }, 'B1'],
    [{ petCount: 2, hasUpcomingStay: false, hasPastStays: true }, 'B2'],
    [{ petCount: 2, hasUpcomingStay: true, hasPastStays: false }, 'C1'],
    [{ petCount: 2, hasUpcomingStay: true, hasPastStays: true }, 'C2'],
  ] as const)('%j -> %s', (input, expected) => {
    expect(resolveHomeState(input)).toBe(expected);
  });
});

describe('vaccinationStatusOf', () => {
  it('is done only when the answer is Yes and a certificate is uploaded for the stay', () => {
    expect(vaccinationStatusOf({ fullyVaccinated: true, hasVaccinationCertificate: true })).toBe(
      'done',
    );
  });

  it.each([
    [true, false],
    [false, false],
    [null, false],
    [false, true],
    [null, true],
  ] as const)(
    'is outstanding when fullyVaccinated is %s and a certificate is on file is %s',
    (fullyVaccinated, hasVaccinationCertificate) => {
      expect(vaccinationStatusOf({ fullyVaccinated, hasVaccinationCertificate })).toBe(
        'outstanding',
      );
    },
  );
});

describe('daysToGo', () => {
  it('counts calendar days, not 24-hour blocks', () => {
    const now = new Date(2026, 8, 7, 23, 30);
    expect(daysToGo(new Date(2026, 8, 12, 8, 0), now)).toBe(5);
    expect(daysToGo(new Date(2026, 8, 8, 0, 5), now)).toBe(1);
    expect(daysToGo(new Date(2026, 8, 7, 23, 59), now)).toBe(0);
  });

  it('never goes negative', () => {
    expect(daysToGo(new Date(2026, 8, 1), new Date(2026, 8, 7))).toBe(0);
  });
});

describe('buildChecklist', () => {
  const pets = [
    { bookingPetId: 'bp-1', fullyVaccinated: true, hasVaccinationCertificate: true },
    { bookingPetId: 'bp-2', fullyVaccinated: true, hasVaccinationCertificate: false },
  ];

  it('always returns all four items in a fixed order', () => {
    const list = buildChecklist({ hasAgreement: true, paymentSucceeded: true, pets });
    expect(list.map((item) => item.key)).toEqual([
      'agreement',
      'payment',
      'vaccination',
      'admission',
    ]);
  });

  it('marks vaccination outstanding while any pet has no certificate, listing those pets', () => {
    const vaccination = buildChecklist({ hasAgreement: true, paymentSucceeded: true, pets })[2];
    expect(vaccination).toMatchObject({
      status: 'outstanding',
      tappable: true,
      bookingPetIds: ['bp-2'],
    });
  });

  it('marks vaccination done when every pet is', () => {
    const vaccination = buildChecklist({
      hasAgreement: true,
      paymentSucceeded: true,
      pets: pets.slice(0, 1),
    })[2];
    expect(vaccination).toMatchObject({ status: 'done', tappable: false });
    expect(vaccination).not.toHaveProperty('bookingPetIds');
  });

  it('reflects agreement and payment, and keeps admission outstanding and not tappable', () => {
    const list = buildChecklist({ hasAgreement: false, paymentSucceeded: false, pets: [] });
    expect(list[0]).toMatchObject({ status: 'outstanding', tappable: true });
    expect(list[1]).toMatchObject({ status: 'outstanding', tappable: true });
    expect(list[3]).toMatchObject({ key: 'admission', status: 'outstanding', tappable: false });
  });
});
