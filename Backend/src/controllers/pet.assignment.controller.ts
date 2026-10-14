import type { NextFunction, Request, Response } from 'express';
import {
  assignmentIdSchema,
  createPetAssignmentSchema,
  petIdSchema,
} from '../contracts/pet.assignment.contract.js';
import * as assignmentService from '../services/pet.assignment.service.js';

const parsePetId = (value: unknown): string => petIdSchema.parse(value);

export const getPetAssignments = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const petUuid = parsePetId(req.params.id);
    res.status(200).json(await assignmentService.getAssignments(petUuid));
  } catch (error) {
    next(error);
  }
};

export const createPetAssignment = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const petUuid = parsePetId(req.params.id);
    const input = createPetAssignmentSchema.parse(req.body);
    res.status(201).json(await assignmentService.createAssignment(petUuid, input));
  } catch (error) {
    next(error);
  }
};

export const deletePetAssignment = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const petUuid = parsePetId(req.params.id);
    const assignmentUuid = assignmentIdSchema.parse(req.params.assignmentId);
    await assignmentService.deleteAssignment(petUuid, assignmentUuid);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
