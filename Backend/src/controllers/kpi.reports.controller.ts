import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../common/middlewares/error.middleware.js';
import { isKpiMongoConfigured } from '../mongodb/kpi-reports/kpi.mongo.connection.js';
import { toAucklandDateString } from '../services/kpi.daily-summary.service.js';
import {
  currentPeriodSoFar,
  KPI_REPORT_TYPES,
  lastCompletedPeriod,
} from '../services/kpi.report.periods.js';
import { findKpiReport, generateKpiReport } from '../services/kpi.report.service.js';

const runBodySchema = z.object({
  type: z.enum(KPI_REPORT_TYPES),
  /** last: the last full week or month; current: this week or month so far (for testing). */
  period: z.enum(['last', 'current']).default('last'),
});

const reportParamsSchema = z.object({
  reportId: z.string().regex(/^[a-f0-9]{24}$/),
});

/** POST /api/admin/kpi-reports/run : generates a report now (manager only). */
export const runKpiReportHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const parsed = runBodySchema.safeParse(req.body);
  if (!parsed.success) {
    next(parsed.error);
    return;
  }
  if (!isKpiMongoConfigured()) {
    next(new AppError('KPI reports are not configured', 'KPI_REPORTS_UNAVAILABLE', 503));
    return;
  }
  try {
    const { type, period } = parsed.data;
    const today = toAucklandDateString(new Date());
    const window =
      period === 'current' ? currentPeriodSoFar(type, today) : lastCompletedPeriod(type, today);
    const reportId = await generateKpiReport(type, window, 'manual');
    res.status(201).json({ code: 201, msg: 'KPI report generated', data: { id: reportId } });
  } catch {
    next(new AppError('The KPI report could not be generated', 'KPI_REPORT_FAILED', 503));
  }
};

/** GET /api/admin/kpi-reports/:reportId */
export const getKpiReportHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const parsed = reportParamsSchema.safeParse(req.params);
  if (!parsed.success) {
    next(parsed.error);
    return;
  }
  try {
    const report = await findKpiReport(parsed.data.reportId);
    if (!report) {
      next(new AppError('KPI report not found', 'KPI_REPORT_NOT_FOUND', 404));
      return;
    }
    res.status(200).json({ code: 200, msg: 'KPI report loaded', data: report });
  } catch {
    next(new AppError('KPI reports are temporarily unavailable', 'KPI_REPORTS_UNAVAILABLE', 503));
  }
};
