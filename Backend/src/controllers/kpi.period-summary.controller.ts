import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../common/middlewares/error.middleware.js';
import {
  PERIOD_SUMMARY_RANGES,
  readPeriodSummary,
} from '../services/kpi.period-summary.service.js';

const periodSummaryQuerySchema = z.object({ range: z.enum(PERIOD_SUMMARY_RANGES) });

/** GET /api/admin/kpi/period-summary?range=7d|30d|90d : the saved report summary for that tab. */
export const getKpiPeriodSummaryHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const parsed = periodSummaryQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    next(parsed.error);
    return;
  }
  try {
    const data = await readPeriodSummary(parsed.data.range);
    res.status(200).json({ code: 200, msg: 'KPI period summary loaded', data });
  } catch {
    next(
      new AppError(
        'KPI period summary is temporarily unavailable',
        'KPI_PERIOD_SUMMARY_UNAVAILABLE',
        503,
      ),
    );
  }
};
