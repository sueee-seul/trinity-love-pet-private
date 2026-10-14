import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findScheduledTaskKpiRecordsBetween } from '../repositories/kpi.repository.js';
import { evaluateKpiAlertRules, type KpiAlertCandidate } from '../services/kpi.alerts.rules.js';
import {
  listKpiAlerts,
  markKpiAlertRead,
  runKpiAlertChecks,
} from '../services/kpi.alerts.service.js';

const { alertModel } = vi.hoisted(() => ({
  alertModel: {
    findOne: vi.fn(),
    create: vi.fn(),
    find: vi.fn(),
    countDocuments: vi.fn(),
    updateOne: vi.fn(),
    updateMany: vi.fn(),
  },
}));

vi.mock('../config/database.js', () => ({
  pool: { query: vi.fn() },
}));

vi.mock('../mongodb/kpi-reports/kpi.mongo.connection.js', () => ({
  getKpiMongoConnection: vi.fn().mockResolvedValue({}),
  isKpiMongoConfigured: vi.fn(() => true),
}));

vi.mock('../mongodb/kpi-reports/alert-log.model.js', () => ({
  getAlertLogModel: vi.fn(() => alertModel),
}));

vi.mock('../repositories/kpi.repository.js', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  findScheduledTaskKpiRecordsBetween: vi.fn(),
}));

vi.mock('../services/kpi.alerts.rules.js', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  evaluateKpiAlertRules: vi.fn(),
}));

const NOW = new Date('2026-10-01T02:00:00Z'); // Auckland 01/10 15:00

const CANDIDATE: KpiAlertCandidate = {
  rule: 'staff-overdue',
  subject: 'aria.singh',
  severity: 3,
  title: 'aria.singh overdue 60% (3/5)',
  body: 'Walking tasks delayed',
};

const latestAlert = (value: unknown): void => {
  alertModel.findOne.mockReturnValue({
    sort: () => ({ lean: vi.fn().mockResolvedValue(value) }),
  });
};

describe('KPI alerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findScheduledTaskKpiRecordsBetween).mockResolvedValue([]);
    vi.mocked(evaluateKpiAlertRules).mockReturnValue([CANDIDATE]);
    alertModel.create.mockResolvedValue({});
  });

  it("checks today's tasks in Auckland time and saves a new alert", async () => {
    latestAlert(null);

    await expect(runKpiAlertChecks(NOW)).resolves.toBe(1);

    expect(findScheduledTaskKpiRecordsBetween).toHaveBeenCalledWith('2026-10-01', '2026-10-02');
    expect(evaluateKpiAlertRules).toHaveBeenCalledWith([], NOW, 15);
    expect(alertModel.create).toHaveBeenCalledWith({
      ...CANDIDATE,
      date: '2026-10-01',
      readBy: [],
    });
  });

  it('does not repeat an alert that did not get worse', async () => {
    latestAlert({ severity: 3 });

    await expect(runKpiAlertChecks(NOW)).resolves.toBe(0);

    expect(alertModel.create).not.toHaveBeenCalled();
  });

  it('alerts again when it got worse', async () => {
    latestAlert({ severity: 2 });

    await expect(runKpiAlertChecks(NOW)).resolves.toBe(1);
  });

  it('lists alerts with read state per manager', async () => {
    const docs = [
      {
        _id: '6abd912524b83af9b90c9402',
        rule: 'staff-overdue',
        title: 'Newest',
        body: '',
        createdAt: new Date('2026-10-01T01:30:00Z'),
        readBy: ['manager-1'],
      },
      {
        _id: '6abd912524b83af9b90c9401',
        rule: 'overdue-rate',
        title: 'Older',
        body: '',
        createdAt: new Date('2026-10-01T01:00:00Z'),
        readBy: [],
      },
    ];
    const lean = vi.fn().mockResolvedValue(docs);
    const limit = vi.fn().mockReturnValue({ lean });
    alertModel.find.mockReturnValue({ sort: vi.fn().mockReturnValue({ limit }) });
    alertModel.countDocuments.mockResolvedValue(1);

    const page = await listKpiAlerts('manager-1', 1);

    expect(page).toEqual({
      items: [
        {
          id: '6abd912524b83af9b90c9402',
          rule: 'staff-overdue',
          title: 'Newest',
          body: '',
          createdAt: '2026-10-01T01:30:00.000Z',
          read: true,
          reportId: null,
        },
      ],
      unreadCount: 1,
      nextCursor: '6abd912524b83af9b90c9402',
    });
    expect(alertModel.countDocuments).toHaveBeenCalledWith({ readBy: { $ne: 'manager-1' } });
  });

  it('marks an alert read for one manager only', async () => {
    await markKpiAlertRead('manager-1', '6abd912524b83af9b90c9401');

    expect(alertModel.updateOne).toHaveBeenCalledWith(
      { _id: expect.anything() },
      { $addToSet: { readBy: 'manager-1' } },
    );
  });
});
