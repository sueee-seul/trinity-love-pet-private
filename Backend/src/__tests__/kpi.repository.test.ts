import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pool } from '../config/database.js';
import {
  findOverdueRateByPeriod,
  findScheduledTaskKpiRecordsByPeriod,
  resolveKpiPeriod,
  findScheduledTaskKpiRecordsBetween,
} from '../repositories/kpi.repository.js';

vi.mock('../config/database.js', () => ({
  pool: { query: vi.fn() },
}));

describe('KPI repository', () => {
  beforeEach(() => {
    vi.mocked(pool.query).mockReset();
  });

  it('filters and groups both Overdue Rate queries by the Auckland scheduled date', async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    await findOverdueRateByPeriod('today', '7d');

    expect(vi.mocked(pool.query)).toHaveBeenCalledTimes(2);
    for (const [query] of vi.mocked(pool.query).mock.calls) {
      const sql = String(query);
      expect(sql).not.toContain('t.created_at');
      expect(sql).not.toContain("t.scheduled_at AT TIME ZONE 'Pacific/Auckland'");
      expect(sql).toContain(
        "(t.scheduled_at AT TIME ZONE 'UTC') >= ($1::timestamptz AT TIME ZONE 'Pacific/Auckland')",
      );
      expect(sql).toContain("GROUP BY (t.scheduled_at AT TIME ZONE 'UTC')::date");
      expect(sql).toContain("t.status <> 'cancelled'");
      expect(sql).toContain("::time <> '00:00'");
      expect(sql).toContain("AT TIME ZONE 'Pacific/Auckland') + interval '30 minutes')");
      expect(sql).toContain("date_trunc('minute', ");
    }
  });

  it('uses Auckland midnight for the period boundaries', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-29T19:00:00Z')); // Auckland 30/09 08:00 (NZDT)

    const { start, end } = resolveKpiPeriod('today', 'today');

    expect(start.toISOString()).toBe('2026-09-29T11:00:00.000Z'); // Auckland 30/09 00:00
    expect(end.toISOString()).toBe('2026-09-30T11:00:00.000Z'); // Auckland 01/10 00:00
    vi.useRealTimers();
  });
  it('fetches scheduled KPI records by Auckland scheduled date only', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never);

    await findScheduledTaskKpiRecordsByPeriod('today', '7d');

    const sql = String(vi.mocked(pool.query).mock.calls[0]?.[0]);
    expect(sql).not.toContain('t.created_at <');
    expect(sql).not.toContain('t.completed_at >=');
    expect(sql).toContain(
      "(t.scheduled_at AT TIME ZONE 'UTC') >= ($1::timestamptz AT TIME ZONE 'Pacific/Auckland')",
    );
    expect(sql).toContain("t.status <> 'cancelled'");
    expect(sql).not.toContain("::time <> '00:00'");
  });

  it('fetches KPI records by Auckland scheduled date between two dates', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never);

    await findScheduledTaskKpiRecordsBetween('2026-09-23', '2026-10-01');

    const [sql, params] = vi.mocked(pool.query).mock.calls[0] ?? [];
    expect(String(sql)).toContain("(t.scheduled_at AT TIME ZONE 'UTC') >= $1::date");
    expect(String(sql)).toContain("(t.scheduled_at AT TIME ZONE 'UTC') < $2::date");
    expect(String(sql)).toContain("t.status <> 'cancelled'");
    expect(params).toEqual(['2026-09-23', '2026-10-01']);
  });
});
