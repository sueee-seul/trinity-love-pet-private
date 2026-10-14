import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as staffService from '../services/staff.service.js';

const staffIdSchema = z.string().min(1, 'Staff ID is required');

export const getStaffList = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    res.status(200).json(await staffService.getList());
  } catch (error) {
    next(error);
  }
};

export const getStaffDetail = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id = res.locals.targetStaffId as string;
    res.status(200).json(await staffService.getDetail(id));
  } catch (error) {
    next(error);
  }
};

export const getStaffByEmail = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const email = req.user?.email;
    if (!email) {
      res
        .status(401)
        .json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
      return;
    }
    res.status(200).json(await staffService.getByEmail(email));
  } catch (error) {
    next(error);
  }
};

export const getStaffManagementOptions = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    res.status(200).json(await staffService.getManagementOptions());
  } catch (error) {
    next(error);
  }
};

export const getStaffAssignments = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id = res.locals.targetStaffId as string;
    res.status(200).json(await staffService.getAssignedPets(id));
  } catch (error) {
    next(error);
  }
};

export const createStaff = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    res.status(201).json(await staffService.create(req.body));
  } catch (error) {
    next(error);
  }
};

/** Manager edit: may change employee role, email and status. */
export const updateStaff = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id = staffIdSchema.parse(req.params.id);
    res.status(200).json(await staffService.updateAsManager(id, req.body));
  } catch (error) {
    next(error);
  }
};

/** Self edit: name, phone and avatar only. */
export const updateOwnStaffProfile = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id = req.user?.id;
    if (!id) {
      res
        .status(401)
        .json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
      return;
    }
    res.status(200).json(await staffService.updateOwnProfile(id, req.body));
  } catch (error) {
    next(error);
  }
};

export const deleteStaff = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id = staffIdSchema.parse(req.params.id);
    await staffService.remove(id, req.user?.id ?? null);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
