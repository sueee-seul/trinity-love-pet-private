import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readKpiLlmSettings, writeDailySummaryText } from '../services/kpi.llm.service.js';
import { buildDailyKpiFigures, type DailyKpiFigures } from '../services/kpi.summary.service.js';
import {
  generateDailySummary,
  readYesterdaySummary,
} from '../services/kpi.daily-summary.service.js';

const { summaryModel } = vi.hoisted(() => ({
  summaryModel: { findOne: vi.fn(), updateOne: vi.fn() },
}));

vi.mock('../config/database.js', () => ({
  pool: { query: vi.fn() },
}));

vi.mock('../mongodb/kpi-reports/kpi.mongo.connection.js', () => ({
  getKpiMongoConnection: vi.fn().mockResolvedValue({}),
  isKpiMongoConfigured: vi.fn(() => true),
}));

vi.mock('../mongodb/kpi-reports/daily-summary.model.js', () => ({
  getDailySummaryModel: vi.fn(() => summaryModel),
}));

vi.mock('../services/kpi.llm.service.js', () => ({
  readKpiLlmSettings: vi.fn(),
  writeDailySummaryText: vi.fn(),
}));

vi.mock('../services/kpi.summary.service.js', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  buildDailyKpiFigures: vi.fn(),
}));

const FIGURES: DailyKpiFigures = {
  date: '2026-09-30',
  scheduled: 5,
  completed: 3,
  completionRate: 60,
  overdue: 3,
  incompleteAtDayEnd: 3,
  staff: [{ name: 'Aroha', overdue: 2, assigned: 3 }],
};

const savedSummary = (value: unknown): void => {
  summaryModel.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(value) });
};

describe('KPI daily summary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    summaryModel.updateOne.mockResolvedValue({});
    savedSummary(null);
  });

  it('saves an empty summary without calling the LLM when nothing was scheduled', async () => {
    vi.mocked(buildDailyKpiFigures).mockResolvedValue({ ...FIGURES, scheduled: 0, staff: [] });

    await expect(generateDailySummary('2026-09-30')).resolves.toBe('created');

    expect(writeDailySummaryText).not.toHaveBeenCalled();
    expect(summaryModel.updateOne).toHaveBeenCalledWith(
      { date: '2026-09-30' },
      { $set: expect.objectContaining({ status: 'empty', text: null }) },
      { upsert: true },
    );
  });

  it('saves the LLM text as ready', async () => {
    vi.mocked(buildDailyKpiFigures).mockResolvedValue(FIGURES);
    vi.mocked(writeDailySummaryText).mockResolvedValue({
      text: 'Summary text',
      model: 'test-model',
    });

    await generateDailySummary('2026-09-30');

    expect(summaryModel.updateOne).toHaveBeenCalledWith(
      { date: '2026-09-30' },
      {
        $set: {
          status: 'ready',
          text: 'Summary text',
          figures: FIGURES,
          llmModel: 'test-model',
          attempts: 1,
        },
      },
      { upsert: true },
    );
  });

  it('saves a failed attempt and rethrows when the LLM fails', async () => {
    vi.mocked(buildDailyKpiFigures).mockResolvedValue(FIGURES);
    vi.mocked(writeDailySummaryText).mockRejectedValue(new Error('quota exceeded'));

    await expect(generateDailySummary('2026-09-30')).rejects.toThrow('quota exceeded');

    expect(summaryModel.updateOne).toHaveBeenCalledWith(
      { date: '2026-09-30' },
      { $set: expect.objectContaining({ status: 'failed', attempts: 1 }) },
      { upsert: true },
    );
  });

  it('skips a day that already has a ready summary', async () => {
    savedSummary({ status: 'ready', attempts: 1 });

    await expect(generateDailySummary('2026-09-30')).resolves.toBe('skipped');

    expect(buildDailyKpiFigures).not.toHaveBeenCalled();
  });

  it('stops retrying after three failed attempts', async () => {
    savedSummary({ status: 'failed', attempts: 3 });

    await expect(generateDailySummary('2026-09-30')).resolves.toBe('skipped');

    expect(writeDailySummaryText).not.toHaveBeenCalled();
  });

  it('does not count missing LLM settings as an attempt', async () => {
    vi.mocked(buildDailyKpiFigures).mockResolvedValue(FIGURES);
    vi.mocked(readKpiLlmSettings).mockImplementationOnce(() => {
      throw new Error('Invalid KPI LLM configuration: KPI_LLM_API_KEY: required');
    });

    await expect(generateDailySummary('2026-09-30')).rejects.toThrow(
      'Invalid KPI LLM configuration',
    );

    expect(writeDailySummaryText).not.toHaveBeenCalled();
    expect(summaryModel.updateOne).not.toHaveBeenCalled();
  });

  it("reads yesterday's ready summary and its figures in Auckland time", async () => {
    savedSummary({ status: 'ready', text: 'Summary text', figures: FIGURES });

    const view = await readYesterdaySummary(new Date('2026-09-30T20:00:00Z')); // Auckland 01/10 09:00

    expect(view).toEqual({
      date: '2026-09-30',
      status: 'ready',
      text: 'Summary text',
      figures: FIGURES,
    });
  });

  it('reports not_ready without figures when no summary is saved', async () => {
    const view = await readYesterdaySummary(new Date('2026-09-30T20:00:00Z'));

    expect(view).toEqual({ date: '2026-09-30', status: 'not_ready', text: null, figures: null });
  });
});
