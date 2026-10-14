import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

const staffIdSchema = z.string().min(1, 'Staff ID is required');

export const resolveTargetStaffId = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const id =
      req.user?.employee_role === 'manager' ? staffIdSchema.parse(req.params.id) : req.user?.id;
    if (!id) {
      res
        .status(401)
        .json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
      return;
    }
    res.locals.targetStaffId = id;
    next();
  } catch (error) {
    next(error);
  }
};
