import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  deleteShiftNote,
  findStaffOptions,
  insertShiftNote,
  listShiftNotes,
  updateShiftNote,
} from '../repositories/staff.shift.repository.js';

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:MM');

const noteBodySchema = z.object({
  staffId: z.string().uuid('staffId must be a valid UUID'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD'),
  // Required: task assignment filters staff by shift hours, not just the date.
  startTime: timeSchema,
  finishTime: timeSchema,
  issue: z.string().trim().max(2000).nullable().default(null),
});

const listQuerySchema = z.object({
  staffId: z.string().uuid().optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

const notFound = (res: Response): void => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Shift note not found' } });
};

const isStaffNotFound = (error: unknown): boolean =>
  error instanceof Error && error.message === 'STAFF_NOT_FOUND';

export const getShiftStaffOptions = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    res.status(200).json((await findStaffOptions()).rows);
  } catch (error) {
    next(error);
  }
};

export const getShiftNotes = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const filter = listQuerySchema.parse(req.query);
    res.status(200).json(await listShiftNotes(filter));
  } catch (error) {
    next(error);
  }
};

export const postShiftNote = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const body = noteBodySchema.parse(req.body);
    const id = await insertShiftNote(
      body.staffId,
      body.date,
      body.startTime,
      body.finishTime,
      body.issue && body.issue.length > 0 ? body.issue : null,
    );
    res.status(201).json({ id });
  } catch (error) {
    if (isStaffNotFound(error)) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Staff member not found' } });
      return;
    }
    next(error);
  }
};

export const putShiftNote = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id = z.string().uuid('id must be a valid UUID').parse(req.params.id);
    const body = noteBodySchema.parse(req.body);
    const updated = await updateShiftNote(
      id,
      body.staffId,
      body.date,
      body.startTime,
      body.finishTime,
      body.issue && body.issue.length > 0 ? body.issue : null,
    );
    if (!updated) {
      notFound(res);
      return;
    }
    res.status(200).json({ ok: true });
  } catch (error) {
    if (isStaffNotFound(error)) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Staff member not found' } });
      return;
    }
    next(error);
  }
};

export const removeShiftNote = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id = z.string().uuid('id must be a valid UUID').parse(req.params.id);
    const removed = await deleteShiftNote(id);
    if (!removed) {
      notFound(res);
      return;
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
