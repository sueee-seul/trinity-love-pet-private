import type { Request, Response } from 'express';
import * as service from '../services/task.service.js';
import { badRequest, uuidParam, handleError } from './task.controller.helpers.js';

export async function createTasksFromBooking(req: Request, res: Response): Promise<void> {
  const bookingId = uuidParam(req.params.bookingId);
  if (!bookingId) return badRequest(res, 'bookingId must be a valid UUID');
  try {
    const result = await service.createTasksFromBooking(bookingId);
    res.status(201).json(result);
  } catch (error) {
    handleError(res, 'Failed to generate tasks from booking', error);
  }
}
