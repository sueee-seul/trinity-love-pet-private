import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as petService from '../services/pet.service.js';
import { PET_GENDERS, PET_TYPES } from '../contracts/pet.contract.js';

export const getPetList = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const data = await petService.getList();
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

const petIdSchema = z.string().min(1, 'Pet ID is required');

export const getPetDetail = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id = petIdSchema.parse(req.params.id);
    const data = await petService.getDetail(id);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

const updatePetProfileSchema = z
  .object({
    type: z.enum(PET_TYPES),
    gender: z.enum(PET_GENDERS),
    age: z.number().positive('Age must be a positive number'),
    ownerName: z.string().min(1, 'Owner name is required'),
    breed: z.string().nullable().optional().default(null),
    weight: z.number().nullable().optional().default(null),
    microchipNumber: z.string().nullable().optional().default(null),
  })
  .strict();

export const updatePetProfile = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id = petIdSchema.parse(req.params.id);
    const input = updatePetProfileSchema.parse(req.body);
    const data = await petService.updateProfile(id, input);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

const notesSchema = z.object({ notes: z.string().trim().max(2000).nullable() });

export const updatePetHealthNotes = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id = petIdSchema.parse(req.params.id);
    const { notes } = notesSchema.parse(req.body);
    const data = await petService.updateHealthNotes(id, notes || null);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

export const updatePetBehaviourNotes = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id = petIdSchema.parse(req.params.id);
    const { notes } = notesSchema.parse(req.body);
    const data = await petService.updateBehaviourNotes(id, notes || null);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

const medicationInputSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  strength: z.string().trim().min(1).nullable(),
  dose: z.number().positive('Dose must be a positive number'),
  unit: z.string().trim().min(1, 'Unit is required'),
  route: z.string().trim().min(1, 'Route is required'),
  schedule: z.array(z.string().trim().min(1)),
  withFood: z.boolean(),
  instructions: z.string().trim().min(1).nullable(),
  prescribedBy: z.string().trim().min(1).nullable(),
  active: z.boolean(),
});

const medicationIdSchema = z.string().min(1, 'Medication ID is required');

export const createPetMedication = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id = petIdSchema.parse(req.params.id);
    const input = medicationInputSchema.parse(req.body);
    const data = await petService.addMedication(id, input);
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
};

export const updatePetMedication = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id = petIdSchema.parse(req.params.id);
    const medicationId = medicationIdSchema.parse(req.params.medicationId);
    const input = medicationInputSchema.partial().parse(req.body);
    const data = await petService.editMedication(id, medicationId, input);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

export const deletePetMedication = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id = petIdSchema.parse(req.params.id);
    const medicationId = medicationIdSchema.parse(req.params.medicationId);
    const data = await petService.removeMedication(id, medicationId);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};
