import { describe, expect, it, vi } from 'vitest';
import { pool } from '../config/database.js';
import { insertGeneratedTask } from '../repositories/task.fromBooking.repository.js';

vi.mock('../config/database.js', () => ({ pool: { query: vi.fn(async () => ({ rows: [] })) } }));

describe('insertGeneratedTask', () => {
  it('treats a task with the same title on the same day as already generated', async () => {
    await insertGeneratedTask(
      '00000000-0000-4000-8000-0000000000a1',
      'Medication Administration',
      '2026-10-05',
      null,
      null,
      'high',
    );

    const [sql] = vi.mocked(pool.query).mock.calls[0] as unknown as [string];
    // Comparing the exact time made a second midnight copy once a manager had moved the task to
    // 08:00, which for medication means a second dose. Checked against PostgreSQL in PGlite.
    expect(sql).toContain("(scheduled_at AT TIME ZONE 'UTC')::date");
    expect(sql).not.toMatch(/scheduled_at IS NOT DISTINCT FROM \$4::timestamptz/);
  });
});
