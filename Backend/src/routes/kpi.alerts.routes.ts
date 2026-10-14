import { Router } from 'express';
import { requireManager } from '../common/middlewares/auth.middleware.js';
import {
  listKpiAlertsHandler,
  markAllKpiAlertsReadHandler,
  markKpiAlertReadHandler,
} from '../controllers/kpi.alerts.controller.js';

/** KPI rule alerts, mounted at /api/admin/kpi-alerts. Manager only. */
export const kpiAlertsRouter = Router();

kpiAlertsRouter.get('/', requireManager, listKpiAlertsHandler);
kpiAlertsRouter.patch('/read-all', requireManager, markAllKpiAlertsReadHandler);
kpiAlertsRouter.patch('/:alertId/read', requireManager, markKpiAlertReadHandler);
