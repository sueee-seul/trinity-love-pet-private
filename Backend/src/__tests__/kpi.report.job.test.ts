import { describe, expect, it, vi } from 'vitest';
import {
  createKpiReportsTick,
  type KpiReportsJobDependencies,
} from '../services/kpi.report.job.js';

vi.mock('../config/database.js', () => ({
  pool: { query: vi.fn() },
}));

const dependencies = (existing: boolean): KpiReportsJobDependencies => ({
  hasScheduledReport: vi
    .fn<KpiReportsJobDependencies['hasScheduledReport']>()
    .mockResolvedValue(existing),
  generateKpiReport: vi
    .fn<KpiReportsJobDependencies['generateKpiReport']>()
    .mockResolvedValue('report-id'),
});

describe('KPI reports job', () => {
  it('waits until 09:00 Auckland', async () => {
    const deps = dependencies(false);

    await createKpiReportsTick(deps)(new Date('2026-09-30T19:59:00Z')); // Auckland 01/10 08:59

    expect(deps.generateKpiReport).not.toHaveBeenCalled();
  });

  it("creates last week's, month's and quarter's reports once from 09:00", async () => {
    const deps = dependencies(false);
    const now = new Date('2026-09-30T20:00:00Z'); // Auckland Thu 01/10 09:00

    await createKpiReportsTick(deps)(now);

    expect(deps.generateKpiReport).toHaveBeenCalledWith(
      'weekly',
      { start: '2026-09-21', end: '2026-09-28' },
      'schedule',
      now,
    );
    expect(deps.generateKpiReport).toHaveBeenCalledWith(
      'monthly',
      { start: '2026-09-01', end: '2026-10-01' },
      'schedule',
      now,
    );
    expect(deps.generateKpiReport).toHaveBeenCalledWith(
      'quarterly',
      { start: '2026-07-01', end: '2026-10-01' },
      'schedule',
      now,
    );
  });

  it('skips periods that already have a scheduled report', async () => {
    const deps = dependencies(true);

    await createKpiReportsTick(deps)(new Date('2026-09-30T20:00:00Z'));

    expect(deps.generateKpiReport).not.toHaveBeenCalled();
  });
});
