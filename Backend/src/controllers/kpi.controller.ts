import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../common/middlewares/error.middleware.js';
import { getKpiDashboard } from '../services/kpi.service.js';
import { readYesterdaySummary } from '../services/kpi.daily-summary.service.js';
import { kpiDashboardQuerySchema } from '../contracts/kpi.contract.js';

/**
 * GET /api/admin/kpi/dashboard
 * Returns 13 chart series + 3 legacy metrics, all computed from live Neon data.
 * Query params: ?range=today|7d|30d|90d (default: today)
 * The period is always 'today'; the range controls how many days of history are returned.
 */
export const getKpiDashboardHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const parsed = kpiDashboardQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    next(parsed.error);
    return;
  }

  try {
    const range = parsed.data.range ?? 'today';
    const data = await getKpiDashboard(range);
    res.status(200).json({ code: 200, msg: 'KPI dashboard loaded', data });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      next(error);
      return;
    }

    next(
      new AppError('KPI dashboard is temporarily unavailable', 'KPI_DASHBOARD_UNAVAILABLE', 503),
    );
  }
};

/**
 * GET /api/admin/kpi/daily-summary
 * Returns yesterday's saved summary (Auckland). Reads MongoDB only and never calls the LLM.
 */
export const getKpiDailySummaryHandler = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const data = await readYesterdaySummary();
    res.status(200).json({ code: 200, msg: 'KPI daily summary loaded', data });
  } catch {
    next(
      new AppError(
        'KPI daily summary is temporarily unavailable',
        'KPI_DAILY_SUMMARY_UNAVAILABLE',
        503,
      ),
    );
  }
};
