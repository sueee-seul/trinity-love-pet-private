import { Router } from 'express';
import { requireManager } from '../common/middlewares/auth.middleware.js';
import {
  getKpiDashboardHandler,
  getKpiDailySummaryHandler,
} from '../controllers/kpi.controller.js';
import { getKpiPeriodSummaryHandler } from '../controllers/kpi.period-summary.controller.js';

export const kpiRouter = Router();

kpiRouter.get('/dashboard', requireManager, getKpiDashboardHandler);
kpiRouter.get('/daily-summary', requireManager, getKpiDailySummaryHandler);
kpiRouter.get('/period-summary', requireManager, getKpiPeriodSummaryHandler);
