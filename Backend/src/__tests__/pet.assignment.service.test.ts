import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PetAssignment } from '../contracts/pet.assignment.contract.js';
import * as assignmentService from '../services/pet.assignment.service.js';

const repository = vi.hoisted(() => ({
  listPetAssignments: vi.fn(),
  createPetAssignment: vi.fn(),
  deletePetAssignment: vi.fn(),
}));

vi.mock('../repositories/staff.assignment.repository.js', () => repository);

const liveCareEvents = vi.hoisted(() => ({ publishTaskEvent: vi.fn() }));
vi.mock('../services/livecare.events.js', () => liveCareEvents);

const PET_UUID = '00000000-0000-4000-8000-000000000501';
const EMPLOYEE_UUID = '00000000-0000-4000-8000-000000000202';

const assignment: PetAssignment = {
  uuid: '00000000-0000-4000-8000-000000000a01',
  petUuid: PET_UUID,
  petName: 'Biscuit',
  employeeUuid: EMPLOYEE_UUID,
  employeeName: 'Database Staff',
  assignmentDate: '2026-08-30',
  shiftStart: '08:00',
  shiftEnd: '16:00',
};

describe('pet assignment service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns persisted assignments from the repository', async () => {
    repository.listPetAssignments.mockResolvedValue({
      outcome: 'found',
      assignments: [assignment],
    });

    await expect(assignmentService.getAssignments(PET_UUID)).resolves.toEqual([assignment]);
  });

  it('maps a missing pet to the existing not-found HTTP error', async () => {
    repository.listPetAssignments.mockResolvedValue({ outcome: 'not_found' });

    await expect(assignmentService.getAssignments(PET_UUID)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
    });
  });

  it('maps duplicate assignments to HTTP 409', async () => {
    repository.createPetAssignment.mockResolvedValue({ outcome: 'duplicate' });

    await expect(
      assignmentService.createAssignment(PET_UUID, {
        employeeUuid: EMPLOYEE_UUID,
        assignmentDate: '2026-08-30',
        shiftStart: '08:00',
        shiftEnd: '16:00',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT', statusCode: 409 });
  });

  it('returns a created assignment', async () => {
    repository.createPetAssignment.mockResolvedValue({ outcome: 'created', assignment });

    await expect(
      assignmentService.createAssignment(PET_UUID, {
        employeeUuid: EMPLOYEE_UUID,
        assignmentDate: assignment.assignmentDate,
        shiftStart: assignment.shiftStart,
        shiftEnd: assignment.shiftEnd,
      }),
    ).resolves.toEqual(assignment);
    expect(liveCareEvents.publishTaskEvent).toHaveBeenCalledWith(PET_UUID);
  });

  // Live care names the carer from the roster, so the parent's open page must hear of the change.
  it('tells live care when a carer is taken off the pet', async () => {
    repository.deletePetAssignment.mockResolvedValue({ outcome: 'deleted' });

    await assignmentService.deleteAssignment(PET_UUID, assignment.uuid);

    expect(liveCareEvents.publishTaskEvent).toHaveBeenCalledWith(PET_UUID);
  });

  it('maps a delete miss to the existing not-found HTTP error', async () => {
    repository.deletePetAssignment.mockResolvedValue({ outcome: 'not_found' });

    await expect(
      assignmentService.deleteAssignment(PET_UUID, assignment.uuid),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
    expect(liveCareEvents.publishTaskEvent).not.toHaveBeenCalled();
  });
});
