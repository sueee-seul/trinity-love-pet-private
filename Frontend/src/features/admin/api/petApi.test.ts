import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createPetAssignment,
  deletePetAssignment,
  fetchPetAssignments,
  fetchPetList,
  updatePetProfile,
} from './petApi';
import type { PetAssignment, PetDetail } from '../types/pet';

const pet: PetDetail = {
  id: 'pet-1',
  name: 'Sherlock',
  status: 'approved',
  checkInDate: '15/08/2026',
  checkOutDate: '20/08/2026',
  type: 'Dog',
  age: 4,
  gender: 'Male',
  ownerName: 'Jennifer Andrews',
  breed: 'Labrador Retriever',
  weight: 24.5,
  microchipNumber: '982000123456789',
  healthNotes: null,
  behaviourNotes: null,
  medications: [],
};

const assignment: PetAssignment = {
  uuid: 'assignment-1',
  petUuid: 'pet-1',
  petName: 'Sherlock',
  employeeUuid: 'employee-1',
  employeeName: 'Bob Staff',
  assignmentDate: '2026-08-30',
  shiftStart: '08:00:00',
  shiftEnd: '16:00:00',
};

describe('petApi assignment and profile contracts', () => {
  const fetchMock = vi.fn();

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('normalizes numeric weight strings from the API before returning pet data', async () => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [{ ...pet, weight: '24.5', age: '4' }],
    });

    await expect(fetchPetList()).resolves.toEqual([
      expect.objectContaining({
        id: 'pet-1',
        weight: 24.5,
        age: 4,
      }),
    ]);
  });

  it('sends profile fields without scalar assigneeId or a status (the stay decides it)', async () => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue({ ok: true, json: async () => pet });

    await updatePetProfile('pet-1', {
      type: 'Cat',
      gender: 'Female',
      age: 5,
      ownerName: 'Updated Owner',
      breed: 'Tabby',
      weight: 5.2,
      microchipNumber: '900123456789',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/admin/pets/pet-1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          type: 'Cat',
          gender: 'Female',
          age: 5,
          ownerName: 'Updated Owner',
          breed: 'Tabby',
          weight: 5.2,
          microchipNumber: '900123456789',
        }),
      }),
    );
  });

  it('uses the dedicated credentialed assignment endpoints', async () => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [assignment] })
      .mockResolvedValueOnce({ ok: true, json: async () => assignment })
      .mockResolvedValueOnce({ ok: true });

    await expect(fetchPetAssignments('pet-1')).resolves.toEqual([assignment]);
    await expect(
      createPetAssignment('pet-1', {
        employeeUuid: 'employee-1',
        assignmentDate: '2026-08-30',
        shiftStart: '08:00',
        shiftEnd: '16:00',
      }),
    ).resolves.toEqual(assignment);
    await expect(deletePetAssignment('pet-1', 'assignment-1')).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://localhost:3000/api/admin/pets/pet-1/assignments',
      { credentials: 'include' },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3000/api/admin/pets/pet-1/assignments',
      expect.objectContaining({ credentials: 'include', method: 'POST' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'http://localhost:3000/api/admin/pets/pet-1/assignments/assignment-1',
      { credentials: 'include', method: 'DELETE' },
    );
  });
});
