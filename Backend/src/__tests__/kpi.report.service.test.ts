import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  countTasksCreatedBetween,
  findReportTasksScheduledBetween,
  findManagerEmails,
  type ReportTaskRow,
} from '../repositories/kpi.report.repository.js';
import { writeKpiReport } from '../services/kpi.report.llm.js';
import { buildKpiReport, generateKpiReport } from '../services/kpi.report.service.js';

const { reportModel, alertModel } = vi.hoisted(() => ({
  reportModel: { create: vi.fn(), updateOne: vi.fn() },
  alertModel: { create: vi.fn() },
}));

vi.mock('../config/database.js', () => ({
  pool: { query: vi.fn() },
}));

vi.mock('../mongodb/kpi-reports/kpi.mongo.connection.js', () => ({
  getKpiMongoConnection: vi.fn().mockResolvedValue({}),
  isKpiMongoConfigured: vi.fn(() => true),
}));

vi.mock('../mongodb/kpi-reports/report-log.model.js', () => ({
  getReportLogModel: vi.fn(() => reportModel),
}));

vi.mock('../mongodb/kpi-reports/alert-log.model.js', () => ({
  getAlertLogModel: vi.fn(() => alertModel),
}));

vi.mock('../repositories/kpi.report.repository.js', () => ({
  findReportTasksScheduledBetween: vi.fn(),
  countTasksCreatedBetween: vi.fn(),
  findManagerEmails: vi.fn(),
}));

vi.mock('../services/kpi.report.llm.js', () => ({
  writeKpiReport: vi.fn(),
}));

const { sendEmail } = vi.hoisted(() => ({ sendEmail: vi.fn() }));

vi.mock('../services/kpi.report.email.sender.js', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  readReportEmailSettings: vi.fn(() => ({
    mode: 'console',
    apiKey: null,
    from: 'onboarding@resend.dev',
    testRecipient: 'sue@example.com',
    appUrl: 'http://localhost:5173',
  })),
  createReportEmailSender: vi.fn(() => sendEmail),
}));

const NOW = new Date('2026-10-01T02:00:00Z'); // Auckland 01/10 15:00
const LAST_WEEK = { start: '2026-09-21', end: '2026-09-28' };

const lateTask: ReportTaskRow = {
  id: 'late',
  title: 'Outdoor Walk',
  status: 'completed',
  priority: 'mid',
  task_type: 'pet',
  scheduled_at: '2026-09-22T09:00:00Z',
  completed_at: '2026-09-21T21:10:00Z',
  created_at: '2026-09-15T00:00:00Z',
  pet_name: 'Storm',
  staff_name: 'liam.thompson',
  issue: 'Held back by a thunderstorm.',
  category: 'custom',
};

describe('KPI report service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findReportTasksScheduledBetween).mockImplementation(async (start) =>
      start === LAST_WEEK.start ? [lateTask] : [],
    );
    vi.mocked(countTasksCreatedBetween).mockResolvedValue(0);
    reportModel.create.mockResolvedValue({ _id: '6abd912524b83af9b90c9501' });
    alertModel.create.mockResolvedValue({});
    reportModel.updateOne.mockResolvedValue({});
    vi.mocked(findManagerEmails).mockResolvedValue(['a@wagstay.test', 'b@wagstay.test']);
    sendEmail.mockResolvedValue(undefined);
  });

  it('loads four periods for trends and sends the delay reasons to the LLM', async () => {
    vi.mocked(writeKpiReport).mockResolvedValue({
      headline: 'Walking ran late this week.',
      delayReasons: [{ theme: 'Weather', count: 1, example: 'Held back by a thunderstorm.' }],
      model: 'test-model',
    });

    const built = await buildKpiReport('weekly', LAST_WEEK, NOW);

    expect(findReportTasksScheduledBetween).toHaveBeenCalledTimes(4);
    expect(findReportTasksScheduledBetween).toHaveBeenCalledWith('2026-08-31', '2026-09-07');
    expect(writeKpiReport).toHaveBeenCalledWith(
      expect.objectContaining({
        periodLabel: '21 Sep to 27 Sep',
        delayReasons: [{ category: 'Walking', reason: 'Held back by a thunderstorm.' }],
      }),
    );
    expect(built.content).toMatchObject({
      periodLabel: '21 Sep to 27 Sep',
      previousLabel: '14 Sep to 20 Sep',
      headline: 'Walking ran late this week.',
      delayReasonCount: 1,
    });
    expect(built.llmModel).toBe('test-model');
  });

  it('still builds the report when the LLM fails', async () => {
    vi.mocked(writeKpiReport).mockRejectedValue(new Error('quota exceeded'));

    const built = await buildKpiReport('weekly', LAST_WEEK, NOW);

    expect(built.content.headline).toBeNull();
    expect(built.content.delayReasons).toEqual([]);
    expect(built.llmError).toBe('quota exceeded');
  });

  it('saves the report and adds a report-ready alert that links to it', async () => {
    vi.mocked(writeKpiReport).mockResolvedValue({
      headline: 'Walking ran late this week.',
      delayReasons: [],
      model: 'test-model',
    });

    const reportId = await generateKpiReport('weekly', LAST_WEEK, 'manual', NOW);

    expect(reportId).toBe('6abd912524b83af9b90c9501');
    expect(reportModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'weekly', periodStart: '2026-09-21', trigger: 'manual' }),
    );
    expect(alertModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        rule: 'report-ready',
        title: 'Weekly report ready (21 Sep to 27 Sep)',
        reportId: '6abd912524b83af9b90c9501',
      }),
    );
  });

  it('emails the test recipient and saves the email outcome on the report', async () => {
    vi.mocked(writeKpiReport).mockResolvedValue({
      headline: 'Walking ran late this week.',
      delayReasons: [],
      model: 'test-model',
    });

    await generateKpiReport('weekly', LAST_WEEK, 'manual', NOW);

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ['sue@example.com'],
        subject: 'Weekly KPI report: 21 Sep to 27 Sep',
      }),
    );
    expect(reportModel.updateOne).toHaveBeenCalledWith(
      { _id: '6abd912524b83af9b90c9501' },
      {
        $set: {
          email: expect.objectContaining({
            status: 'sent',
            intendedRecipients: ['a@wagstay.test', 'b@wagstay.test'],
            sentTo: ['sue@example.com'],
          }),
        },
      },
    );
  });

  it('keeps the report when the email fails', async () => {
    vi.mocked(writeKpiReport).mockResolvedValue({
      headline: 'Walking ran late this week.',
      delayReasons: [],
      model: 'test-model',
    });
    sendEmail.mockRejectedValue(new Error('Resend rejected the email (403): domain'));

    await expect(generateKpiReport('weekly', LAST_WEEK, 'manual', NOW)).resolves.toBe(
      '6abd912524b83af9b90c9501',
    );
    expect(reportModel.updateOne).toHaveBeenCalledWith(
      { _id: '6abd912524b83af9b90c9501' },
      { $set: { email: expect.objectContaining({ status: 'failed' }) } },
    );
  });
});
