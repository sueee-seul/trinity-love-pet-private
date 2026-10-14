import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pool } from '../config/database.js';
import { countOverdueTasks, findTodaysTasks } from '../repositories/staff.dashboard.repository.js';
import { findTaskWithDetails } from '../repositories/task.read.repository.js';

vi.mock('../config/database.js', () => ({
  pool: { query: vi.fn() },
}));

const GRACE_DEADLINE = "(t.scheduled_at AT TIME ZONE 'UTC') + interval '30 minutes')";

describe('Overdue 30-minute grace', () => {
  beforeEach(() => {
    vi.mocked(pool.query).mockReset();
    vi.mocked(pool.query).mockResolvedValue({ rows: [] } as never);
  });

  it('marks task list rows overdue only after scheduled time + 30 minutes', async () => {
    await findTaskWithDetails('task-id');

    const sql = String(vi.mocked(pool.query).mock.calls[0]?.[0]);
    expect(sql).toContain(
      `date_trunc('minute', t.completed_at AT TIME ZONE 'Pacific/Auckland') > (${GRACE_DEADLINE}`,
    );
    expect(sql).toContain(
      `date_trunc('minute', NOW() AT TIME ZONE 'Pacific/Auckland') > (${GRACE_DEADLINE}`,
    );
  });

  it('counts staff dashboard overdue tasks after scheduled time + 30 minutes', async () => {
    await countOverdueTasks('today');

    const sql = String(vi.mocked(pool.query).mock.calls[0]?.[0]);
    expect(sql).toContain(`> (${GRACE_DEADLINE}`);
    expect(sql).not.toContain("> (t.scheduled_at AT TIME ZONE 'UTC')\n");
  });

  it('measures overdue minutes from the end of the grace window', async () => {
    await findTodaysTasks('staff-id');

    const sql = String(vi.mocked(pool.query).mock.calls[0]?.[0]);
    expect(sql).toContain(`- (${GRACE_DEADLINE})) / 60`);
  });
});
