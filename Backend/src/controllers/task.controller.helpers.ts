import type { Response } from 'express';
import { TaskServiceError } from '../services/task.service.js';
import { isUuid } from '../modules/tasks/task.types.js';

export const badRequest = (res: Response, message: string): void => {
  res.status(400).json({ error: message });
};

export const forbidden = (res: Response): void => {
  res.status(403).json({
    error: { code: 'FORBIDDEN', message: 'You do not have permission to access this resource' },
  });
};

export const uuidParam = (value: string | string[] | undefined): string | null => {
  if (typeof value !== 'string' || !isUuid(value)) return null;
  return value;
};

export const handleError = (res: Response, action: string, error: unknown): void => {
  if (error instanceof TaskServiceError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }
  console.error(action, error);
  res.status(503).json({ error: 'Database unavailable' });
};
