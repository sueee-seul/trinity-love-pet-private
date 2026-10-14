import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { DatabaseUnavailableError } from '../../repositories/database.connection.js';

export class AppError extends Error {
  public code: string;
  public statusCode: number;
  public details?: unknown[];

  constructor(message: string, code: string, statusCode = 400, details?: unknown[]) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    if (details) this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void => {
  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      issue: issue.message,
    }));
    res.status(400).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Invalid input data.',
        details,
      },
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  if (err instanceof DatabaseUnavailableError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: 'Database is unavailable. Please try again later.',
      },
    });
    return;
  }

  // Multer error handling (e.g., file too large)
  if (err instanceof Error && err.name === 'MulterError') {
    res.status(400).json({
      error: {
        code: 'FILE_UPLOAD_FAILED',
        message: err.message,
      },
    });
    return;
  }

  // Default to 500 Internal Server Error
  console.error('Unhandled Error:', err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred on the server.',
    },
  });
};
