import type { Request, Response } from 'express';
import * as service from '../services/task.service.js';
import { validDate } from '../modules/tasks/task.types.js';
import { badRequest, uuidParam, handleError } from './task.controller.helpers.js';

export async function getTaskStaff(_req: Request, res: Response): Promise<void> {
  try {
    res.json((await service.getTaskStaff()).rows);
  } catch (error) {
    handleError(res, 'Failed to load task staff', error);
  }
}

export async function getFreeStaff(req: Request, res: Response): Promise<void> {
  const dueDatetime = typeof req.query.dueDatetime === 'string' ? req.query.dueDatetime : null;
  if (!dueDatetime || !validDate(dueDatetime)) return badRequest(res, 'dueDatetime must be valid');
  try {
    const result = await service.getFreeStaff(
      dueDatetime,
      uuidParam(String(req.query.excludeTaskId ?? '')),
      uuidParam(String(req.query.petId ?? '')),
    );
    res.json(result.rows);
  } catch (error) {
    handleError(res, 'Failed to load free staff', error);
  }
}
