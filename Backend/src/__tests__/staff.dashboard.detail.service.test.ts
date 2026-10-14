import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getStaffDetail } from '../services/staff.dashboard.service.js';

const {
  findStaffProfileMock,
  findCompletionBreakdownMock,
  findRecentIssuesMock,
  findTodaysTasksMock,
} = vi.hoisted(() => ({
  findStaffProfileMock: vi.fn(),
  findCompletionBreakdownMock: vi.fn(),
  findRecentIssuesMock: vi.fn(),
  findTodaysTasksMock: vi.fn(),
}));

vi.mock('../repositories/staff.dashboard.repository.js', () => ({
  findStaffProfile: findStaffProfileMock,
  findCompletionBreakdown: findCompletionBreakdownMock,
  findRecentIssues: findRecentIssuesMock,
  findTodaysTasks: findTodaysTasksMock,
}));

beforeEach(() => {
  findStaffProfileMock.mockReset();
  findCompletionBreakdownMock.mockReset();
  findRecentIssuesMock.mockReset();
  findTodaysTasksMock.mockReset();
});

const BASE_PROFILE = {
  id: 'u-1',
  name: 'Alice',
  email: 'alice@wagstay.com',
  employee_number: 'WS-0012',
  staff_role: 'staff',
  employment_type: 'full-time',
  notes: null,
  shift_details: null,
  on_shift: true,
};

describe('getStaffDetail', () => {
  it('projects the payload and computes rate = done / (done + overdue + pending)', async () => {
    findStaffProfileMock.mockResolvedValueOnce({
      rows: [
        {
          id: 'u-1',
          name: 'Alice',
          email: 'alice@wagstay.com',
          employee_number: 'WS-0012',
          staff_role: 'staff',
          employment_type: 'full-time',
          notes: 'Prefers morning shifts.',
          shift_details: '[{"date":"2026-09-09","start":"08:00","finish":"16:00"}]',
          on_shift: true,
        },
      ],
    });
    findCompletionBreakdownMock.mockResolvedValueOnce({
      rows: [{ done: 27, overdue: 2, pending: 5 }],
    });
    findRecentIssuesMock.mockResolvedValueOnce({
      rows: [
        { id: 't-9', title: 'Grooming check', issue: 'Kennel 7 skipped', flagged: true, at: null },
      ],
    });
    findTodaysTasksMock.mockResolvedValueOnce({
      rows: [
        {
          id: 't-1',
          title: 'Feed and walk',
          location: 'Kennel 4',
          pet_name: null,
          scheduled_at: '2026-09-10T09:00:00Z',
          status: 'pending',
          overdue: false,
          overdue_minutes: null,
        },
      ],
    });

    const result = await getStaffDetail('u-1', 'week');

    expect(result.range).toBe('week');
    expect(result.completion).toEqual({ done: 27, overdue: 2, pending: 5, rate: 79 });
    expect(result.staff.employeeNumber).toBe('WS-0012');
    expect(result.staff.employmentType).toBe('full-time');
    expect(result.shiftCalendar).toEqual([{ date: '2026-09-09', start: '08:00', finish: '16:00' }]);
    expect(result.todaysTasks).toMatchObject([{ location: 'Kennel 4' }]);
    expect(result.recentIssues).toMatchObject([{ flagged: true }]);
  });

  it('returns rate 0 when there are no tasks in the range', async () => {
    findStaffProfileMock.mockResolvedValueOnce({
      rows: [
        {
          id: 'u-2',
          name: 'Bob',
          email: 'bob@wagstay.com',
          employee_number: null,
          staff_role: 'staff',
          employment_type: 'part-time',
          notes: null,
          shift_details: null,
          on_shift: false,
        },
      ],
    });
    findCompletionBreakdownMock.mockResolvedValueOnce({
      rows: [{ done: 0, overdue: 0, pending: 0 }],
    });
    findRecentIssuesMock.mockResolvedValueOnce({ rows: [] });
    findTodaysTasksMock.mockResolvedValueOnce({ rows: [] });

    const result = await getStaffDetail('u-2', 'today');

    expect(result.completion.rate).toBe(0);
    expect(result.shiftCalendar).toEqual([]);
  });

  it('throws 404 when the staff member does not exist', async () => {
    findStaffProfileMock.mockResolvedValueOnce({ rows: [] });

    await expect(getStaffDetail('missing', 'today')).rejects.toMatchObject({
      statusCode: 404,
      code: 'STAFF_NOT_FOUND',
    });
  });

  it('falls back to [] when shift_details is not valid JSON', async () => {
    findStaffProfileMock.mockResolvedValueOnce({
      rows: [
        {
          id: 'u-3',
          name: 'Cara',
          email: 'cara@wagstay.com',
          employee_number: 'WS-0030',
          staff_role: 'staff',
          employment_type: 'full-time',
          notes: 'Tuesday to Saturday, 08:00 to 16:00',
          shift_details: 'Tuesday to Saturday, 08:00 to 16:00',
          on_shift: false,
        },
      ],
    });
    findCompletionBreakdownMock.mockResolvedValueOnce({
      rows: [{ done: 3, overdue: 1, pending: 0 }],
    });
    findRecentIssuesMock.mockResolvedValueOnce({ rows: [] });
    findTodaysTasksMock.mockResolvedValueOnce({ rows: [] });

    const result = await getStaffDetail('u-3', 'month');

    expect(result.shiftCalendar).toEqual([]);
    expect(result.staff.notes).toBe('Tuesday to Saturday, 08:00 to 16:00');
    expect(result.completion.rate).toBe(75); // 3 / (3 + 1 + 0)
  });

  it('passes the range to the breakdown query and limit 5 to recent issues', async () => {
    findStaffProfileMock.mockResolvedValueOnce({ rows: [BASE_PROFILE] });
    findCompletionBreakdownMock.mockResolvedValueOnce({
      rows: [{ done: 0, overdue: 0, pending: 0 }],
    });
    findRecentIssuesMock.mockResolvedValueOnce({ rows: [] });
    findTodaysTasksMock.mockResolvedValueOnce({ rows: [] });

    await getStaffDetail('u-1', 'month');

    expect(findCompletionBreakdownMock).toHaveBeenCalledWith('u-1', 'month');
    expect(findRecentIssuesMock).toHaveBeenCalledWith('u-1', 5);
    expect(findTodaysTasksMock).toHaveBeenCalledWith('u-1');
  });

  it('maps today task rows to camelCase and keeps overdueMinutes shape', async () => {
    findStaffProfileMock.mockResolvedValueOnce({ rows: [BASE_PROFILE] });
    findCompletionBreakdownMock.mockResolvedValueOnce({
      rows: [{ done: 1, overdue: 0, pending: 0 }],
    });
    findRecentIssuesMock.mockResolvedValueOnce({ rows: [] });
    findTodaysTasksMock.mockResolvedValueOnce({
      rows: [
        {
          id: 't1',
          title: 'Feed',
          location: 'Kennel 4',
          pet_name: 'Bella',
          scheduled_at: '2026-09-10T09:00:00Z',
          status: 'pending',
          overdue: false,
          overdue_minutes: null,
        },
        {
          id: 't2',
          title: 'Groom',
          location: null,
          pet_name: null,
          scheduled_at: '2026-09-10T07:00:00Z',
          status: 'pending',
          overdue: true,
          overdue_minutes: 40,
        },
      ],
    });

    const result = await getStaffDetail('u-1', 'today');

    expect(result.todaysTasks[0]).toEqual({
      id: 't1',
      title: 'Feed',
      location: 'Kennel 4',
      petName: 'Bella',
      scheduledAt: '2026-09-10T09:00:00Z',
      status: 'pending',
      overdue: false,
      overdueMinutes: null,
    });
    expect(result.todaysTasks[1]?.overdueMinutes).toBe(40);
    expect(result.todaysTasks[1]?.overdue).toBe(true);
  });

  it('sorts the shift calendar by date and drops malformed entries', async () => {
    findStaffProfileMock.mockResolvedValueOnce({
      rows: [
        {
          ...BASE_PROFILE,
          shift_details: JSON.stringify([
            { date: '2026-09-12', start: '08:00', finish: '16:00' },
            { start: '09:00' },
            { date: '2026-09-09', start: '08:00', finish: '16:00' },
          ]),
        },
      ],
    });
    findCompletionBreakdownMock.mockResolvedValueOnce({
      rows: [{ done: 0, overdue: 0, pending: 0 }],
    });
    findRecentIssuesMock.mockResolvedValueOnce({ rows: [] });
    findTodaysTasksMock.mockResolvedValueOnce({ rows: [] });

    const result = await getStaffDetail('u-1', 'week');

    expect(result.shiftCalendar.map((shift) => shift.date)).toEqual(['2026-09-09', '2026-09-12']);
  });

  it('rounds the completion rate', async () => {
    findStaffProfileMock.mockResolvedValueOnce({ rows: [BASE_PROFILE] });
    findCompletionBreakdownMock.mockResolvedValueOnce({
      rows: [{ done: 1, overdue: 1, pending: 1 }],
    });
    findRecentIssuesMock.mockResolvedValueOnce({ rows: [] });
    findTodaysTasksMock.mockResolvedValueOnce({ rows: [] });

    const result = await getStaffDetail('u-1', 'today');

    expect(result.completion.rate).toBe(33); // 1 / 3 → 33
  });
});
