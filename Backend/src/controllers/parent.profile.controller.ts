import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import * as parentProfileService from '../services/parent.profile.service.js';
import * as parentProfileRepository from '../repositories/parent.profile.repository.js';
import { AppError } from '../common/middlewares/error.middleware.js';

const idSchema = z.string().min(1, 'Id is required');

// `requirePetParent` runs in front of every route in this router, so `req.user`
// is always set here - this just gives that a non-optional type.
const requireUser = (req: Request): NonNullable<Request['user']> => {
  if (!req.user) {
    throw new AppError('Authentication required', 'UNAUTHENTICATED', 401);
  }
  return req.user;
};

const forbidden = (): AppError =>
  new AppError('You do not have permission to access this profile', 'FORBIDDEN', 403);

export const getParentProfile = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // The caller's own session decides whose profile this is - an `?email=`
    // query value, if one is sent, is never trusted, or a parent could read
    // any other parent's profile just by guessing their email.
    const { email } = requireUser(req);
    res.status(200).json(await parentProfileService.getByEmail(email));
  } catch (error) {
    next(error);
  }
};

export const updateParentOwner = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const ownerId = idSchema.parse(req.params.ownerId);
    const user = requireUser(req);
    if (ownerId !== user.id) {
      throw forbidden();
    }
    res.status(200).json(await parentProfileService.updateOwner(ownerId, req.body));
  } catch (error) {
    next(error);
  }
};

export const createParentPet = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const ownerId = idSchema.parse(req.params.ownerId);
    const user = requireUser(req);
    if (ownerId !== user.id) {
      throw forbidden();
    }
    res.status(201).json(await parentProfileService.createPet(ownerId, req.body));
  } catch (error) {
    next(error);
  }
};

export const updateParentPet = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const petId = idSchema.parse(req.params.petId);
    const user = requireUser(req);
    const ownerId = await parentProfileRepository.findPetOwnerId(petId);
    if (ownerId !== undefined && ownerId !== user.id) {
      throw forbidden();
    }
    res.status(200).json(await parentProfileService.updatePet(petId, req.body));
  } catch (error) {
    next(error);
  }
};

export const deleteParentPet = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const petId = idSchema.parse(req.params.petId);
    const user = requireUser(req);
    const ownerId = await parentProfileRepository.findPetOwnerId(petId);
    if (ownerId !== undefined && ownerId !== user.id) {
      throw forbidden();
    }
    res.status(200).json(await parentProfileService.deletePet(petId));
  } catch (error) {
    next(error);
  }
};
