import { AppError } from '../common/middlewares/error.middleware.js';
import type {
  CreatePetAssignmentInput,
  PetAssignment,
} from '../contracts/pet.assignment.contract.js';
import * as assignmentRepository from '../repositories/staff.assignment.repository.js';
import { publishTaskEvent } from './livecare.events.js';

export const getAssignments = async (petUuid: string): Promise<PetAssignment[]> => {
  const result = await assignmentRepository.listPetAssignments(petUuid);
  if (result.outcome === 'not_found') {
    throw new AppError('Pet not found', 'NOT_FOUND', 404);
  }
  return result.assignments;
};

export const createAssignment = async (
  petUuid: string,
  input: CreatePetAssignmentInput,
): Promise<PetAssignment> => {
  const result = await assignmentRepository.createPetAssignment({
    petUuid,
    employeeUuid: input.employeeUuid,
    assignmentDate: input.assignmentDate,
    shiftStart: input.shiftStart,
    shiftEnd: input.shiftEnd,
  });

  if (result.outcome === 'created') {
    // Live care names the pet's carer from the roster, so an open page refreshes to show them.
    publishTaskEvent(petUuid);
    return result.assignment;
  }
  if (result.outcome === 'pet_not_found') {
    throw new AppError('Pet not found', 'NOT_FOUND', 404);
  }
  if (result.outcome === 'employee_not_found') {
    throw new AppError('Staff member not found', 'NOT_FOUND', 404);
  }
  throw new AppError('This pet assignment already exists', 'CONFLICT', 409);
};

export const deleteAssignment = async (petUuid: string, assignmentUuid: string): Promise<void> => {
  const result = await assignmentRepository.deletePetAssignment(petUuid, assignmentUuid);
  if (result.outcome === 'not_found') {
    throw new AppError('Pet assignment not found', 'NOT_FOUND', 404);
  }
  publishTaskEvent(petUuid);
};
