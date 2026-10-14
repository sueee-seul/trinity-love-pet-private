import type { Request, Response } from 'express';
import * as service from '../services/task.service.js';
import { validDate } from '../modules/tasks/task.types.js';
import { badRequest, uuidParam, handleError } from './task.controller.helpers.js';

export async function getTaskAssignments(req: Request, res: Response): Promise<void> {
  const id = uuidParam(req.params.petId);
  const due = typeof req.query.dueDatetime === 'string' ? req.query.dueDatetime : null;
  if (!id) return badRequest(res, 'petId must be a valid UUID');
  if (due && !validDate(due)) return badRequest(res, 'dueDatetime must be valid');
  try {
    const result = await service.getAvailableAssignments(
      id,
      due,
      uuidParam(String(req.query.excludeTaskId ?? '')),
    );
    res.json(result.rows);
  } catch (error) {
    handleError(res, 'Failed to load available task staff', error);
  }
}
// `bookingPetsUuid` is optional and silently ignored if it isn't a valid UUID
// (uuidParam returns null) and falls back to the plain pet + range query below.
export async function getPetTasks(req: Request, res: Response): Promise<void> {
  const id = uuidParam(req.params.petId);
  if (!id) return badRequest(res, 'petId must be a valid UUID');
  const bookingPetsUuid = uuidParam(
    typeof req.query.bookingPetsUuid === 'string' ? req.query.bookingPetsUuid : undefined,
  );
  const range =
    req.query.range === 'today' || req.query.range === 'week' || req.query.range === 'month'
      ? req.query.range
      : 'all';
  try {
    res.json((await service.getPetTasks(id, range, bookingPetsUuid ?? undefined)).rows);
  } catch (error) {
    handleError(res, 'Failed to load tasks', error);
  }
}

export async function getStaffTasks(req: Request, res: Response): Promise<void> {
  const id = uuidParam(req.params.staffId);
  if (!id) return badRequest(res, 'staffId must be a valid UUID');
  const range =
    req.query.range === 'week' || req.query.range === 'month' ? req.query.range : 'today';
  try {
    res.json((await service.getStaffTasks(id, range)).rows);
  } catch (error) {
    handleError(res, 'Failed to load staff tasks', error);
  }
}

export async function getTask(req: Request, res: Response): Promise<void> {
  const id = uuidParam(req.params.taskId);
  if (!id) return badRequest(res, 'taskId must be a valid UUID');
  try {
    const result = await service.getTask(id);
    if (!result.rows[0]) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    res.json(result.rows[0]);
  } catch (error) {
    handleError(res, 'Failed to load task', error);
  }
}

export async function getTaskTemplates(_req: Request, res: Response): Promise<void> {
  try {
    res.json((await service.getTaskTemplates()).rows);
  } catch (error) {
    handleError(res, 'Failed to load task templates', error);
  }
}
