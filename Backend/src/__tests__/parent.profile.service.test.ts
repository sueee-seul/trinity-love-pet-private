import { describe, expect, it, vi } from 'vitest';

// withStayStatuses is pure; the database and media modules are mocked so importing the service
// opens no connection.
vi.mock('../repositories/parent.profile.repository.js', () => ({}));
vi.mock('../services/profile.media.storage.js', () => ({ validateProfileMediaUrl: vi.fn() }));

import type { ManagerReviewStatus } from '../contracts/stay-status.contract.js';
import type {
  StoredParentProfile,
  StoredPet,
  StoredStay,
} from '../repositories/parent.profile.repository.js';
import { withStayStatuses } from '../services/parent.profile.service.js';

const NOW = new Date('2026-10-13T12:00:00.000Z');

const storedStay = (
  id: string,
  reviewStatus: ManagerReviewStatus,
  dropOff: string,
  pickUp: string,
): StoredStay => ({
  id,
  petId: 'pet-1',
  facilityId: '',
  type: 'BOARDING',
  reviewStatus,
  checkInOutcome: null,
  dropOffTime: new Date(dropOff),
  pickUpTime: new Date(pickUp),
  startAt: dropOff,
  endAt: pickUp,
  runName: null,
  facility: null,
});

const storedPet = (stays: StoredStay[]): StoredPet => ({
  id: 'pet-1',
  ownerId: 'owner-1',
  name: 'Biscuit',
  species: 'DOG',
  breed: null,
  photoUrl: null,
  birthDate: null,
  sex: null,
  desexed: false,
  weightKg: null,
  colour: null,
  microchip: null,
  dietNotes: null,
  allergies: [],
  behaviourNotes: null,
  vetName: null,
  vetPhone: null,
  emergencyContact: null,
  medications: [],
  stays,
});

const profileWith = (stays: StoredStay[]): StoredParentProfile => ({
  owner: {
    id: 'owner-1',
    fullName: 'Parent',
    email: 'parent@example.test',
    phone: '021 000 0000',
    avatarUrl: null,
    address: '',
    dateOfBirth: null,
    emergencyContactNumber: '021 000 0001',
  },
  pets: [storedPet(stays)],
});

describe('withStayStatuses', () => {
  it("names each profile stay from the manager's decision and the injected clock", () => {
    const profile = withStayStatuses(
      profileWith([
        storedStay('pending-now', 'pending', '2026-10-12T09:00:00Z', '2026-10-14T17:00:00Z'),
        storedStay('refused-later', 'refused', '2026-11-01T09:00:00Z', '2026-11-03T17:00:00Z'),
        storedStay('cancelled-now', 'cancelled', '2026-10-12T09:00:00Z', '2026-10-14T17:00:00Z'),
        storedStay('approved-later', 'approved', '2026-11-01T09:00:00Z', '2026-11-03T17:00:00Z'),
        storedStay('approved-now', 'approved', '2026-10-12T09:00:00Z', '2026-10-14T17:00:00Z'),
        storedStay('approved-ended', 'approved', '2026-09-01T09:00:00Z', '2026-09-03T17:00:00Z'),
      ]),
      NOW,
    );

    expect(profile.pets[0]?.stays.map((stay) => [stay.id, stay.status])).toEqual([
      ['pending-now', 'waiting_for_review'],
      ['refused-later', 'refused'],
      ['cancelled-now', 'cancelled'],
      ['approved-later', 'approved'],
      ['approved-now', 'staying_now'],
      ['approved-ended', 'stay_ended'],
    ]);
  });

  it('keeps the stored decision and raw times out of the profile response', () => {
    const stored = storedStay(
      'approved-now',
      'approved',
      '2026-10-12T09:00:00Z',
      '2026-10-14T17:00:00Z',
    );
    const [stay] = withStayStatuses(profileWith([stored]), NOW).pets[0]?.stays ?? [];

    expect(stay).toEqual({
      id: 'approved-now',
      petId: 'pet-1',
      facilityId: '',
      type: 'BOARDING',
      status: 'staying_now',
      startAt: '2026-10-12T09:00:00Z',
      endAt: '2026-10-14T17:00:00Z',
      runName: null,
      facility: null,
    });
  });
});
