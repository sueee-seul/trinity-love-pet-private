import { describe, expect, it, vi } from 'vitest';
import { createDailySummaryTick } from '../services/kpi.daily-summary.job.js';

vi.mock('../config/database.js', () => ({
  pool: { query: vi.fn() },
}));

describe('KPI daily summary job', () => {
  it('waits until 09:00 Auckland', async () => {
    const run = vi.fn().mockResolvedValue('created');
    const tick = createDailySummaryTick(run);

    await tick(new Date('2026-09-30T19:59:00Z')); // Auckland 01/10 08:59

    expect(run).not.toHaveBeenCalled();
  });

  it("creates yesterday's summary from 09:00 Auckland", async () => {
    const run = vi.fn().mockResolvedValue('created');
    const tick = createDailySummaryTick(run);
    const now = new Date('2026-09-30T20:00:00Z'); // Auckland 01/10 09:00

    await tick(now);

    expect(run).toHaveBeenCalledWith('2026-09-30', now);
  });

  it('logs a failed run instead of throwing', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const tick = createDailySummaryTick(vi.fn().mockRejectedValue(new Error('quota exceeded')));

    await expect(tick(new Date('2026-09-30T20:00:00Z'))).resolves.toBeUndefined();

    expect(errorLog).toHaveBeenCalledWith(
      'KPI daily summary job failed',
      expect.objectContaining({ message: 'quota exceeded' }),
    );
    errorLog.mockRestore();
  });
});
