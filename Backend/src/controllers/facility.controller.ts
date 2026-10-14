import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import * as facilityService from '../services/facility.service.js';

const facilityIdSchema = z.string().min(1, 'Facility ID is required');

export const getFacilityList = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    res.status(200).json(await facilityService.getList());
  } catch (error) {
    next(error);
  }
};

export const getFacilityDetail = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id = facilityIdSchema.parse(req.params.id);
    res.status(200).json(await facilityService.getDetail(id));
  } catch (error) {
    next(error);
  }
};

export const updateFacility = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id = facilityIdSchema.parse(req.params.id);
    res.status(200).json(await facilityService.update(id, req.body));
  } catch (error) {
    next(error);
  }
};
