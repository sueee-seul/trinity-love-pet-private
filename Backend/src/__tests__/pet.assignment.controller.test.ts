import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import type { PetAssignment } from '../contracts/pet.assignment.contract.js';
import {
  createPetAssignment,
  deletePetAssignment,
  getPetAssignments,
} from '../controllers/pet.assignment.controller.js';

const service = vi.hoisted(() => ({
  getAssignments: vi.fn(),
  createAssignment: vi.fn(),
  deleteAssignment: vi.fn(),
}));

vi.mock('../services/pet.assignment.service.js', () => service);

const PET_UUID = '00000000-0000-4000-8000-000000000501';
const EMPLOYEE_UUID = '00000000-0000-4000-8000-000000000202';
const ASSIGNMENT_UUID = '00000000-0000-4000-8000-000000000a01';

const assignment: PetAssignment = {
  uuid: ASSIGNMENT_UUID,
  petUuid: PET_UUID,
  petName: 'Biscuit',
  employeeUuid: EMPLOYEE_UUID,
  employeeName: 'Database Staff',
  assignmentDate: '2026-08-30',
  shiftStart: '08:00',
  shiftEnd: '16:00',
};

const createResponse = (): Response =>
  ({
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  }) as unknown as Response;

const createRequest = (body: unknown = {}): Request =>
  ({ params: { id: PET_UUID, assignmentId: ASSIGNMENT_UUID }, body }) as unknown as Request;

describe('pet assignment controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns assignment rows from the service', async () => {
    service.getAssignments.mockResolvedValue([assignment]);
    const response = createResponse();
    const next = vi.fn();

    await getPetAssignments(createRequest(), response, next as unknown as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith([assignment]);
  });

  it('passes strict shift validation failures to the error middleware', async () => {
    const response = createResponse();
    const next = vi.fn();

    await createPetAssignment(
      createRequest({
        employeeUuid: EMPLOYEE_UUID,
        assignmentDate: '2026-08-30',
        shiftStart: '08:00',
        shiftEnd: null,
      }),
      response,
      next as unknown as NextFunction,
    );

    expect(service.createAssignment).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(ZodError);
  });

  it('creates and deletes assignments using the requested resource ids', async () => {
    service.createAssignment.mockResolvedValue(assignment);
    service.deleteAssignment.mockResolvedValue(undefined);
    const createResponseValue = createResponse();
    const createNext = vi.fn();

    await createPetAssignment(
      createRequest({
        employeeUuid: EMPLOYEE_UUID,
        assignmentDate: '2026-08-30',
        shiftStart: '08:00',
        shiftEnd: '16:00',
      }),
      createResponseValue,
      createNext as unknown as NextFunction,
    );

    expect(createNext).not.toHaveBeenCalled();
    expect(service.createAssignment).toHaveBeenCalledWith(PET_UUID, {
      employeeUuid: EMPLOYEE_UUID,
      assignmentDate: '2026-08-30',
      shiftStart: '08:00',
      shiftEnd: '16:00',
    });
    expect(createResponseValue.status).toHaveBeenCalledWith(201);
    expect(createResponseValue.json).toHaveBeenCalledWith(assignment);

    const deleteResponse = createResponse();
    const deleteNext = vi.fn();
    await deletePetAssignment(
      createRequest(),
      deleteResponse,
      deleteNext as unknown as NextFunction,
    );

    expect(deleteNext).not.toHaveBeenCalled();
    expect(service.deleteAssignment).toHaveBeenCalledWith(PET_UUID, ASSIGNMENT_UUID);
    expect(deleteResponse.status).toHaveBeenCalledWith(204);
    expect(deleteResponse.send).toHaveBeenCalledTimes(1);
  });
});
