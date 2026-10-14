import type { Request, Response, NextFunction } from 'express';
import * as service from '../services/staff.dashboard.service.js';
import type { DashboardRange } from '../repositories/staff.dashboard.repository.js';
import { AppError } from '../common/middlewares/error.middleware.js';

const RANGE: readonly DashboardRange[] = ['today', 'week', 'month'];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const resolveRange = (raw: unknown): DashboardRange =>
  typeof raw === 'string' && (RANGE as readonly string[]).includes(raw)
    ? (raw as DashboardRange)
    : 'today';

//GET /api/admin/staff-dashboard?range=today|week|month
export const getOverview = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    res.status(200).json(await service.getOverview(resolveRange(req.query.range)));
  } catch (error) {
    next(error);
  }
};

//GET /api/admin/staff-dashboard/:staffId?range=today|week|month
export const getStaffDetail = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const raw = req.params.staffId;
    const staffId = typeof raw === 'string' ? raw : '';
    if (!UUID_RE.test(staffId)) {
      throw new AppError('Invalid staff id', 'INVALID_STAFF_ID', 400);
    }
    res.status(200).json(await service.getStaffDetail(staffId, resolveRange(req.query.range)));
  } catch (error) {
    next(error);
  }
};
