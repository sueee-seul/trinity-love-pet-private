import { Router } from 'express';
import { requireManager } from '../common/middlewares/auth.middleware.js';
import { getKpiReportHandler, runKpiReportHandler } from '../controllers/kpi.reports.controller.js';

/** Weekly and monthly KPI reports, mounted at /api/admin/kpi-reports. Manager only. */
export const kpiReportsRouter = Router();

kpiReportsRouter.post('/run', requireManager, runKpiReportHandler);
kpiReportsRouter.get('/:reportId', requireManager, getKpiReportHandler);
