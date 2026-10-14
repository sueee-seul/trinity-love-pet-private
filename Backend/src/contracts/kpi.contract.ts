/** Zod schema and types for KPI dashboard API query parameters. */

import { z } from 'zod';

export const kpiPeriodSchema = z.enum(['today', 'week', 'month']);

export type KpiPeriod = z.infer<typeof kpiPeriodSchema>;

export const kpiRangeSchema = z.enum(['today', '7d', '30d', '90d']);

export type KpiRange = z.infer<typeof kpiRangeSchema>;

export const kpiDashboardQuerySchema = z.object({
  period: kpiPeriodSchema.optional(),
  range: kpiRangeSchema.optional(),
});

export type KpiDashboardQuery = z.infer<typeof kpiDashboardQuerySchema>;
