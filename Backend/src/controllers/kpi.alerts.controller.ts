import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../common/middlewares/error.middleware.js';
import {
  listKpiAlerts,
  markAllKpiAlertsRead,
  markKpiAlertRead,
} from '../services/kpi.alerts.service.js';

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/;

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  cursor: z.string().regex(OBJECT_ID_PATTERN).optional(),
});

const alertParamsSchema = z.object({
  alertId: z.string().regex(OBJECT_ID_PATTERN),
});

const unauthenticated = (): AppError =>
  new AppError('Authentication required', 'UNAUTHENTICATED', 401);

const unavailable = (): AppError =>
  new AppError('KPI alerts are temporarily unavailable', 'KPI_ALERTS_UNAVAILABLE', 503);

/** GET /api/admin/kpi-alerts?limit=&cursor= : newest alerts first with this manager's read state. */
export const listKpiAlertsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    next(parsed.error);
    return;
  }
  const userId = req.user?.id;
  if (!userId) {
    next(unauthenticated());
    return;
  }
  try {
    const data = await listKpiAlerts(userId, parsed.data.limit, parsed.data.cursor);
    res.status(200).json({ code: 200, msg: 'KPI alerts loaded', data });
  } catch {
    next(unavailable());
  }
};

/** PATCH /api/admin/kpi-alerts/:alertId/read */
export const markKpiAlertReadHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const parsed = alertParamsSchema.safeParse(req.params);
  if (!parsed.success) {
    next(parsed.error);
    return;
  }
  const userId = req.user?.id;
  if (!userId) {
    next(unauthenticated());
    return;
  }
  try {
    await markKpiAlertRead(userId, parsed.data.alertId);
    res.status(200).json({ code: 200, msg: 'KPI alert marked as read', data: null });
  } catch {
    next(unavailable());
  }
};

/** PATCH /api/admin/kpi-alerts/read-all */
export const markAllKpiAlertsReadHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    next(unauthenticated());
    return;
  }
  try {
    await markAllKpiAlertsRead(userId);
    res.status(200).json({ code: 200, msg: 'KPI alerts marked as read', data: null });
  } catch {
    next(unavailable());
  }
};
